// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

/*
 * Each attribute is encoded on 4 bits in the 256-bit bitmap.
 * The 4 bits encode the attribute's value (from 0 to 15) 
 * If the value is 0, the attribute is disabled. 

    attribute63         attribute2   attribute1   attribute0
    bits                bits         bits         bits 
   ┌────────────┐      ┌────────────┬────────────┬────────────┐
   │ 1  1  1  1 │ .... │ 1  0  1  1 │ 0  0  0  0 │ 1  0  0  1 │
   └────────────┘      └────────────┴────────────┴────────────┘
      value 15            value 11     value 0      value 1
    
  * There is a total of 64 attributes.
  * The attribute index must be between 0 and 63.
  * The attribute value must be between 0 and 15.
  * An enabled attribute will always have a value greater than 0.
  * A disabled attribute will always have a value equal to 0.
 **/

library Bitmap256Bit {
  uint256 constant MAX_INT = 2 ** 256 - 1;

  error AttributeIndexOutOfBounds(uint8 attributeIndex);
  error AttributeValueOutOfBounds(uint8 value);

  /**
   * @dev Return the value at a given index of a 256-bit bitmap
   * @param index index where the value can be found. Can be between 0 and 63
   */
  function _get(uint256 self, uint8 index) internal pure returns (uint8) {
    uint256 currentValues = self;
    // Get the encode 4-bit value by right shifting to the `index` position
    uint256 shifted = currentValues >> (4 * index);
    // Get the value by only masking the last 4 bits with and AND operator
    return uint8(shifted & (2 ** 4 - 1));
  }

  /**
   * @dev Set a value at a chosen index in a 256-bit bitmap
   * @param index index where the value will be stored. Can be between 0 and 63
   * @param value value to store. Can be between 0 and 15
   */
  function _set(uint256 self, uint8 index, uint8 value) internal pure returns (uint256) {
    _checkIndexIsValid(index);
    _checkValueIsValid(value);

    uint256 currentValues = self;
    // 1. first we need to remove the value for the inputed index
    uint256 newValues = _remove(currentValues, index);
    // Create the 4 bits encoding the attribute value and left shift them to the `index` position
    uint256 newValueMask = uint256(value) << (4 * index);
    // Apply an OR operation between the current values and the newValueMask to reference new value
    return newValues | newValueMask;
  }

  /**
   * @dev Remove a value in a 256-bit bitmap
   * @param index index of the value to remove. Can be between 0 and 63
   */
  function _remove(uint256 self, uint8 index) internal pure returns (uint256) {
    _checkIndexIsValid(index);

    uint256 currentValues = self;
    // Left Shift 4 bits mask (1111 mask) to the `index` position
    uint256 mask = (2 ** 4 - 1) << (4 * index);
    // Apply a XOR operation to obtain a mask with all bits set to 1 except the 4 bits that we want to remove
    uint256 negativeMask = MAX_INT ^ mask;
    // Apply a AND operation between the current values and the negative mask to remove the wanted bits
    return currentValues & negativeMask;
  }

  function _getAllNonZeroValues(
    uint256 self
  ) internal pure returns (uint8[] memory, uint8[] memory, uint8) {
    uint8[] memory indices = new uint8[](64);
    uint8[] memory values = new uint8[](64);
    uint8 nbOfNonZeroValues = 0;
    for (uint8 i = 0; i < 63; i++) {
      uint8 value = _get(self, i);
      if (value > 0) {
        indices[nbOfNonZeroValues] = i;
        values[nbOfNonZeroValues] = value;
        nbOfNonZeroValues++;
      }
    }
    return (indices, values, nbOfNonZeroValues);
  }

  /**
   * @dev Check if the index of an attribute is valid (is between 0 and 63)
   * @param index index of the attribute
   */
  function _checkIndexIsValid(uint8 index) internal pure {
    if (index > 63) {
      revert AttributeIndexOutOfBounds(index);
    }
  }

  /**
   * @dev Check if the value of an attribute is valid (is between 0 and 15)
   * @param value value of the attribute
   */
  function _checkValueIsValid(uint8 value) internal pure {
    if (value > 15) {
      revert AttributeValueOutOfBounds(value);
    }
  }
}
