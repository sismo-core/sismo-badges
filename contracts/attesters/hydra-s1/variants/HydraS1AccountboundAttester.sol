// SPDX-License-Identifier: MIT

pragma solidity ^0.8.14;
pragma experimental ABIEncoderV2;

import {IHydraS1AccountboundAttester} from '../interfaces/IHydraS1AccountboundAttester.sol';

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
contract HydraS1AccountboundAttester is IHydraS1AccountboundAttester, HydraS1Base, Attester {
  using HydraS1Lib for HydraS1ProofData;
  using HydraS1Lib for bytes;
  using HydraS1AccountboundLib for Request;

  // The deployed contract will need to be authorized to write into the Attestation registry
  // It should get write access on collections from AUTHORIZED_COLLECTION_ID_FIRST to AUTHORIZED_COLLECTION_ID_LAST.
  uint256 public immutable AUTHORIZED_COLLECTION_ID_FIRST;
  uint256 public immutable AUTHORIZED_COLLECTION_ID_LAST;

  mapping(uint256 => TicketData) internal _userTicketsData;

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
   * @dev Throws if user attestations request is invalid
   * Look into HydraS1Base for more details
   * @param request users request. Claim of having an account part of a group of accounts
   * @param proofData snark proof backing the claim
   */
  function _verifyRequest(Request calldata request, bytes calldata proofData)
    internal
    virtual
    override
  {
    HydraS1ProofData memory snarkProof = abi.decode(proofData, (HydraS1ProofData));
    HydraS1ProofInput memory snarkInput = snarkProof._input();
    HydraS1Claim memory claim = request._hydraS1claim();

    // verifies that the proof corresponds to the claim
    _validateInput(claim, snarkInput);
    // verifies the proof validity
    _verifyProof(snarkProof);
  }

  /**
   * @dev Returns the actual attestations constructed from the user request
   * @param request users request. Claim of having an account part of a group of accounts
   * @param proofData snark public input as well as snark proof
   */
  function buildAttestations(Request calldata request, bytes calldata proofData)
    public
    view
    virtual
    override(IAttester, Attester)
    returns (Attestation[] memory)
  {
    HydraS1AccountboundClaim memory claim = request._hydraS1Accountboundclaim();

    Attestation[] memory attestations = new Attestation[](1);

    uint256 attestationCollectionId = AUTHORIZED_COLLECTION_ID_FIRST +
      claim.groupProperties.groupIndex;
    if (attestationCollectionId > AUTHORIZED_COLLECTION_ID_LAST)
      revert CollectionIdOutOfBound(attestationCollectionId);

    // The issuer of attestations is the attester
    address issuer = address(this);
    // user sends the ticket as input in the data
    uint256 userTicket = proofData._getTicket();
    TicketData memory userTicketData = _userTicketsData[userTicket];

    uint16 burnCount = userTicketData.burnCount;
    // If the attestation is minted on a new destination address
    // the burnCount encoded in the extraData of the Attestation should be incremented
    if (
      userTicketData.destination != address(0) && userTicketData.destination != request.destination
    ) {
      burnCount += 1;
    }

    attestations[0] = Attestation(
      attestationCollectionId,
      request.destination,
      issuer,
      claim.claimedValue,
      claim.groupProperties.generationTimestamp,
      abi.encode(userTicket, burnCount)
    );

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
    TicketData memory userTicketData = _userTicketsData[userTicket];

    if (
      userTicketData.destination != address(0) && userTicketData.destination != request.destination
    ) {
      HydraS1AccountboundClaim memory claim = request._hydraS1Accountboundclaim();
      if (_isOnCooldown(userTicketData, claim.groupProperties.cooldownDuration))
        revert TicketOnCooldown(userTicketData, claim.groupProperties.cooldownDuration);

      // Delete the old Attestation on the account before recording the new one
      address[] memory attestationOwners = new address[](1);
      uint256[] memory attestationCollectionIds = new uint256[](1);

      attestationOwners[0] = userTicketData.destination;
      attestationCollectionIds[0] =
        AUTHORIZED_COLLECTION_ID_FIRST +
        claim.groupProperties.groupIndex;

      ATTESTATIONS_REGISTRY.deleteAttestations(attestationOwners, attestationCollectionIds);

      emit AttestationDeleted(
        Attestation(
          AUTHORIZED_COLLECTION_ID_FIRST + claim.groupProperties.groupIndex,
          userTicketData.destination,
          address(this),
          claim.claimedValue,
          claim.groupProperties.generationTimestamp,
          abi.encode(userTicket, userTicketData.burnCount)
        )
      );
      _setTicketOnCooldown(userTicket);
    }
    _setDestinationForTicket(userTicket, request.destination);
  }

  /*******************************************************
    Hydra-S1 MANDATORY FUNCTIONS FROM Hydra-S1 Base Attester
  *******************************************************/

  /**
   * @dev Returns the ticket identifier from a user claim
   * @param claim user Hydra-S1 claim = have an account with a specific value in a specific group
   * ticket = hash(sourceSecretHash, ticketIdentifier), which is verified inside the snark
   * users bring sourceSecretHash as private input in snark which guarantees privacy
   
   * Here we chose ticketIdentifier = hash(attesterAddress, claim.GroupId)
   * Creates one ticket per group, per user and makes sure no collision with other attester's tickets
  **/
  function _getTicketIdentifierOfClaim(HydraS1Claim memory claim)
    internal
    view
    override
    returns (uint256)
  {
    uint256 ticketIdentifier = _encodeInSnarkField(address(this), claim.groupProperties.groupIndex);
    return ticketIdentifier;
  }

  /*******************************************************
    Hydra-S1 Attester Specific Functions
  *******************************************************/

  /**
   * @dev Getter, returns the last attestation destination of a ticket
   * @param userTicket ticket used
   **/
  function getDestinationOfTicket(uint256 userTicket) external view override returns (address) {
    return _getDestinationOfTicket(userTicket);
  }

  /**
   * @dev Getter, returns the data linked to a ticket
   * @param userTicket ticket used
   **/
  function getTicketData(uint256 userTicket) external view override returns (TicketData memory) {
    return _getTicketData(userTicket);
  }

  function _setDestinationForTicket(uint256 userTicket, address destination) internal virtual {
    _userTicketsData[userTicket].destination = destination;
    emit TicketDestinationUpdated(userTicket, destination);
  }

  function _setTicketOnCooldown(uint256 userTicket) internal {
    _userTicketsData[userTicket].cooldownStart = uint32(block.timestamp);
    _userTicketsData[userTicket].burnCount += 1;
    emit TicketSetOnCooldown(userTicket, _userTicketsData[userTicket].burnCount);
  }

  function _getDestinationOfTicket(uint256 userTicket) internal view returns (address) {
    return _userTicketsData[userTicket].destination;
  }

  function _isOnCooldown(TicketData memory userTicketData, uint32 cooldownDuration)
    internal
    view
    returns (bool)
  {
    return userTicketData.cooldownStart + cooldownDuration > block.timestamp;
  }

  function _getTicketData(uint256 userTicket) internal view returns (TicketData memory) {
    return _userTicketsData[userTicket];
  }

  function _encodeInSnarkField(address addr, uint256 nb) internal pure returns (uint256) {
    return uint256(keccak256(abi.encode(addr, nb))) % HydraS1Lib.SNARK_FIELD;
  }
}
