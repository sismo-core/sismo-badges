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
import {TagLib} from '../utils/TagLib.sol';

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
  using TagLib for uint256;
  using TagLib for uint8;

  /**
   * @dev Returns whether an attestationsCollection has a specific tag referenced by its index
   * @param collectionId Collection Id of the targeted attestationsCollection
   * @param tagIndex Index of the tag. Can go from 0 to 63.
   */
  function hasAttestationsCollectionTag(uint256 collectionId, uint8 tagIndex)
    external
    view
    returns (bool)
  {
    uint256 currentTags = _attestationsCollectionTagsBitmap[collectionId];
    return currentTags._hasTag(tagIndex);
  }

  function hasAttestationsCollectionTags(uint256 collectionId, uint8[] memory tagIndex)
    external
    view
    returns (bool)
  {
    uint256 currentTags = _attestationsCollectionTagsBitmap[collectionId];
    for (uint256 i = 0; i < tagIndex.length; i++) {
      if (!currentTags._hasTag(tagIndex[i])) {
        return false;
      }
    }
    return true;
  }

  /**
   * @dev Returns the tag's power (from 1 to 7) of an attestationsCollection
   * @param collectionId Collection Id of the targeted attestationsCollection
   * @param tagIndex Index of the tag. Can go from 0 to 63.
   */
  function getAttestationsCollectionTagPower(uint256 collectionId, uint8 tagIndex)
    external
    view
    returns (uint8)
  {
    uint256 currentTags = _attestationsCollectionTagsBitmap[collectionId];
    return currentTags._getTagPower(tagIndex);
  }

  function getAttestationsCollectionTagsPower(uint256 collectionId, uint8[] memory tagIndex)
    external
    view
    returns (uint8[] memory)
  {
    uint256 currentTags = _attestationsCollectionTagsBitmap[collectionId];
    uint8[] memory tagsPower = new uint8[](tagIndex.length);
    for (uint256 i = 0; i < tagIndex.length; i++) {
      tagsPower[i] = currentTags._getTagPower(tagIndex[i]);
    }
    return tagsPower;
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
   * @dev Register a tag for an attestationsCollection. The tag should be already created.
   * @param collectionId Collection Id of the targeted attestationsCollection
   * @param tagIndex Index of the tag
   * @param tagPower Power associated to the tag. Can take the value 1 to 7
   */
  function registerAttestationsCollectionTag(
    uint256 collectionId,
    uint8 tagIndex,
    uint8 tagPower
  ) external onlyOwner {
    _registerAttestationsCollectionTag(collectionId, tagIndex, tagPower);
  }

  function registerAttestationsCollectionTags(
    uint256[] memory collectionIds,
    uint8[] memory tagIndices,
    uint8[] memory tagPowers
  ) external onlyOwner {
    if (collectionIds.length != tagIndices.length || collectionIds.length != tagPowers.length) {
      revert ArgsLengthDoesNotMatch();
    }

    for (uint256 i = 0; i < collectionIds.length; i++) {
      _registerAttestationsCollectionTag(collectionIds[i], tagIndices[i], tagPowers[i]);
    }
  }

  /**
   * @dev Unregister a tag for an attestationsCollection
   * @param collectionId Collection Id of the targeted attestationsCollection
   * @param tagIndex Index of the tag
   */
  function unregisterAttestationsCollectionTag(uint256 collectionId, uint8 tagIndex)
    external
    onlyOwner
  {
    _unregisterAttestationsCollectionTag(collectionId, tagIndex);
  }

  function unregisterAttestationsCollectionTags(
    uint256[] memory collectionIds,
    uint8[] memory tagIndices
  ) external onlyOwner {
    if (collectionIds.length != tagIndices.length) {
      revert ArgsLengthDoesNotMatch();
    }

    for (uint256 i = 0; i < collectionIds.length; i++) {
      _unregisterAttestationsCollectionTag(collectionIds[i], tagIndices[i]);
    }
  }

  /**
   * @dev Create a new tag.
   * @param tagIndex Index of the tag. Can go from 0 to 63.
   * @param tagName Name in bytes32 of the tag
   */
  function createNewTag(uint8 tagIndex, bytes32 tagName) external onlyOwner {
    _createNewTag(tagIndex, tagName);
  }

  function createNewTags(uint8[] memory tagIndices, bytes32[] memory tagNames) external onlyOwner {
    if (tagIndices.length != tagNames.length) {
      revert ArgsLengthDoesNotMatch();
    }

    for (uint256 i = 0; i < tagIndices.length; i++) {
      _createNewTag(tagIndices[i], tagNames[i]);
    }
  }

  /**
   * @dev Update the name of an existing tag
   * @param tagIndex Index of the tag. Can go from 0 to 63. The tag must exist
   * @param newTagName new name in bytes32 of the tag
   */
  function updateTagName(uint8 tagIndex, bytes32 newTagName) external onlyOwner {
    _updateTagName(tagIndex, newTagName);
  }

  function updateTagNames(uint8[] memory tagIndices, bytes32[] memory newTagNames)
    external
    onlyOwner
  {
    if (tagIndices.length != newTagNames.length) {
      revert ArgsLengthDoesNotMatch();
    }

    for (uint256 i = 0; i < tagIndices.length; i++) {
      _updateTagName(tagIndices[i], newTagNames[i]);
    }
  }

  /**
   * @dev Delete an existing tag
   * @param tagIndex Index of the tag. Can go from 0 to 63. The tag must exist
   */
  function deleteTag(uint8 tagIndex) external onlyOwner {
    _deleteTag(tagIndex);
  }

  function deleteTags(uint8[] memory tagIndices) external onlyOwner {
    for (uint256 i = 0; i < tagIndices.length; i++) {
      _deleteTag(tagIndices[i]);
    }
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

  function _isAuthorized(address issuer, uint256 collectionId) internal view returns (bool) {
    return _authorizedRanges[issuer]._includes(collectionId);
  }

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


  function _registerAttestationsCollectionTag(
    uint256 collectionId,
    uint8 tagIndex,
    uint8 tagPower
  ) internal {
    if (_tags[tagIndex] == 0) {
      revert TagDoesNotExist(tagIndex);
    }

    uint256 currentTags = _attestationsCollectionTagsBitmap[collectionId];

    _attestationsCollectionTagsBitmap[collectionId] = currentTags._addTag(tagIndex, tagPower);

    emit AttestationsCollectionTagRegistered(collectionId, tagIndex, tagPower);
  }

  function _unregisterAttestationsCollectionTag(uint256 collectionId, uint8 tagIndex) internal {
    uint256 currentTags = _attestationsCollectionTagsBitmap[collectionId];

    _attestationsCollectionTagsBitmap[collectionId] = currentTags._removeTag(tagIndex);

    emit AttestationsCollectionTagUnregistered(collectionId, tagIndex);
  }


  function _createNewTag(uint8 tagIndex, bytes32 tagName) internal {
    if (_tags[tagIndex] != 0) {
      revert TagAlreadyExists(tagIndex);
    }
    tagIndex._checkTagIndexIsValid();

    _tags[tagIndex] = tagName;

    emit NewTagInserted(tagIndex, tagName);
  }

  function _updateTagName(uint8 tagIndex, bytes32 newtagName) internal {
    if (_tags[tagIndex] == 0) {
      revert TagDoesNotExist(tagIndex);
    }
    tagIndex._checkTagIndexIsValid();

    _tags[tagIndex] = newtagName;

    emit TagNameUpdated(tagIndex, newtagName);
  }

  function _deleteTag(uint8 tagIndex) internal {
    if (_tags[tagIndex] == 0) {
      revert TagDoesNotExist(tagIndex);
    }

    delete _tags[tagIndex];

    emit TagDeleted(tagIndex);
  }
}
