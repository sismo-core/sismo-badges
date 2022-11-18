// SPDX-License-Identifier: MIT

pragma solidity ^0.8.14;
pragma experimental ABIEncoderV2;

import {IHydraS1AccountboundAttesterv2} from '../interfaces/IHydraS1AccountboundAttesterv2.sol';
import {HydraS1SimpleAttester} from '../HydraS1SimpleAttester.sol';

// Core protocol Protocol imports
import {Request, Attestation, Claim} from '../../../core/libs/Structs.sol';
import {Attester, IAttester, IAttestationsRegistry} from '../../../core/Attester.sol';

// Imports related to HydraS1 Proving Scheme
import {HydraS1Base, HydraS1Lib, HydraS1ProofData, HydraS1ProofInput, HydraS1Claim} from '../base/HydraS1Base.sol';
import {HydraS1AccountboundLib, HydraS1AccountboundClaim} from '../libs/HydraS1AccountboundLib.sol';

/**
 * @title  Hydra-S1 Accountbound Attester
 * @author Sismo
 * @notice This attester is part of the family of the Hydra-S1 Attesters.
 * Hydra-S1 attesters enable users to prove they have an account in a group in a privacy preserving way.
 * The Hydra-S1 Base abstract contract is inherited and holds the complex Hydra S1 verification logic.
 * We invite readers to refer to:
 *    - https://hydra-s1.docs.sismo.io for a full guide through the Hydra-S1 ZK Attestations
 *    - https://hydra-s1-circuits.docs.sismo.io for circuits, prover and verifiers of Hydra-S1

 * This specific attester has the following characteristics:

 * - Zero Knowledge
 *   One cannot deduct from an attestation what source account was used to generate the underlying proof

 * - Non Strict (scores)
 *   If a user can generate an attestation of max value 100, they can also generate any attestation with value < 100.
 *   This attester generate attestations of scores

 * - Nullified
 *   Each source account gets one nullifier per claim (i.e only one attestation per source account per claim)
 *   For people used to semaphore/ tornado cash people:
 *   nullifier = hash(sourceSecret, externalNullifier) <=> nullifierHash = hash(IdNullifier, externalNullifier)
 
 * - Accountbound (with cooldown period)
 *   Users can choose to delete or generate attestations to a new destination using their source account.
 *   The attestation is "Accountbound" to the source account.
 *   When deleting/ sending to a new destination, the nullifier will enter a cooldown period, so it remains occasional
 *   User will need to wait until the end of the cooldown period before being able to delete or switch destination again
 *   One can however know that the former and the new destinations were created using the same nullifier
 
 * - Renewable
 *   A nullifier can actually be reused as long as the destination of the attestation remains the same
 *   It enables users to renew or update their attestations
 **/
