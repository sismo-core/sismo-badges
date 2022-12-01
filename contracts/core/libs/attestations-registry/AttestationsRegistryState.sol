// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Range} from '../utils/RangeLib.sol';
import {Attestation, AttestationData} from '../Structs.sol';

contract AttestationsRegistryState {
  /*******************************************************
    Storage layout:
    19 slots for config
      5 currently used for _initialized, _initializing, _paused, _owner and _attributesNames
      14 place holders
    16 slots for logic
      2 currently used for _authorizedRanges, _attestationsCollectionAttributesValuesBitmap
      14 place holders
    1 slot for _attestationsData 
  *******************************************************/

  // main config
  // changed `_initialized` from bool to uint8
  // as we were using OpenZeppelin Contracts (last updated v4.5.0) (proxy/utils/Initializable.sol)
  // and changed to OpenZeppelin Contracts (last updated v4.8.0) (proxy/utils/Initializable.sol)
  // PR: https://github.com/sismo-core/sismo-protocol/pull/41
  uint8 internal _initialized;
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
