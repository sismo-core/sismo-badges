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
}
