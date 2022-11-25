// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

/*
 * Each tag is encoded on 4 bits in the 256-bit bitmap.
 * The 4 bits encode the tag's power (from 0 to 15) 
 * If the power is 0, the tag is disabled. 

     tag63               tag2         tag1         tag0
   ┌────────────┐      ┌────────────┬────────────┬────────────┐
   │ 1  1  1  1 │ .... │ 1  0  1  1 │ 0  0  0  0 │ 1  0  0  1 │
   └────────────┘      └────────────┴────────────┴────────────┘
      power 15             power 11     power 0      power 1
    
  * There is a total of 64 tags.
  * The tag index must be between 0 and 63.
  * The tag power must be between 0 and 15.
  * An enabled tag will always have a power greater than 0.
  * A disabled tag will always have a power equal to 0.
 **/

library TagLib {
  uint256 constant MAX_INT = 2**256 - 1;

  error TagIndexOutOfBounds(uint8 tagIndex);
  error TagPowerOutOfBounds(uint8 power);

  /**
   * @dev Check if a tag, referenced by its tagIndex, is enabled in a uint256 number
   * @param tagIndex index of the tag. Can be between 0 and 63
   */
  function _hasTag(uint256 self, uint8 tagIndex) internal pure returns (bool hashTag) {
    uint256 currentTags = self;
    uint8 tagPower = _getTagPower(currentTags, tagIndex);
    // Check if the power of the tag is above 0, if yes the tag is enabled
    return (tagPower) > 0;
  }

  /**
   * @dev Return the power of tag, referenced by its tagIndex, of a uint256 number
   * @param tagIndex index of the tag. Can be between 0 and 63
   */
  function _getTagPower(uint256 self, uint8 tagIndex) internal pure returns (uint8 tagPower) {
    uint256 currentTags = self;
    // Get the tag's 4 bits by shifting the tagIndex to the right
    uint256 shifted = currentTags >> (4 * tagIndex);
    // Get the tag power by masking the 4 bits encoding the power
    return uint8(shifted & (2**4 - 1));
  }

  /**
   * @dev Add a tag to a uint256 number
   * @param tagIndex index of the tag. Can be between 0 and 63
   * @param tagPower power of the tag. Can be between 0 and 15
   */
  function _addTag(
    uint256 self,
    uint8 tagIndex,
    uint8 tagPower
  ) internal pure returns (uint256 tags) {
    _checkTagIndexIsValid(tagIndex);
    _checkTagPowerIsValid(tagPower);

    uint256 currentTags = self;
    // first we need to remove the current tag power
    uint256 newTags = _removeTag(currentTags, tagIndex);
    // Create the tag's 4 bits and shift them to the left to the tagIndex position
    uint256 tagMask = uint256(tagPower) << (4 * tagIndex);
    // Apply an OR operation between the currentTags number and the tagMask to reference new power
    return newTags | tagMask;
  }

  /**
   * @dev Remove a tag to a uint256 number
   * @param tagIndex index of the tag. Can be between 0 and 63
   */
  function _removeTag(uint256 self, uint8 tagIndex) internal pure returns (uint256 tags) {
    _checkTagIndexIsValid(tagIndex);

    uint256 currentTags = self;
    // Shift 4 bits (1111 mask) to the left to the tagIndex position
    uint256 tagMask = (2**4 - 1) << (4 * tagIndex);
    // Apply a XOR operation to a have a mask with all bits set to 1 except the tag bits to remove
    uint256 negativeTagMask = MAX_INT ^ tagMask;
    // Apply a AND operation with the current number to remove the tag bits
    return currentTags & negativeTagMask;
  }

  /**
   * @dev Check if a tagIndex is valid (is between 0 and 63)
   * @param tagIndex index of the tag
   */
  function _checkTagIndexIsValid(uint8 tagIndex) internal pure {
    if (tagIndex > 63) {
      revert TagIndexOutOfBounds(tagIndex);
    }
  }

  /**
   * @dev Check if a tagPower is valid (is between 0 and 15)
   * @param tagPower index of the tag
   */
  function _checkTagPowerIsValid(uint8 tagPower) internal pure {
    if (tagPower > 15) {
      revert TagPowerOutOfBounds(tagPower);
    }
  }
}
