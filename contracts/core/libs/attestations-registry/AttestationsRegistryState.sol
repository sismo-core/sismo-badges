// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

import {Range} from '../utils/RangeLib.sol';
import {Attestation, AttestationData} from '../Structs.sol';

contract AttestationsRegistryState {
  // main config
  bool internal _initialized;
  bool internal _initializing;
  bool internal _paused;
  address internal _owner;
  // Storing the tag name for each tags index
  mapping(uint256 => bytes32) internal _tags;
  // keeping some space for future
  uint256[14] private _placeHolders;

  // storing the authorized ranges for each attesters
  mapping(address => Range[]) internal _authorizedRanges;
  // Storing the tags used for each attestations collection
  // Each tag is an hexadecimal containing the info if the
  // tag is enabled and the tag power
  mapping(uint256 => uint256) internal _attestationsCollectionTagsBitmap;
  // keeping some space for future
  uint256[14] private _placeHolders2;
  // storing the data of attestations
  // =collectionId=> =owner=> attestationData
  mapping(uint256 => mapping(address => AttestationData)) internal _attestationsData;
}