contract HydraS1AccountboundAttesterv2 is IHydraS1AccountboundAttesterv2, HydraS1SimpleAttester {
  using HydraS1Lib for HydraS1ProofData;
  using HydraS1Lib for bytes;
  using HydraS1Lib for Request;

  // Mapping to know cooldown value for a specific groupId
  mapping(uint256 => uint32) internal _groupIdCooldowns;

  // mappings to know the state related to a specific nullifier
  mapping(uint256 => uint32) internal _nullifiersCooldownStart;
  mapping(uint256 => uint16) internal _nullifiersBurnCount;

  /*******************************************************
    INITIALIZATION FUNCTIONS                           
  *******************************************************/
  /**
   * @dev Constructor. Initializes the contract
   * @param attestationsRegistryAddress Attestations Registry contract on which the attester will write attestations
   * @param hydraS1VerifierAddress ZK Snark Hydra-S1 Verifier contract
   * @param availableRootsRegistryAddress Registry storing the available groups for this attester (e.g roots of registry merkle trees)
   * @param commitmentMapperAddress commitment mapper's public key registry
   * @param collectionIdFirst Id of the first collection in which the attester is supposed to record
   * @param collectionIdLast Id of the last collection in which the attester is supposed to record
   */
  constructor(
    address attestationsRegistryAddress,
    address hydraS1VerifierAddress,
    address availableRootsRegistryAddress,
    address commitmentMapperAddress,
    uint256 collectionIdFirst,
    uint256 collectionIdLast
  )
    HydraS1SimpleAttester(
      attestationsRegistryAddress,
      hydraS1VerifierAddress,
      availableRootsRegistryAddress,
      commitmentMapperAddress,
      collectionIdFirst,
      collectionIdLast
    )
  {}

  /*******************************************************
    MANDATORY FUNCTIONS TO OVERRIDE FROM ATTESTER.SOL
  *******************************************************/

  /**
   * @dev Returns the actual attestations constructed from the user request
   * @param request users request. Claim of having an account part of a group of accounts
   * @param proofData snark public input as well as snark proof
   */
  function buildAttestations(
    Request calldata request,
    bytes calldata proofData
  ) public view virtual override(IAttester, HydraS1SimpleAttester) returns (Attestation[] memory) {
    Attestation[] memory attestations = super.buildAttestations(request, proofData);

    uint256 nullifier = proofData._getNullifier();
    attestations[0].extraData =
      attestations[0].extraData +
      _encodeNullifierAndNullifierBurnCount(nullifier, attestations[0].owner);

    return (attestations);
  }

  /*******************************************************
    OPTIONAL HOOK VIRTUAL FUNCTIONS FROM ATTESTER.SOL
  *******************************************************/
  /**
   * @dev Hook run before recording the attestation.
   * Throws if nullifier already used, not a renewal, and nullifier on cooldown.
   * @param request users request. Claim of having an account part of a group of accounts
   * @param proofData provided to back the request. snark input and snark proof
   */
  function _beforeRecordAttestations(
    Request calldata request,
    bytes calldata proofData
  ) internal virtual override {
    uint256 nullifier = proofData._getNullifier();
    address nullifierDestination = _getDestinationOfNullifier(nullifier);

    HydraS1Claim memory claim = request._claim();

    if (
      _isCooldownRenewedForNullifier(
        nullifier,
        nullifierDestination,
        claim.destination,
        claim.groupId
      )
    ) {
      // Delete the old Attestation on the account before recording the new one
      address[] memory attestationOwners = new address[](1);
      uint256[] memory attestationCollectionIds = new uint256[](1);

      attestationOwners[0] = nullifierDestination;
      attestationCollectionIds[0] =
        AUTHORIZED_COLLECTION_ID_FIRST +
        claim.groupProperties.groupIndex;

      ATTESTATIONS_REGISTRY.deleteAttestations(attestationOwners, attestationCollectionIds);

      emit AttestationDeleted(
        Attestation(
          AUTHORIZED_COLLECTION_ID_FIRST + claim.groupProperties.groupIndex,
          nullifierDestination,
          address(this),
          claim.claimedValue,
          claim.groupProperties.generationTimestamp,
          abi.encode(nullifier, _nullifiersBurnCount[nullifier])
        )
      );

      _setNullifierOnCooldown(nullifiers);
    }
    _setDestinationForNullifier(nullifier, request.destination);
  }

  /*******************************************************
    LOGIC FUNCTIONS RELATED TO ACCOUNTBOUND BEHAVIOUR
  *******************************************************/

  /**
   * @dev ABI encodes nullifier and the burn count of the nullifier
   * @param nullifier user nullifier
   * @param claimDestination destination referenced in the user claim
   */
  function _encodeNullifierAndNullifierBurnCount(
    uint256 nullifier,
    address claimDestination
  ) internal virtual returns (bytes memory) {
    address nullifierDestination = _getDestinationOfNullifier(nullifier);
    uint16 burnCount = _nullifiersBurnCount[nullifier];
    // If the attestation is minted on a new destination address
    // the burnCount encoded in the extraData of the Attestation should be incremented
    if (nullifierDestination != address(0) && nullifierDestination != claimDestination) {
      burnCount += 1;
    }
    return (abi.encode(nullifier, burnCount));
  }
}
