// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

struct Range {
  uint256 min;
  uint256 max;
}

// Range [0;3] includees 0 and 3
library RangeUtils {
  function _includes(Range[] storage ranges, uint256 collectionId) internal view returns (bool) {
    for (uint256 i = 0; i < ranges.length; i++) {
      if (collectionId >= ranges[i].min && collectionId <= ranges[i].max) {
        return true;
      }
    }
    return false;
  }
}
