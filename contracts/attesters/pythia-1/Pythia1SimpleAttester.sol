// SPDX-License-Identifier: MIT

pragma solidity ^0.8.14;
pragma experimental ABIEncoderV2;

import {Ownable} from '@openzeppelin/contracts/access/Ownable.sol';
import {IPythia1SimpleAttester} from './interfaces/IPythia1SimpleAttester.sol';

// Core protocol Protocol imports
import {Request, Attestation, Claim} from './../../core/libs/Structs.sol';
import {Attester, IAttester, IAttestationsRegistry} from './../../core/Attester.sol';

// Imports related to Pythia1 Proving Scheme
import {Pythia1Base, Pythia1Lib, Pythia1ProofData, Pythia1ProofInput, Pythia1Claim} from './base/Pythia1Base.sol';

/**
 * @title  Pythia-1 Simple Attester
 * @author Sismo
 * @notice This attester is part of the family of the Pythia-1 Attesters.
 * Pythia-1 attesters enable users to prove they have a claim and its proof issued by an 
 * offchain service in a privacy preserving way. 
 * That means no-one can make the link between the account used in the offchain service
 * and the onchain account where the attestation is stored.
 * The Pythia-1 Base abstract contract is inherited and holds the complex Pythia 1 verification logic.
 * We invite readers to refer to:
 *    - https://pythia-1.docs.sismo.io for a full guide through the Pythia-1 ZK Attestations
 *    - https://pythia-1-circuits.docs.sismo.io for circuits, prover and verifiers of Pythia-1

 * This specific attester has the following characteristics:

 * - Zero Knowledge
 *   One cannot deduct from an attestation what offchain issuer's account was used to generate the underlying proof

 * - Non Strict (scores)
 *   If a user can generate an attestation of max value 100, they can also generate any attestation with value < 100.
 *   This attester generate attestations of scores

 * - Ticketed
 *   Each users gets one userTicket per claim
 *   For people used to semaphore/ tornado cash people:
 *   userTicket = hash(secret, ticketIdentifier) <=> nullifierHash = hash(IdNullifier, externalNullifier)
 **/

