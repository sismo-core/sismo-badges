// SPDX-License-Identifier: MIT

pragma solidity ^0.8.14;
pragma experimental ABIEncoderV2;

import {IHydraS1AccountboundAttesterv2} from '../interfaces/IHydraS1AccountboundAttesterv2.sol';
import {HydraS1SimpleAttester} from '../HydraS1SimpleAttester.sol';
import {Accountbound} from '../accountbound/Accountbound.sol';

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

 * - Ticketed
 *   Each source account gets one userTicket per claim (i.e only one attestation per source account per claim)
 *   For people used to semaphore/ tornado cash people:
 *   userTicket = hash(sourceSecret, ticketIdentifier) <=> nullifierHash = hash(IdNullifier, externalNullifier)
 
 * - Accountbound (with cooldown period)
 *   Users can choose to delete or generate attestations to a new destination using their source account.
 *   The attestation is "Accountbound" to the source account.
 *   When deleting/ sending to a new destination, the ticket will enter a cooldown period, so it remains occasional
 *   User will need to wait until the end of the cooldown period before being able to delete or switch destination again
 *   One can however know that the former and the new destinations were created using the same userTicket
 
 * - Renewable
 *   A userTicket can actually be reused as long as the destination of the attestation remains the same
 *   It enables users to renew or update their attestations
 **/
contract HydraS1AccountboundAttesterv2 is
  IHydraS1AccountboundAttesterv2,
  Accountbound,
  HydraS1SimpleAttester
{
  using HydraS1Lib for HydraS1ProofData;
  using HydraS1Lib for bytes;
  using HydraS1Lib for Request;

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
    uint256 collectionIdLast,
    uint32 defaultCooldownDuration
  )
    HydraS1SimpleAttester(
      attestationsRegistryAddress,
      hydraS1VerifierAddress,
      availableRootsRegistryAddress,
      commitmentMapperAddress,
      collectionIdFirst,
      collectionIdLast
    )
    Accountbound(defaultCooldownDuration)
  {}

  /*******************************************************
    MANDATORY FUNCTIONS TO OVERRIDE FROM ATTESTER.SOL
  *******************************************************/

  function buildAttestations(Request calldata request, bytes calldata proofData)
    public
    view
    virtual
    override(IAttester, HydraS1SimpleAttester)
    returns (Attestation[] memory)
  {
    Attestation[] memory attestations = super.buildAttestations(request, proofData);

    uint256 userTicket = proofData._getTicket();
    uint16 burnCount = super.handleAccountboundBurnCount(
      userTicket,
      _getDestinationOfTicket(userTicket),
      attestations[0].owner
    );

    attestations[0].extraData = abi.encode(userTicket, burnCount);
    return (attestations);
  }

  /*******************************************************
    OPTIONAL HOOK VIRTUAL FUNCTIONS FROM ATTESTER.SOL
  *******************************************************/
  /**
   * @dev Hook run before recording the attestation.
   * Throws if ticket already used, not a renewal, and ticket on cooldown.
   * @param request users request. Claim of having an account part of a group of accounts
   * @param proofData provided to back the request. snark input and snark proof
   */
  function _beforeRecordAttestations(Request calldata request, bytes calldata proofData)
    internal
    virtual
    override
  {
    uint256 userTicket = proofData._getTicket();
    address ticketDestination = _getDestinationOfTicket(userTicket);

    HydraS1Claim memory claim = request._claim();

    if (
      _isCooldownRenewedForTicket(userTicket, ticketDestination, claim.destination, claim.groupId)
    ) {
      // Delete the old Attestation on the account before recording the new one
      address[] memory attestationOwners = new address[](1);
      uint256[] memory attestationCollectionIds = new uint256[](1);

      attestationOwners[0] = ticketDestination;
      attestationCollectionIds[0] =
        AUTHORIZED_COLLECTION_ID_FIRST +
        claim.groupProperties.groupIndex;

      ATTESTATIONS_REGISTRY.deleteAttestations(attestationOwners, attestationCollectionIds);

      emit AttestationDeleted(
        Attestation(
          AUTHORIZED_COLLECTION_ID_FIRST + claim.groupProperties.groupIndex,
          ticketDestination,
          address(this),
          claim.claimedValue,
          claim.groupProperties.generationTimestamp,
          abi.encode(userTicket, _ticketsBurnCount[userTicket])
        )
      );

      _setTicketOnCooldown(userTicket);
    }
    _setDestinationForTicket(userTicket, request.destination);
  }
}
