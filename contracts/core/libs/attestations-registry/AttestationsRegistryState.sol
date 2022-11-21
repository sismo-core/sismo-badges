// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Range} from '../utils/RangeLib.sol';
import {Attestation, AttestationData} from '../Structs.sol';

contract AttestationsRegistryState {
  // main config
  bool internal _initialized;
  bool internal _initializing;
  bool internal _paused;
  address internal _owner;
  // Storing the attribute name for each attributes index
  mapping(uint8 => bytes32) internal _attributesNames;
  // keeping some space for future
  uint256[14] private _placeHolders;

  // storing the authorized ranges for each attesters
  mapping(address => Range[]) internal _authorizedRanges;
  // Storing the attributes values used for each attestations collection
  // Each attribute value is an hexadecimal
  mapping(uint256 => uint256) internal _attestationsCollectionAttributesValuesBitmap;
  // keeping some space for future
  uint256[14] private _placeHolders2;
  // storing the data of attestations
  // =collectionId=> =owner=> attestationData
  mapping(uint256 => mapping(address => AttestationData)) internal _attestationsData;
}
