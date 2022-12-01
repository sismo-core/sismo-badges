// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

/**
 * @title IAvailableRootsRegistry
 * @author Sismo
 * @notice Interface for (Merkle) Roots Registry
 */
interface IAvailableRootsRegistry {
  event RegisteredRootForAttester(address attester, uint256 root);
  event RegisteredRootForAll(uint256 root);
  event UnregisteredRootForAttester(address attester, uint256 root);
  event UnregisteredRootForAll(uint256 root);

  error CannotRegisterForZeroAddress();
  error CannotUnregisterForZeroAddress();

  /**
   * @dev Initializes the contract, to be called by the proxy delegating calls to this implementation
   * @param owner Owner of the contract, can update public key and address
   * @param version Version of the implementation
   */
  function initialize(address owner, uint8 version) external;

  /**
   * @dev Register a root available for an attester
   * @param attester Attester which will have the root available
   * @param root Root to register
   */
  function registerRootForAttester(address attester, uint256 root) external;

  /**
   * @dev Unregister a root for an attester
   * @param attester Attester which will no longer have the root available
   * @param root Root to unregister
   */
  function unregisterRootForAttester(address attester, uint256 root) external;

  /**
   * @dev Registers a root, available for all contracts
   * @param root Root to register
   */
  function registerRootForAll(uint256 root) external;

  /**
   * @dev Unregister a root, available for all contracts
   * @param root Root to unregister
   */
  function unregisterRootForAll(uint256 root) external;

  /**
   * @dev returns whether a root is available for a caller (msg.sender)
   * @param root root to check whether it is registered for me or not
   */
  function isRootAvailableForMe(uint256 root) external view returns (bool);

  /**
   * @dev Initializes the contract, to be called by the proxy delegating calls to this implementation
   * @param attester Owner of the contract, can update public key and address
   * @param root Owner of the contract, can update public key and address
   */
  function isRootAvailableForAttester(address attester, uint256 root) external view returns (bool);
}
