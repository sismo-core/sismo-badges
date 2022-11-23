// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

import {Request, Attestation} from '../libs/Structs.sol';
import {IAttestationsRegistry} from '../interfaces/IAttestationsRegistry.sol';

/**
 * @title IAttester
 * @author Sismo
 * @notice This is the interface for the attesters in Sismo Protocol
 */
interface IAttester {
  event AttestationGenerated(Attestation attestation);

  event AttestationDeleted(Attestation attestation);

  error AttestationDeletionNotImplemented();

  /**
   * @dev Main external function. Allows to generate attestations by making a request and submitting proof
   * @param request User request
   * @param proofData Data sent along the request to prove its validity
   * @return attestations Attestations that has been recorded
   */
  function generateAttestations(Request calldata request, bytes calldata proofData)
    external
    returns (Attestation[] memory);

  /**
   * @dev External facing function. Allows to delete an attestation by submitting proof
   * @param collectionIds Collection identifier of attestations to delete
   * @param attestationsOwner Owner of attestations to delete
   * @param proofData Data sent along the deletion request to prove its validity
   * @return attestations Attestations that was deleted
   */
  function deleteAttestations(
    uint256[] calldata collectionIds,
    address attestationsOwner,
    bytes calldata proofData
  ) external returns (Attestation[] memory);

  /**
   * @dev MANDATORY: must be implemented in attesters
   * It should build attestations from the user request and the proof
   * @param request User request
   * @param proofData Data sent along the request to prove its validity
   * @return attestations Attestations that will be recorded
   */
  function buildAttestations(Request calldata request, bytes calldata proofData)
    external
    view
    returns (Attestation[] memory);

  /**
   * @dev Attestation registry address getter
   * @return attestationRegistry Address of the registry
   */
  function getAttestationRegistry() external view returns (IAttestationsRegistry);
}
