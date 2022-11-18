// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

/*
 * Tags are added
 *
 *
 **/

library TagLib {
  uint256 constant MAX_INT = 2**256 - 1;

  error TagIndexOutOfBounds(uint8 tagIndex);
  error TagPowerOutOfBounds(uint8 power);

  function _hasTag(uint256 self, uint8 tagIndex) internal pure returns (bool hashTag) {
    uint256 currentTags = self;
    uint256 shifted = currentTags >> (4 * tagIndex + 3);
    return (shifted & 1) == 1;
  }

  function _getTagPower(uint256 self, uint8 tagIndex) internal pure returns (uint8 tagPower) {
    uint256 currentTags = self;
    uint256 shifted = currentTags >> (4 * tagIndex);
    return uint8(shifted & (2**3 - 1));
  }

  function _addTag(
    uint256 self,
    uint8 tagIndex,
    uint8 tagPower
  ) internal pure returns (uint256 tags) {
    _checkTagIndexIsValid(tagIndex);
    _checkTagPowerIsValid(tagPower);
    // 2^3 + tagPower shifted
    uint256 currentTags = self;
    uint256 tagMask = uint256(2**3 + tagPower) << (4 * tagIndex);

    return currentTags | tagMask;
  }

  function _removeTag(uint256 self, uint8 tagIndex) internal pure returns (uint256 tags) {
    _checkTagIndexIsValid(tagIndex);

    uint256 currentTags = self;
    uint256 tagMask = (2**4 - 1) << (4 * tagIndex);
    // XOR operation
    uint256 negativeTagMask = MAX_INT ^ tagMask;

    return currentTags & negativeTagMask;
  }

  function _checkTagIndexIsValid(uint8 tagIndex) internal pure {
    if (tagIndex > 63) {
      revert TagIndexOutOfBounds(tagIndex);
    }
  }

  function _checkTagPowerIsValid(uint8 tagPower) internal pure {
    if (tagPower > 7) {
      revert TagPowerOutOfBounds(tagPower);
    }
  }
}
