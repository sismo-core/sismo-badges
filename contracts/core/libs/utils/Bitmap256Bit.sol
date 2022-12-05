// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

/*
 * The 256-bit bitmap is structured in 64 chuncks of 4 bits each.
 * The 4 bits can encode any value from 0 to 15.

    chunck63            chunck2      chunck1      chunck0
    bits                bits         bits         bits 
   ┌────────────┐      ┌────────────┬────────────┬────────────┐
   │ 1  1  1  1 │ .... │ 1  0  1  1 │ 0  0  0  0 │ 0  0  0  1 │
   └────────────┘      └────────────┴────────────┴────────────┘
      value 15            value 11     value 0      value 1

  * A chunck index must be between 0 and 63.
  * A value must be between 0 and 15.
 **/

library Bitmap256Bit {
  uint256 constant MAX_INT = 2 ** 256 - 1;

  error IndexOutOfBounds(uint8 index);
  error ValueOutOfBounds(uint8 value);

  /**
   * @dev Return the value at a given index of a 256-bit bitmap
   * @param index index where the value can be found. Can be between 0 and 63
   */
  function _get(uint256 self, uint8 index) internal pure returns (uint8) {
    uint256 currentValues = self;
    // Get the encoded 4-bit value by right shifting to the `index` position
    uint256 shifted = currentValues >> (4 * index);
    // Get the value by only masking the last 4 bits with an AND operator
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
    // 1. first we need to remove the current value for the inputed `index`
    // Left Shift 4 bits mask (1111 mask) to the `index` position
    uint256 mask = (2 ** 4 - 1) << (4 * index);
    // Apply a XOR operation to obtain a mask with all bits set to 1 except the 4 bits that we want to remove
    uint256 negativeMask = MAX_INT ^ mask;
    // Apply a AND operation between the current values and the negative mask to remove the wanted bits
    uint256 newValues = currentValues & negativeMask;

    // 2. We set the new value wanted at the `index` position
    // Create the 4 bits encoding the new value and left shift them to the `index` position
    uint256 newValueMask = uint256(value) << (4 * index);
    // Apply an OR operation between the current values and the newValueMask to reference new value
    return newValues | newValueMask;
  }

  /**
   * @dev Get all the non-zero values in a 256-bit bitmap
   * @param self a 256-bit bitmap
   */
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
   * @dev Check if the index is valid (is between 0 and 63)
   * @param index index of a chunck
   */
  function _checkIndexIsValid(uint8 index) internal pure {
    if (index > 63) {
      revert IndexOutOfBounds(index);
    }
  }

  /**
   * @dev Check if the value is valid (is between 0 and 15)
   * @param value value to encode in a chunck
   */
  function _checkValueIsValid(uint8 value) internal pure {
    if (value > 15) {
      revert ValueOutOfBounds(value);
    }
  }
}
