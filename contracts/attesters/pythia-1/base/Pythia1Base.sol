// SPDX-License-Identifier: MIT

pragma solidity ^0.8.14;
pragma experimental ABIEncoderV2;

import {IPythia1Base} from './IPythia1Base.sol';
import {Initializable} from '@openzeppelin/contracts/proxy/utils/Initializable.sol';

// Protocol imports
import {Request, Attestation, Claim} from '../../../core/libs/Structs.sol';

// Imports related to Pythia 1 ZK Proving Scheme
import {Pythia1Verifier, Pythia1Lib, Pythia1Claim, Pythia1ProofData, Pythia1ProofInput, Pythia1GroupProperties} from '../libs/Pythia1Lib.sol';

/**
 * @title Pythia-1 Base Attester
 * @author Sismo
 * @notice Abstract contract that facilitates the use of the Pythia-1 ZK Proving Scheme.
 * Pythia-1: it allows issuing attestations from an offchain service and send it onchain 
 * without anyone being able to make the link between the offchain service and the onchain service.
 * It is inherited by the family of Pythia-1 attesters.
 * It contains the user input checking and the ZK-SNARK proof verification.
 * We invite readers to refer to:
 *    - https://pythia-1.docs.sismo.io for a full guide through the Pythia-1 ZK Attestations
 *    - https://pythia-1-circuits.docs.sismo.io for circuits, prover and verifiers of Pythia-1
 
 
 **/
abstract contract Pythia1Base is IPythia1Base, Initializable {
  using Pythia1Lib for Pythia1ProofData;

  // ZK-SNARK Verifier
  Pythia1Verifier immutable VERIFIER;

  /*******************************************************
    INITIALIZATION FUNCTIONS                           
  *******************************************************/
  /**
   * @dev Constructor. Initializes the contract
   * @param Pythia1VerifierAddress ZK Snark Verifier contract
   */
  constructor(address Pythia1VerifierAddress) {
    VERIFIER = Pythia1Verifier(Pythia1VerifierAddress);
  }

  /**
   * @dev Getter of Pythia-1 Verifier contract
   */
  function getVerifier() external view returns (Pythia1Verifier) {
    return VERIFIER;
  }

  /**
   * @dev Getter of the Commitment signer Eddsa Public key
   */
  function getCommitmentSignerPubKey() external view returns (uint256[2] memory) {
    return _getCommitmentSignerPubKey();
  }

  /*******************************************************
    Pythia-1 SPECIFIC FUNCTIONS
  *******************************************************/

  /**
   * @dev MANDATORY: must be implemented to return the ticket identifier from a user request
   * so it can be checked against snark input
   * ticket = hash(secretHash, ticketIdentifier), which is verified inside the snark
   * the secretHash is a number only known by the user and is used in 
   * the zero knowledge as a private input which guarantees privacy

   * This function MUST be implemented by Pythia-1 attesters.
   * This is the core function that implements the logic of tickets

   * Do they get one ticket per claim?
   * Do they get 2 tickets per claim?
   * Do they get 1 ticket per claim, every month?
   * Take a look at Pythia-1 Simple Attester for an example
   * @param claim user claim: a particular claim that a user have that he can prove s right.
   */
  function _getTicketIdentifierOfClaim(Pythia1Claim memory claim)
    internal
    view
    virtual
    returns (uint256);

  /**
   * @dev MANDATORY: must be implemented to return the commitment signer that allows to
   * prove the claim was correctly issued for the user.
   */
  function _getCommitmentSignerPubKey() internal view virtual returns (uint256[2] memory);

  /**
   * @dev Checks whether the user claim and the snark public input are a match
   * @param claim user claim
   * @param input snark public input
   */
  function _validateInput(Pythia1Claim memory claim, Pythia1ProofInput memory input)
    internal
    view
    virtual
  {
    if (input.groupId != claim.groupId) revert GroupIdMismatch(claim.groupId, input.groupId);

    if (input.isStrict == claim.groupProperties.isScore)
      revert IsStrictMismatch(claim.groupProperties.isScore, input.isStrict);

    if (input.destination != claim.destination)
      revert DestinationMismatch(claim.destination, input.destination);

    if (claim.destination != msg.sender)
      revert UserShouldOwnItsDestination(msg.sender, claim.destination);

    if (input.chainId != block.chainid) revert ChainIdMismatch(block.chainid, input.chainId);

    if (input.value != claim.claimedValue) revert ValueMismatch(claim.claimedValue, input.value);

    uint256[2] memory commitmentSignerPubKey = _getCommitmentSignerPubKey();
    if (
      input.commitmentSignerPubKey[0] != commitmentSignerPubKey[0] ||
      input.commitmentSignerPubKey[1] != commitmentSignerPubKey[1]
    )
      revert CommitmentSignerPubKeyMismatch(
        commitmentSignerPubKey[0],
        commitmentSignerPubKey[1],
        input.commitmentSignerPubKey[0],
        input.commitmentSignerPubKey[1]
      );

    uint256 ticketIdentifier = _getTicketIdentifierOfClaim(claim);

    if (input.ticketIdentifier != ticketIdentifier)
      revert TicketIdentifierMismatch(ticketIdentifier, input.ticketIdentifier);
  }

  /**
   * @dev verify the plonk mathematical proof using the circom verifier contract
   * @param proofData snark public input
   */
  function _verifyProof(Pythia1ProofData memory proofData) internal view virtual {
    try
      VERIFIER.verifyProof(proofData.proof.a, proofData.proof.b, proofData.proof.c, proofData.input)
    returns (bool success) {
      if (!success) revert InvalidGroth16Proof('');
    } catch Error(string memory reason) {
      revert InvalidGroth16Proof(reason);
    } catch Panic(
      uint256 /*errorCode*/
    ) {
      revert InvalidGroth16Proof('');
    } catch (
      bytes memory /*lowLevelData*/
    ) {
      revert InvalidGroth16Proof('');
    }
  }
}