contract Pythia1SimpleAttester is IPythia1SimpleAttester, Pythia1Base, Attester, Ownable {
  using Pythia1Lib for Pythia1ProofData;
  using Pythia1Lib for bytes;
  using Pythia1Lib for Request;

  uint8 public constant IMPLEMENTATION_VERSION = 3;

  // The deployed contract will need to be authorized to write into the Attestation registry
  // It should get write access on attestation collections from AUTHORIZED_COLLECTION_ID_FIRST to AUTHORIZED_COLLECTION_ID_LAST.
  uint256 public immutable AUTHORIZED_COLLECTION_ID_FIRST;
  uint256 public immutable AUTHORIZED_COLLECTION_ID_LAST;

  uint256[2] internal _commitmentSignerPubKey;
  mapping(uint256 => address) internal _ticketsDestinations;

  /*******************************************************
    INITIALIZATION FUNCTIONS                           
  *******************************************************/
  /**
   * @dev Constructor. Initializes the contract
   * @param attestationsRegistryAddress Attestations Registry contract on which the attester will write attestations
   * @param collectionIdFirst Id of the first collection in which the attester is supposed to record
   * @param collectionIdLast Id of the last collection in which the attester is supposed to record
   * @param pythia1VerifierAddress ZK Snark Pythia-1 Verifier contract
   * @param commitmentSignerPubKey The EdDSA public key of the commitment signer for the Pythia 1 Proving Scheme
   * @param owner The owner of the contract that can update the commitment signer pub key
   */
  constructor(
    address attestationsRegistryAddress,
    uint256 collectionIdFirst,
    uint256 collectionIdLast,
    address pythia1VerifierAddress,
    uint256[2] memory commitmentSignerPubKey,
    address owner
  ) Attester(attestationsRegistryAddress) Pythia1Base(pythia1VerifierAddress) {
    AUTHORIZED_COLLECTION_ID_FIRST = collectionIdFirst;
    AUTHORIZED_COLLECTION_ID_LAST = collectionIdLast;
    initialize(commitmentSignerPubKey, owner);
  }

  /**
   * @dev Initializes the contract, to be called by the proxy delegating calls to this implementation
   * @param commitmentSignerPubKey EdDSA public key of the commitment signer
   * @param owner Owner of the contract, can update public key and address
   * @notice The reinitializer modifier is needed to configure modules that are added through upgrades and that require initialization.
   */
  function initialize(
    uint256[2] memory commitmentSignerPubKey,
    address owner
  ) public reinitializer(VERSION) {
    _transferOwnership(owner);
    _updateCommitmentSignerPubKey(commitmentSignerPubKey);
  }

  /*******************************************************
    MANDATORY FUNCTIONS TO OVERRIDE FROM ATTESTER.SOL
  *******************************************************/
  /**
   * @dev Throws if user request is invalid when verified against
   * Look into Pythia1Base for more details
   * @param request users request. Claim of having an account part of a group of accounts
   * @param proofData provided to back the request. snark input and snark proof
   */
  function _verifyRequest(
    Request calldata request,
    bytes calldata proofData
  ) internal virtual override {
    Pythia1ProofData memory snarkProof = abi.decode(proofData, (Pythia1ProofData));
    Pythia1ProofInput memory snarkInput = snarkProof._input();
    Pythia1Claim memory claim = request._claim();

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
    bytes calldata
  ) public view virtual override(IAttester, Attester) returns (Attestation[] memory) {
    Pythia1Claim memory claim = request._claim();

    Attestation[] memory attestations = new Attestation[](1);

    uint256 attestationCollectionId = AUTHORIZED_COLLECTION_ID_FIRST +
      claim.groupProperties.internalCollectionId;

    if (attestationCollectionId > AUTHORIZED_COLLECTION_ID_LAST)
      revert CollectionIdOutOfBound(attestationCollectionId);

    address issuer = address(this);

    attestations[0] = Attestation(
      attestationCollectionId,
      claim.destination,
      issuer,
      claim.claimedValue,
      uint32(block.timestamp),
      ''
    );
    return (attestations);
  }

  /*******************************************************
    OPTIONAL HOOK VIRTUAL FUNCTIONS FROM ATTESTER.SOL
  *******************************************************/

  /**
   * @dev Hook run before recording the attestation.
   * Throws if ticket already used
   * @param request users request. Claim of beiing part of a group.
   * @param proofData provided to back the request. snark input and snark proof
   */
  function _beforeRecordAttestations(
    Request calldata request,
    bytes calldata proofData
  ) internal virtual override {
    // we get the ticket used from the snark input in the data provided
    uint256 userTicket = proofData._getTicket();
    address currentDestination = _getDestinationOfTicket(userTicket);

    if (currentDestination != address(0)) {
      revert TicketUsed(userTicket);
    }

    _setDestinationForTicket(userTicket, request.destination);
  }

  /*******************************************************
    Pythia-1 MANDATORY FUNCTIONS FROM Pythia-1 Base Attester
  *******************************************************/

  /**
   * @dev Returns the ticket identifier from a user claim
   * @param claim user Pythia-1 claim = have an offchain account with a specific value in a specific group
   * ticket = hash(secretHash, ticketIdentifier), which is verified inside the snark
   * users bring secretHash as private input in snark which guarantees privacy
   * the secretHash is only known by the user and never escape the user's browser
   
   * Here we chose ticketIdentifier = hash(attesterAddress, claim.GroupId)
   * Creates one ticket per group, per user and makes sure no collision with other attester's tickets
  **/
  function _getTicketIdentifierOfClaim(
    Pythia1Claim memory claim
  ) internal view override returns (uint256) {
    uint256 ticketIdentifier = _encodeInSnarkField(
      address(this),
      claim.groupProperties.internalCollectionId
    );
    return ticketIdentifier;
  }

  function _getCommitmentSignerPubKey() internal view override returns (uint256[2] memory) {
    return _commitmentSignerPubKey;
  }

  /*******************************************************
    Pythia-1 Attester Specific Functions
  *******************************************************/

  function updateCommitmentSignerPubKey(
    uint256[2] memory commitmentSignerPubKey
  ) external onlyOwner {
    _updateCommitmentSignerPubKey(commitmentSignerPubKey);
  }

  function _updateCommitmentSignerPubKey(uint256[2] memory commitmentSignerPubKey) internal {
    _commitmentSignerPubKey = commitmentSignerPubKey;
    emit CommitmentSignerPubKeyUpdated(commitmentSignerPubKey);
  }

  /**
   * @dev Getter, returns the last attestation destination of a ticket
   * @param userTicket ticket used
   **/
  function getDestinationOfTicket(uint256 userTicket) external view override returns (address) {
    return _getDestinationOfTicket(userTicket);
  }

  function _setDestinationForTicket(uint256 userTicket, address destination) internal virtual {
    _ticketsDestinations[userTicket] = destination;
    emit TicketDestinationUpdated(userTicket, destination);
  }

  function _getDestinationOfTicket(uint256 userTicket) internal view returns (address) {
    return _ticketsDestinations[userTicket];
  }

  function _encodeInSnarkField(address addr, uint256 nb) internal pure returns (uint256) {
    return uint256(keccak256(abi.encode(addr, nb))) % Pythia1Lib.SNARK_FIELD;
  }
}
