// SPDX-License-Identifier: MIT

pragma solidity ^0.8.14;

/**
 * @title IAvailableRootsRegistry
 * @notice Interface for (Merkle) Roots Registry
 */
interface IIncrementalMerkleTree {
  // The event emitted when a leaf is successfully added to the tree
  event LeafAdded(uint256 indexed leaf);

  /**
   * Inserts a leaf to the incremental merkle tree
   * @param _leaf - The value to insert. It must be less than the snark scalar field or this function will throw.
   * @return The leaf index
   */
  function addLeaf(uint256 _leaf) external returns (uint256);

  /**
   * Checks if a given root is in the recent history
   * @param _root - The root we are looking for
   * @return true if the _root is present in the root history, false otherwise
   */
  function isKnownRoot(uint256 _root) external view returns (bool);

  /**
   * @return the last root
   */
  function getLastRoot() external view returns (uint256);
}
