// SPDX-License-Identifier: MIT
// Forked from, removed storage, OpenZeppelin Contracts v4.4.1 (access/Ownable.sol)
// OpenZeppelin Contracts v4.4.1 (access/Ownable.sol)

pragma solidity ^0.8.14;

import {Range, RangeUtils} from '../libs/utils/RangeLib.sol';

interface IAttestationsRegistryConfigLogic {
  error AttesterNotFound(address issuer);
  error RangeIndexOutOfBounds(address issuer, uint256 expectedArrayLength, uint256 rangeIndex);
  error IdsMismatch(
    address issuer,
    uint256 rangeIndex,
    uint256 expectedFirstId,
    uint256 expectedLastId,
    uint256 FirstId,
    uint256 lastCollectionId
  );
  error TagDoesNotExist(uint8 tagIndex);
  error TagAlreadyExists(uint8 tagIndex);
  error ArgsLengthDoesNotMatch();

  event NewTagCreated(uint8 tagIndex, bytes32 tagName);
  event TagNameUpdated(uint8 tagIndex, bytes32 newTagName, bytes32 previousTagName);
  event TagDeleted(uint8 tagIndex, bytes32 deletedTagName);

  event AttestationsCollectionTagSet(uint256 collectionId, uint8 tagIndex, uint8 tagPower);

  event IssuerAuthorized(address issuer, uint256 firstCollectionId, uint256 lastCollectionId);
  event IssuerUnauthorized(address issuer, uint256 firstCollectionId, uint256 lastCollectionId);

  /**
   * @dev Returns all the tags (in the form of a bitmap) for a specific attestationsCollection
   * @param collectionId Collection Id of the targeted attestationsCollection
   */
  function getTagsBitmapForAttestationsCollection(uint256 collectionId)
    external
    view
    returns (uint256);

  /**
   * @dev Returns whether an attestationsCollection has a specific tag referenced by its index
   * @param collectionId Collection Id of the targeted attestationsCollection
   * @param tagIndex Index of the tag. Can go from 0 to 63.
   */
  function attestationsCollectionHasTag(uint256 collectionId, uint8 tagIndex)
    external
    view
    returns (bool);

  function attestationsCollectionHasTags(uint256 collectionId, uint8[] memory tagIndex)
    external
    view
    returns (bool);

  /**
   * @dev Returns the tag's power (from 1 to 7) of an attestationsCollection
   * @param collectionId Collection Id of the targeted attestationsCollection
   * @param tagIndex Index of the tag. Can go from 0 to 63.
   */
  function getTagPowerForAttestationsCollection(uint256 collectionId, uint8 tagIndex)
    external
    view
    returns (uint8);

  function getTagsPowerForAttestationsCollection(uint256 collectionId, uint8[] memory tagIndex)
    external
    view
    returns (uint8[] memory);

  /**
   * @dev Set a tag for an attestationsCollection. The tag should be already created.
   * @param collectionId Collection Id of the targeted attestationsCollection
   * @param tagIndex Index of the tag
   * @param tagPower Power associated to the tag. Can take the value 1 to 7
   */
  function setTagForAttestationsCollection(
    uint256 collectionId,
    uint8 tagIndex,
    uint8 tagPower
  ) external;

  function setTagsForAttestationsCollection(
    uint256[] memory collectionIds,
    uint8[] memory tagIndices,
    uint8[] memory tagPowers
  ) external;

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
  ) external;

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
  ) external;

  /**
   * @dev Authorize an issuer for specific ranges
   * @param issuer Issuer that will be authorized
   * @param ranges Ranges for which the issuer will be authorized
   */
  function authorizeRanges(address issuer, Range[] memory ranges) external;

  /**
   * @dev Unauthorize an issuer for specific ranges
   * @param issuer Issuer that will be unauthorized
   * @param ranges Ranges for which the issuer will be unauthorized
   */
  function unauthorizeRanges(
    address issuer,
    Range[] memory ranges,
    uint256[] memory rangeIndexes
  ) external;

  /**
   * @dev Returns whether a specific issuer is authorized or not to record in a specific attestations collection
   * @param issuer Issuer to be checked
   * @param collectionId Collection Id for which the issuer will be checked
   */
  function isAuthorized(address issuer, uint256 collectionId) external view returns (bool);

  /**
   * @dev Pauses the registry. Issuers can no longer record or delete attestations
   */
  function pause() external;

  /**
   * @dev Unpauses the registry
   */
  function unpause() external;

  /**
   * @dev Create a new tag.
   * @param tagIndex Index of the tag. Can go from 0 to 63.
   * @param tagName Name in bytes32 of the tag
   */
  function createNewTag(uint8 tagIndex, bytes32 tagName) external;

  function createNewTags(uint8[] memory tagIndices, bytes32[] memory tagNames) external;

  /**
   * @dev Update the name of an existing tag
   * @param tagIndex Index of the tag. Can go from 0 to 63. The tag must exist
   * @param newTagName new name in bytes32 of the tag
   */
  function updateTagName(uint8 tagIndex, bytes32 newTagName) external;

  function updateTagsName(uint8[] memory tagIndices, bytes32[] memory newTagNames) external;

  /**
   * @dev Delete an existing tag
   * @param tagIndex Index of the tag. Can go from 0 to 63. The tag must exist
   */
  function deleteTag(uint8 tagIndex) external;

  function deleteTags(uint8[] memory tagIndices) external;
}
