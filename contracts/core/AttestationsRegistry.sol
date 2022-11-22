// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

import {IAttestationsRegistry} from './interfaces/IAttestationsRegistry.sol';
import {AttestationsRegistryConfigLogic} from './libs/attestations-registry/AttestationsRegistryConfigLogic.sol';
import {AttestationsRegistryState} from './libs/attestations-registry/AttestationsRegistryState.sol';
import {Range, RangeUtils} from './libs/utils/RangeLib.sol';
import {Attestation, AttestationData} from './libs/Structs.sol';
import {IBadges} from './interfaces/IBadges.sol';

/**
 * @title Attestations Registry
 * @author Sismo
 * @notice Main contract of Sismo, stores all recorded attestations in attestations collections
 * Only authorized attestations issuers can record attestation in the registry
 * Attesters that expect to record in the Attestations Registry must be authorized issuers
 * For more information: https://attestations-registry.docs.sismo.io

 * For each attestation recorded, a badge is received by the user
 * The badge is the Non transferrable NFT representation of an attestation 
 * Its ERC1155 contract is stateless, balances are read directly from the registry. Badge balances <=> Attestations values
 * After the creation or update of an attestation, the registry triggers a TransferSingle event from the ERC1155 Badges contracts
 * It enables off-chain apps such as opensea to catch the "shadow mint" of the badge
 **/
