// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;
pragma experimental ABIEncoderV2;

import {IHydraS1SimpleAttester} from './interfaces/IHydraS1SimpleAttester.sol';
import {IHydraS1Base} from './base/IHydraS1Base.sol';

// Core protocol Protocol imports
import {Request, Attestation, Claim} from './../../core/libs/Structs.sol';
import {Attester, IAttester, IAttestationsRegistry} from './../../core/Attester.sol';

// Imports related to HydraS1 Proving Scheme
import {HydraS1Base, HydraS1Lib, HydraS1ProofData, HydraS1ProofInput, HydraS1Claim} from './base/HydraS1Base.sol';

/**
 * @title  Hydra-S1 Simple Attester
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
 
 * - Renewable
 *   A nullifier can actually be reused as long as the destination of the attestation remains the same
 *   It enables users to renew their attestations
 **/

contract HydraS1SimpleAttester is IHydraS1SimpleAttester, HydraS1Base {
  using HydraS1Lib for HydraS1ProofData;
  using HydraS1Lib for bytes;
  using HydraS1Lib for Request;

  // The deployed contract will need to be authorized to write into the Attestation registry
  // It should get write access on attestation collections from AUTHORIZED_COLLECTION_ID_FIRST to AUTHORIZED_COLLECTION_ID_LAST.
  uint256 public immutable AUTHORIZED_COLLECTION_ID_FIRST;
  uint256 public immutable AUTHORIZED_COLLECTION_ID_LAST;

  mapping(uint256 => address) internal _nullifiersDestinations;

  // keeping some space for future
  uint256[15] private _placeHoldersHydraS1Simple;

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
    Attester(attestationsRegistryAddress)
    HydraS1Base(hydraS1VerifierAddress, availableRootsRegistryAddress, commitmentMapperAddress)
  {
    AUTHORIZED_COLLECTION_ID_FIRST = collectionIdFirst;
    AUTHORIZED_COLLECTION_ID_LAST = collectionIdLast;
  }

  /*******************************************************
    MANDATORY FUNCTIONS TO OVERRIDE FROM ATTESTER.SOL
  *******************************************************/

  /**
   * @dev Throws if user request is invalid when verified against
   * Look into HydraS1Base for more details
   * @param request users request. Claim of having an account part of a group of accounts
   * @param proofData provided to back the request. snark input and snark proof
   */
  function _verifyRequest(
    Request calldata request,
    bytes calldata proofData
  ) internal virtual override {
    HydraS1ProofData memory snarkProof = abi.decode(proofData, (HydraS1ProofData));
    HydraS1ProofInput memory snarkInput = snarkProof._input();
    HydraS1Claim memory claim = request._claim();

    // verifies that the proof corresponds to the claim
    _validateInput(claim, snarkInput);
    // verifies the proof validity
    _verifyProof(snarkProof);
  }

  /**
   * @dev Returns attestations that will be recorded, constructed from the user request
   * @param request users request. Claim of having an account part of a group of accounts
   */
  function buildAttestations(
    Request calldata request,
    bytes calldata proofData
  ) public view virtual override(IAttester, Attester) returns (Attestation[] memory) {
    HydraS1Claim memory claim = request._claim();

    Attestation[] memory attestations = new Attestation[](1);

    uint256 attestationCollectionId = AUTHORIZED_COLLECTION_ID_FIRST +
      claim.groupProperties.groupIndex;

    if (attestationCollectionId > AUTHORIZED_COLLECTION_ID_LAST)
      revert CollectionIdOutOfBound(attestationCollectionId);

    address issuer = address(this);

    uint256 nullifier = proofData._getNullifier();

    attestations[0] = Attestation(
      attestationCollectionId,
      claim.destination,
      issuer,
      claim.claimedValue,
      claim.groupProperties.generationTimestamp,
      abi.encode(nullifier)
    );
    return (attestations);
  }

  /*******************************************************
    OPTIONAL HOOK VIRTUAL FUNCTIONS FROM ATTESTER.SOL
  *******************************************************/

  /**
   * @dev Hook run before recording the attestation.
   * Throws if nullifier already used and not a renewal (e.g destination different that last)
   * @param request users request. Claim of having an account part of a group of accounts
   * @param proofData provided to back the request. snark input and snark proof
   */
  function _beforeRecordAttestations(
    Request calldata request,
    bytes calldata proofData
  ) internal virtual override {
    // we get the nullifier used from the snark input in the data provided
    uint256 nullifier = proofData._getNullifier();
    address currentDestination = _getDestinationOfNullifier(nullifier);

    if (currentDestination != address(0) && currentDestination != request.destination) {
      revert NullifierUsed(nullifier);
    }

    _setDestinationForNullifier(nullifier, request.destination);
  }

  /*******************************************************
    Hydra-S1 MANDATORY FUNCTIONS FROM Hydra-S1 Base Attester
  *******************************************************/

  /**
   * @dev Returns the external nullifier from a user claim
   * @param claim user Hydra-S1 claim = have an account with a specific value in a specific group
   * nullifier = hash(sourceSecretHash, externalNullifier), which is verified inside the snark
   * users bring sourceSecretHash as private input in snark which guarantees privacy
   
   * Here we chose externalNullifier = hash(attesterAddress, claim.GroupId)
   * Creates one nullifier per group, per user and makes sure no collision with other attester's nullifiers
  **/
  function _getExternalNullifierOfClaim(
    HydraS1Claim memory claim
  ) internal view override returns (uint256) {
    uint256 externalNullifier = _encodeInSnarkField(
      address(this),
      claim.groupProperties.groupIndex
    );
    return externalNullifier;
  }

  /**
   * @dev returns the nullifier for a given extraData
   * @param extraData bytes where the nullifier is encoded
   */
  function getNullifierFromExtraData(
    bytes memory extraData
  ) external pure virtual override(IHydraS1Base, HydraS1Base) returns (uint256) {
    return abi.decode(extraData, (uint256));
  }

  /*******************************************************
    Hydra-S1 Attester Specific Functions
  *******************************************************/

  /**
   * @dev Getter, returns the last attestation destination of a nullifier
   * @param nullifier nullifier used
   **/
  function getDestinationOfNullifier(uint256 nullifier) external view override returns (address) {
    return _getDestinationOfNullifier(nullifier);
  }

  function _setDestinationForNullifier(uint256 nullifier, address destination) internal virtual {
    _nullifiersDestinations[nullifier] = destination;
    emit NullifierDestinationUpdated(nullifier, destination);
  }

  function _getDestinationOfNullifier(uint256 nullifier) internal view returns (address) {
    return _nullifiersDestinations[nullifier];
  }

  function _encodeInSnarkField(address addr, uint256 nb) internal pure returns (uint256) {
    return uint256(keccak256(abi.encode(addr, nb))) % HydraS1Lib.SNARK_FIELD;
  }
}
