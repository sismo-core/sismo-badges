// SPDX-License-Identifier: MIT
// Forked from, removed storage, OpenZeppelin Contracts v4.4.1 (access/Ownable.sol)
// OpenZeppelin Contracts v4.4.1 (access/Ownable.sol)

pragma solidity ^0.8.14;

import './OwnableLogic.sol';
import './PausableLogic.sol';
import './InitializableLogic.sol';
import './AttestationsRegistryState.sol';
import {IAttestationsRegistryConfigLogic} from './../../interfaces/IAttestationsRegistryConfigLogic.sol';
import {Range, RangeUtils} from '../utils/RangeLib.sol';
import {Bitmap256Bit} from '../utils/Bitmap256Bit.sol';

/**
 * @title Attestations Registry Config Logic contract
 * @author Sismo
 * @notice Holds the logic of how to authorize/ unauthorize issuers of attestations in the registry
 **/
contract AttestationsRegistryConfigLogic is
  AttestationsRegistryState,
  IAttestationsRegistryConfigLogic,
  OwnableLogic,
  PausableLogic,
  InitializableLogic
{
  using RangeUtils for Range[];
  using Bitmap256Bit for uint256;
  using Bitmap256Bit for uint8;

  /******************************************
   *
   *    ATTESTATIONS COLLECTION CORE LOGIC
   *
   *****************************************/

  /**
   * @dev Set a value for an attribute of an attestationsCollection. The attribute should already be created.
   * @param collectionId Collection Id of the targeted attestationsCollection
   * @param index Index of the attribute (must be between 0 and 63)
   * @param value Value of the attribute we want to set for this attestationsCollection. Can take the value 0 to 15
   */
  function setAttributeValueForAttestationsCollection(
    uint256 collectionId,
    uint8 index,
    uint8 value
  ) public onlyOwner {
    index._checkIndexIsValid();

    if (!_isAttributeCreated(index)) {
      revert AttributeDoesNotExist(index);
    }

    _setAttributeForAttestationsCollection(collectionId, index, value);
  }

  function setAttributesValuesForAttestationsCollections(
    uint256[] memory collectionIds,
    uint8[] memory indices,
    uint8[] memory values
  ) external onlyOwner {
    if (collectionIds.length != indices.length || collectionIds.length != values.length) {
      revert ArgsLengthDoesNotMatch();
    }
    for (uint256 i = 0; i < collectionIds.length; i++) {
      setAttributeValueForAttestationsCollection(collectionIds[i], indices[i], values[i]);
    }
  }

  /**
   * @dev Returns the attribute's value (from 0 to 15) of an attestationsCollection
   * @param collectionId Collection Id of the targeted attestationsCollection
   * @param index Index of the attribute. Can go from 0 to 63.
   */
  function getAttributeValueForAttestationsCollection(
    uint256 collectionId,
    uint8 index
  ) public view returns (uint8) {
    uint256 currentAttributesValues = _getAttributesValuesBitmapForAttestationsCollection(
      collectionId
    );
    return currentAttributesValues._get(index);
  }

  function getAttributesValuesForAttestationsCollection(
    uint256 collectionId,
    uint8[] memory indices
  ) external view returns (uint8[] memory) {
    uint8[] memory attributesValues = new uint8[](indices.length);
    for (uint256 i = 0; i < indices.length; i++) {
      attributesValues[i] = getAttributeValueForAttestationsCollection(collectionId, indices[i]);
    }
    return attributesValues;
  }

  /**
   * @dev Returns whether an attestationsCollection has a specific attribute referenced by its index
   * @param collectionId Collection Id of the targeted attestationsCollection
   * @param index Index of the attribute. Can go from 0 to 63.
   */
  function attestationsCollectionHasAttribute(
    uint256 collectionId,
    uint8 index
  ) public view returns (bool) {
    uint256 currentAttributeValues = _getAttributesValuesBitmapForAttestationsCollection(
      collectionId
    );
    return currentAttributeValues._get(index) > 0;
  }

  function attestationsCollectionHasAttributes(
    uint256 collectionId,
    uint8[] memory indices
  ) external view returns (bool) {
    for (uint256 i = 0; i < indices.length; i++) {
      if (!attestationsCollectionHasAttribute(collectionId, indices[i])) {
        return false;
      }
    }
    return true;
  }

  /**
   * @dev Returns all the enabled attributes names and their values for a specific attestationsCollection
   * @param collectionId Collection Id of the targeted attestationsCollection
   */
  function getAttributesNamesAndValuesForAttestationsCollection(
    uint256 collectionId
  ) public view returns (bytes32[] memory, uint8[] memory) {
    uint256 currentAttributesValues = _getAttributesValuesBitmapForAttestationsCollection(
      collectionId
    );

    (
      uint8[] memory indices,
      uint8[] memory values,
      uint8 nbOfNonZeroValues
    ) = currentAttributesValues._getAllNonZeroValues();

    bytes32[] memory attributesNames = new bytes32[](nbOfNonZeroValues);
    uint8[] memory attributesValues = new uint8[](nbOfNonZeroValues);
    for (uint8 i = 0; i < nbOfNonZeroValues; i++) {
      attributesNames[i] = _attributesNames[indices[i]];
      attributesValues[i] = values[i];
    }

    return (attributesNames, attributesValues);
  }

  /**
   * @dev Authorize an issuer for a specific range
   * @param issuer Issuer that will be authorized
   * @param firstCollectionId First collection Id of the range for which the issuer will be authorized
   * @param lastCollectionId Last collection Id of the range for which the issuer will be authorized
   */
  function authorizeRange(
    address issuer,
    uint256 firstCollectionId,
    uint256 lastCollectionId
  ) external override onlyOwner {
    _authorizeRange(issuer, firstCollectionId, lastCollectionId);
  }

  /**
   * @dev Unauthorize an issuer for a specific range
   * @param issuer Issuer that will be unauthorized
   * @param rangeIndex Index of the range to be unauthorized
   * @param firstCollectionId First collection Id of the range for which the issuer will be unauthorized
   * @param lastCollectionId Last collection Id of the range for which the issuer will be unauthorized
   */
  function unauthorizeRange(
    address issuer,
    uint256 rangeIndex,
    uint256 firstCollectionId,
    uint256 lastCollectionId
  ) external override onlyOwner {
    _unauthorizeRange(issuer, rangeIndex, firstCollectionId, lastCollectionId);
  }

  /**
   * @dev Authorize an issuer for specific ranges
   * @param issuer Issuer that will be authorized
   * @param ranges Ranges for which the issuer will be authorized
   */
  function authorizeRanges(address issuer, Range[] memory ranges) external override onlyOwner {
    for (uint256 i = 0; i < ranges.length; i++) {
      _authorizeRange(issuer, ranges[i].min, ranges[i].max);
    }
  }

  /**
   * @dev Unauthorize an issuer for specific ranges
   * @param issuer Issuer that will be unauthorized
   * @param ranges Ranges for which the issuer will be unauthorized
   */
  function unauthorizeRanges(
    address issuer,
    Range[] memory ranges,
    uint256[] memory rangeIndexes
  ) external override onlyOwner {
    for (uint256 i = 0; i < rangeIndexes.length; i++) {
      _unauthorizeRange(issuer, rangeIndexes[i] - i, ranges[i].min, ranges[i].max);
    }
  }

  /**
   * @dev Returns whether a specific issuer is authorized or not to record in a specific attestations collection
   * @param issuer Issuer to be checked
   * @param collectionId Collection Id for which the issuer will be checked
   */
  function isAuthorized(address issuer, uint256 collectionId) external view returns (bool) {
    return _isAuthorized(issuer, collectionId);
  }

  /**
   * @dev Pauses the registry. Issuers can no longer record or delete attestations
   */
  function pause() external override onlyOwner {
    _pause();
  }

  /**
   * @dev Unpauses the registry
   */
  function unpause() external override onlyOwner {
    _unpause();
  }

  /*****************************
   *
   *   ATTRIBUTES CORE LOGIC
   *
   *****************************/

  /**
   * @dev Create a new attribute.
   * @param index Index of the attribute. Can go from 0 to 63.
   * @param name Name in bytes32 of the attribute
   */
  function createNewAttribute(uint8 index, bytes32 name) public onlyOwner {
    index._checkIndexIsValid();
    if (_isAttributeCreated(index)) {
      revert AttributeAlreadyExists(index);
    }
    _createNewAttribute(index, name);
  }

  function createNewAttributes(uint8[] memory indices, bytes32[] memory names) external onlyOwner {
    if (indices.length != names.length) {
      revert ArgsLengthDoesNotMatch();
    }

    for (uint256 i = 0; i < indices.length; i++) {
      createNewAttribute(indices[i], names[i]);
    }
  }

  /**
   * @dev Update the name of an existing attribute
   * @param index Index of the attribute. Can go from 0 to 63. The attribute must exist
   * @param newName new name in bytes32 of the attribute
   */
  function updateAttributeName(uint8 index, bytes32 newName) public onlyOwner {
    index._checkIndexIsValid();
    if (!_isAttributeCreated(index)) {
      revert AttributeDoesNotExist(index);
    }
    _updateAttributeName(index, newName);
  }

  function updateAttributesName(
    uint8[] memory indices,
    bytes32[] memory newNames
  ) external onlyOwner {
    if (indices.length != newNames.length) {
      revert ArgsLengthDoesNotMatch();
    }

    for (uint256 i = 0; i < indices.length; i++) {
      updateAttributeName(indices[i], newNames[i]);
    }
  }

  /**
   * @dev Delete an existing attribute
   * @param index Index of the attribute. Can go from 0 to 63. The attribute must already exist
   */
  function deleteAttribute(uint8 index) public onlyOwner {
    index._checkIndexIsValid();
    if (!_isAttributeCreated(index)) {
      revert AttributeDoesNotExist(index);
    }
    _deleteAttribute(index);
  }

  function deleteAttributes(uint8[] memory indices) external onlyOwner {
    for (uint256 i = 0; i < indices.length; i++) {
      deleteAttribute(indices[i]);
    }
  }

  /*****************************
   *
   *      INTERNAL FUNCTIONS
   *
   *****************************/

  function _authorizeRange(
    address issuer,
    uint256 firstCollectionId,
    uint256 lastCollectionId
  ) internal {
    Range memory newRange = Range(firstCollectionId, lastCollectionId);
    _authorizedRanges[issuer].push(newRange);
    emit IssuerAuthorized(issuer, firstCollectionId, lastCollectionId);
  }

  function _unauthorizeRange(
    address issuer,
    uint256 rangeIndex,
    uint256 firstCollectionId,
    uint256 lastCollectionId
  ) internal onlyOwner {
    if (rangeIndex >= _authorizedRanges[issuer].length)
      revert RangeIndexOutOfBounds(issuer, _authorizedRanges[issuer].length, rangeIndex);

    uint256 expectedFirstId = _authorizedRanges[issuer][rangeIndex].min;
    uint256 expectedLastId = _authorizedRanges[issuer][rangeIndex].max;
    if (firstCollectionId != expectedFirstId || lastCollectionId != expectedLastId)
      revert IdsMismatch(
        issuer,
        rangeIndex,
        expectedFirstId,
        expectedLastId,
        firstCollectionId,
        lastCollectionId
      );

    _authorizedRanges[issuer][rangeIndex] = _authorizedRanges[issuer][
      _authorizedRanges[issuer].length - 1
    ];
    _authorizedRanges[issuer].pop();
    emit IssuerUnauthorized(issuer, firstCollectionId, lastCollectionId);
  }

  function _isAuthorized(address issuer, uint256 collectionId) internal view returns (bool) {
    return _authorizedRanges[issuer]._includes(collectionId);
  }

  function _setAttributeForAttestationsCollection(
    uint256 collectionId,
    uint8 index,
    uint8 value
  ) internal {
    uint256 currentAttributes = _getAttributesValuesBitmapForAttestationsCollection(collectionId);

    _attestationsCollectionAttributesValuesBitmap[collectionId] = currentAttributes._set(
      index,
      value
    );

    emit AttestationsCollectionAttributeSet(collectionId, index, value);
  }

  function _createNewAttribute(uint8 index, bytes32 name) internal {
    _attributesNames[index] = name;

    emit NewAttributeCreated(index, name);
  }

  function _updateAttributeName(uint8 index, bytes32 newName) internal {
    bytes32 previousName = _attributesNames[index];

    _attributesNames[index] = newName;

    emit AttributeNameUpdated(index, newName, previousName);
  }

  function _deleteAttribute(uint8 index) internal {
    bytes32 deletedName = _attributesNames[index];

    delete _attributesNames[index];

    emit AttributeDeleted(index, deletedName);
  }

  function _getAttributesValuesBitmapForAttestationsCollection(
    uint256 collectionId
  ) internal view returns (uint256) {
    return _attestationsCollectionAttributesValuesBitmap[collectionId];
  }

  function _isAttributeCreated(uint8 index) internal view returns (bool) {
    if (_attributesNames[index] == 0) {
      return false;
    }
    return true;
  }
}
