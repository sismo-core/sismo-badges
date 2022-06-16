// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

import {Request, Attestation} from '../libs/Structs.sol';

/**
 * @title IFront
 * @author Sismo
 * @notice This is the interface of the Front Contract
 */
interface IFront {
  error DifferentRequestsDestinations();
  event EarlyUserAttestationGenerated(address destination);

  /**
   * @dev Forward a request to an attester and generates an early user attestation
   * @param attester Attester targeted by the request
   * @param request Request sent to the attester
   * @param proofData Data provided to the attester to back the request
   */
  function generateAttestations(
    address attester,
    Request calldata request,
    bytes calldata proofData
  ) external;

  /**
   * @dev generate multiple attestations at once, to the same destination
   * @param attesters Attesters targeted by the attesters
   * @param requests Requests sent to attester
   * @param dataArray Data sent with each request
   */
  function generateBatchAttestations(
    address[] calldata attesters,
    Request[] calldata requests,
    bytes[] calldata dataArray
  ) external;
}
