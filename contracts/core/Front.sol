// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

import {IFront} from './interfaces/IFront.sol';
import {IAttester} from './interfaces/IAttester.sol';
import {IAttestationsRegistry} from './interfaces/IAttestationsRegistry.sol';
import {Request, Attestation} from './libs/Structs.sol';

/**
 * @title Front
 * @author Sismo
 * @notice This is the Front contract of the Sismo protocol
 * Behind a proxy, it routes attestations request to the targeted attester and can perform some actions
 * This specific implementation rewards early users with a early user attestation if they used sismo before ethcc conference

 * For more information: https://front.docs.sismo.io
 */
contract Front is IFront {
  IAttestationsRegistry public immutable ATTESTATIONS_REGISTRY;
  uint256 public constant EARLY_USER_COLLECTION = 0;
  uint32 public constant ETHCC_TIMESTAMP = 1658494044;

  /**
   * @dev Constructor
   * @param attestationsRegistryAddress Attestations registry contract address
   */
  constructor(address attestationsRegistryAddress) {
    ATTESTATIONS_REGISTRY = IAttestationsRegistry(attestationsRegistryAddress);
  }

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
  ) external returns (Attestation[] memory) {
    Attestation[] memory attestations = _forwardAttestationsGeneration(
      attester,
      request,
      proofData
    );
    _generateEarlyUserAttestation(request.destination);
    return attestations;
  }

  /**
   * @dev generate multiple attestations at once, to the same destination, generates an early user attestation
   * @param attesters Attesters targeted by the attesters
   * @param requests Requests sent to attester
   * @param dataArray Data sent with each request
   */
  function batchGenerateAttestations(
    address[] calldata attesters,
    Request[] calldata requests,
    bytes[] calldata dataArray
  ) external {
    address destination = requests[0].destination;
    for (uint256 i = 0; i < attesters.length; i++) {
      if (requests[i].destination != destination) revert DifferentRequestsDestinations();
      _forwardAttestationsGeneration(attesters[i], requests[i], dataArray[i]);
    }
    _generateEarlyUserAttestation(destination);
  }

  /**
   * @dev build the attestations from a user request targeting a specific attester.
   * Forwards to the build function of targeted attester
   * @param attester Targeted attester
   * @param request User request
   * @param proofData Data sent along the request to prove its validity
   * @return attestations Attestations that will be recorded
   */
  function buildAttestations(
    address attester,
    Request calldata request,
    bytes calldata proofData
  ) external view override returns (Attestation[] memory) {
    return _forwardAttestationsBuild(attester, request, proofData);
  }

  function _forwardAttestationsBuild(
    address attester,
    Request calldata request,
    bytes calldata proofData
  ) internal view returns (Attestation[] memory) {
    return IAttester(attester).buildAttestations(request, proofData);
  }

  function _forwardAttestationsGeneration(
    address attester,
    Request calldata request,
    bytes calldata proofData
  ) internal returns (Attestation[] memory) {
    return IAttester(attester).generateAttestations(request, proofData);
  }

  function _generateEarlyUserAttestation(address destination) internal {
    uint32 currentTimestamp = uint32(block.timestamp);
    if (currentTimestamp < ETHCC_TIMESTAMP) {
      bool alreadyHasAttestation = ATTESTATIONS_REGISTRY.hasAttestation(
        EARLY_USER_COLLECTION,
        destination
      );

      if (!alreadyHasAttestation) {
        Attestation[] memory attestations = new Attestation[](1);
        attestations[0] = Attestation(
          EARLY_USER_COLLECTION,
          destination,
          address(this),
          1,
          currentTimestamp,
          'With strong love from Sismo'
        );
        ATTESTATIONS_REGISTRY.recordAttestations(attestations);
        emit EarlyUserAttestationGenerated(destination);
      }
    }
  }
}
