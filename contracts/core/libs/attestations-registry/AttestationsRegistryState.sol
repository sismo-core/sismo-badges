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
  // keeping some space for future
  uint256[15] private _placeHolders;

  // storing the authorized ranges for each attesters
  mapping(address => Range[]) internal _authorizedRanges;
  // keeping some space for future
  uint256[15] private _placeHolders2;
  // storing the data of attestations
  // =collectionId=> =owner=> attestationData
  mapping(uint256 => mapping(address => AttestationData)) internal _attestationsData;
}