contract AttestationsRegistry is
  AttestationsRegistryState,
  IAttestationsRegistry,
  AttestationsRegistryConfigLogic
{
  IBadges immutable BADGES;

  /**
   * @dev Constructor.
   * @param owner Owner of the contract, has the right to authorize/unauthorize attestations issuers
   * @param badgesAddress Stateless ERC1155 Badges contract
   */
  constructor(address owner, address badgesAddress) {
    initialize(owner);
    BADGES = IBadges(badgesAddress);
  }

  /**
   * @dev Initialize function, to be called by the proxy delegating calls to this implementation
   * @param owner Owner of the contract, has the right to authorize/unauthorize attestations issuers
   */
  function initialize(address owner) public initializer {
    _transferOwnership(owner);
  }

  /**
   * @dev Main function to be called by authorized issuers
   * @param attestations Attestations to be recorded (creates a new one or overrides an existing one)
   */
  function recordAttestations(Attestation[] calldata attestations) external override whenNotPaused {
    address issuer = _msgSender();
    for (uint256 i = 0; i < attestations.length; i++) {
      if (!_isAuthorized(issuer, attestations[i].collectionId))
        revert IssuerNotAuthorized(issuer, attestations[i].collectionId);

      uint256 previousAttestationValue = _attestationsData[attestations[i].collectionId][
        attestations[i].owner
      ].value;

      _attestationsData[attestations[i].collectionId][attestations[i].owner] = AttestationData(
        attestations[i].issuer,
        attestations[i].value,
        attestations[i].timestamp,
        attestations[i].extraData
      );

      _triggerBadgeTransferEvent(
        attestations[i].collectionId,
        attestations[i].owner,
        previousAttestationValue,
        attestations[i].value
      );
      emit AttestationRecorded(attestations[i]);
    }
  }

  /**
   * @dev Delete function to be called by authorized issuers
   * @param owners The owners of the attestations to be deleted
   * @param collectionIds The collection ids of the attestations to be deleted
   */
  function deleteAttestations(
    address[] calldata owners,
    uint256[] calldata collectionIds
  ) external override whenNotPaused {
    if (owners.length != collectionIds.length)
      revert OwnersAndCollectionIdsLengthMismatch(owners, collectionIds);

    address issuer = _msgSender();
    for (uint256 i = 0; i < owners.length; i++) {
      AttestationData memory attestationData = _attestationsData[collectionIds[i]][owners[i]];

      if (!_isAuthorized(issuer, collectionIds[i]))
        revert IssuerNotAuthorized(issuer, collectionIds[i]);
      delete _attestationsData[collectionIds[i]][owners[i]];

      _triggerBadgeTransferEvent(collectionIds[i], owners[i], attestationData.value, 0);

      emit AttestationDeleted(
        Attestation(
          collectionIds[i],
          owners[i],
          attestationData.issuer,
          attestationData.value,
          attestationData.timestamp,
          attestationData.extraData
        )
      );
    }
  }

  /**
   * @dev Returns whether a user has an attestation from a collection
   * @param collectionId Collection identifier of the targeted attestation
   * @param owner Owner of the targeted attestation
   */
  function hasAttestation(
    uint256 collectionId,
    address owner
  ) external view override returns (bool) {
    return _getAttestationValue(collectionId, owner) != 0;
  }

  /**
   * @dev Getter of the data of a specific attestation
   * @param collectionId Collection identifier of the targeted attestation
   * @param owner Owner of the targeted attestation
   */
  function getAttestationData(
    uint256 collectionId,
    address owner
  ) external view override returns (AttestationData memory) {
    return _getAttestationData(collectionId, owner);
  }

  /**
   * @dev Getter of the value of a specific attestation
   * @param collectionId Collection identifier of the targeted attestation
   * @param owner Owner of the targeted attestation
   */
  function getAttestationValue(
    uint256 collectionId,
    address owner
  ) external view override returns (uint256) {
    return _getAttestationValue(collectionId, owner);
  }

  /**
   * @dev Getter of the data of a specific attestation as tuple
   * @param collectionId Collection identifier of the targeted attestation
   * @param owner Owner of the targeted attestation
   */
  function getAttestationDataTuple(
    uint256 collectionId,
    address owner
  ) external view override returns (address, uint256, uint32, bytes memory) {
    AttestationData memory attestationData = _attestationsData[collectionId][owner];
    return (
      attestationData.issuer,
      attestationData.value,
      attestationData.timestamp,
      attestationData.extraData
    );
  }

  /**
   * @dev Getter of the extraData of a specific attestation
   * @param collectionId Collection identifier of the targeted attestation
   * @param owner Owner of the targeted attestation
   */
  function getAttestationExtraData(
    uint256 collectionId,
    address owner
  ) external view override returns (bytes memory) {
    return _attestationsData[collectionId][owner].extraData;
  }

  /**
   * @dev Getter of the issuer of a specific attestation
   * @param collectionId Collection identifier of the targeted attestation
   * @param owner Owner of the targeted attestation
   */
  function getAttestationIssuer(
    uint256 collectionId,
    address owner
  ) external view override returns (address) {
    return _attestationsData[collectionId][owner].issuer;
  }

  /**
   * @dev Getter of the timestamp of a specific attestation
   * @param collectionId Collection identifier of the targeted attestation
   * @param owner Owner of the targeted attestation
   */
  function getAttestationTimestamp(
    uint256 collectionId,
    address owner
  ) external view override returns (uint32) {
    return _attestationsData[collectionId][owner].timestamp;
  }

  /**
   * @dev Getter of the data of specific attestations
   * @param collectionIds Collection identifiers of the targeted attestations
   * @param owners Owners of the targeted attestations
   */
  function getAttestationDataBatch(
    uint256[] memory collectionIds,
    address[] memory owners
  ) external view override returns (AttestationData[] memory) {
    AttestationData[] memory attestationsDataArray = new AttestationData[](collectionIds.length);
    for (uint256 i = 0; i < collectionIds.length; i++) {
      attestationsDataArray[i] = _getAttestationData(collectionIds[i], owners[i]);
    }
    return attestationsDataArray;
  }

  /**
   * @dev Getter of the values of specific attestations
   * @param collectionIds Collection identifiers of the targeted attestations
   * @param owners Owners of the targeted attestations
   */
  function getAttestationValueBatch(
    uint256[] memory collectionIds,
    address[] memory owners
  ) external view override returns (uint256[] memory) {
    uint256[] memory attestationsValues = new uint256[](collectionIds.length);
    for (uint256 i = 0; i < collectionIds.length; i++) {
      attestationsValues[i] = _getAttestationValue(collectionIds[i], owners[i]);
    }
    return attestationsValues;
  }

  /**
   * @dev Function that trigger a TransferSingle event from the stateless ERC1155 Badges contract
   * It enables off-chain apps such as opensea to catch the "shadow mints/burns" of badges
   */
  function _triggerBadgeTransferEvent(
    uint256 badgeTokenId,
    address owner,
    uint256 previousValue,
    uint256 newValue
  ) internal {
    bool isGreaterValue = newValue > previousValue;
    address operator = address(this);
    address from = isGreaterValue ? address(0) : owner;
    address to = isGreaterValue ? owner : address(0);
    uint256 value = isGreaterValue ? newValue - previousValue : previousValue - newValue;

    // if isGreaterValue is true, function triggers mint event. Otherwise triggers burn event.
    BADGES.triggerTransferEvent(operator, from, to, badgeTokenId, value);
  }

  function _getAttestationData(
    uint256 collectionId,
    address owner
  ) internal view returns (AttestationData memory) {
    return (_attestationsData[collectionId][owner]);
  }

  function _getAttestationValue(
    uint256 collectionId,
    address owner
  ) internal view returns (uint256) {
    return _attestationsData[collectionId][owner].value;
  }
}
