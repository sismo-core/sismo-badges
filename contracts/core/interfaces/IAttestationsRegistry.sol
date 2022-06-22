// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

import {Attestation, AttestationData} from '../libs/Structs.sol';

/**
 * @title IAttestationsRegistry
 * @author Sismo
 * @notice This is the interface of the AttestationRegistry
 */
interface IAttestationsRegistry {
  event AttestationRecorded(Attestation attestation);
  event AttestationDeleted(Attestation attestation);

  /**
   * @dev Main function to be called by authorized issuers
   * @param attestations Attestations to be recorded (creates a new one or overrides an existing one)
   */
  function recordAttestations(Attestation[] calldata attestations) external;

  /**
   * @dev Delete function to be called by authorized issuers
   * @param attestations Attestations to be deleted
   */
  function deleteAttestations(Attestation[] calldata attestations) external;

  /**
   * @dev Returns whether a user has an attestation from a collection
   * @param collectionId Collection identifier of the targeted attestation
   * @param owner Owner of the targeted attestation
   */
  function hasAttestation(uint256 collectionId, address owner) external returns (bool);

  /**
   * @dev Getter of the data of a specific attestation
   * @param collectionId Collection identifier of the targeted attestation
   * @param owner Owner of the targeted attestation
   */
  function getAttestationData(uint256 collectionId, address owner)
    external
    view
    returns (AttestationData memory);

  /**
   * @dev Getter of the value of a specific attestation
   * @param collectionId Collection identifier of the targeted attestation
   * @param owner Owner of the targeted attestation
   */
  function getAttestationValue(uint256 collectionId, address owner) external view returns (uint256);

  /**
   * @dev Getter of the data of a specific attestation as tuple
   * @param collectionId Collection identifier of the targeted attestation
   * @param owner Owner of the targeted attestation
   */
  function getAttestationDataTuple(uint256 collectionId, address owner)
    external
    view
    returns (
      address,
      uint256,
      uint32,
      bytes memory
    );

  /**
   * @dev Getter of the extraData of a specific attestation
   * @param collectionId Collection identifier of the targeted attestation
   * @param owner Owner of the targeted attestation
   */
  function getAttestationExtraData(uint256 collectionId, address owner)
    external
    view
    returns (bytes memory);

  /**
   * @dev Getter of the issuer of a specific attestation
   * @param collectionId Collection identifier of the targeted attestation
   * @param owner Owner of the targeted attestation
   */
  function getAttestationIssuer(uint256 collectionId, address owner)
    external
    view
    returns (address);

  /**
   * @dev Getter of the timestamp of a specific attestation
   * @param collectionId Collection identifier of the targeted attestation
   * @param owner Owner of the targeted attestation
   */
  function getAttestationTimestamp(uint256 collectionId, address owner)
    external
    view
    returns (uint32);

  /**
   * @dev Getter of the data of specific attestations
   * @param collectionIds Collection identifiers of the targeted attestations
   * @param owners Owners of the targeted attestations
   */
  function getAttestationDataBatch(uint256[] memory collectionIds, address[] memory owners)
    external
    view
    returns (AttestationData[] memory);

  /**
   * @dev Getter of the values of specific attestations
   * @param collectionIds Collection identifiers of the targeted attestations
   * @param owners Owners of the targeted attestations
   */
  function getAttestationValueBatch(uint256[] memory collectionIds, address[] memory owners)
    external
    view
    returns (uint256[] memory);
}
