// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

import {Ownable} from '@openzeppelin/contracts/access/Ownable.sol';
import {IAvailableRootsRegistry} from './interfaces/IAvailableRootsRegistry.sol';
import {Initializable} from '@openzeppelin/contracts/proxy/utils/Initializable.sol';

/**
 * @title Attesters Groups Registry
 * @author Sismo
 * @notice This contract stores that data required by attesters to be available so they can verify user claims
 * This contract is deployed behind a proxy and this implementation is focused on storing merkle roots
 * For more information: https://available-roots-registry.docs.sismo.io
 *
 **/
contract AvailableRootsRegistry is IAvailableRootsRegistry, Initializable, Ownable {
  uint8 public constant IMPLEMENTATION_VERSION = 2;

  mapping(address => mapping(uint256 => bool)) public _roots;

  /**
   * @dev Constructor
   * @param owner Owner of the contract, can register/ unregister roots
   */
  constructor(address owner) {
    initialize(owner);
  }

  /**
   * @dev Initializes the contract, to be called by the proxy delegating calls to this implementation
   * @param owner Owner of the contract, can update public key and address
   * @notice The reinitializer modifier is needed to configure modules that are added through upgrades and that require initialization.
   */
  function initialize(address owner) public reinitializer(VERSION) {
    _transferOwnership(owner);
  }

  /**
   * @dev Register a root available for an attester
   * @param attester Attester which will have the root available
   * @param root Root to register
   */
  function registerRootForAttester(address attester, uint256 root) external onlyOwner {
    if (attester == address(0)) revert CannotRegisterForZeroAddress();
    _registerRootForAttester(attester, root);
  }

  /**
   * @dev Unregister a root for an attester
   * @param attester Attester which will no longer have the root available
   * @param root Root to unregister
   */
  function unregisterRootForAttester(address attester, uint256 root) external onlyOwner {
    if (attester == address(0)) revert CannotUnregisterForZeroAddress();
    _unregisterRootForAttester(attester, root);
  }

  /**
   * @dev Registers a root, available for all contracts
   * @param root Root to register
   */
  function registerRootForAll(uint256 root) external onlyOwner {
    _registerRootForAttester(address(0), root);
  }

  /**
   * @dev Unregister a root, available for all contracts
   * @param root Root to unregister
   */
  function unregisterRootForAll(uint256 root) external onlyOwner {
    _unregisterRootForAttester(address(0), root);
  }

  /**
   * @dev returns whether a root is available for a caller (msg.sender)
   * @param root root to check whether it is registered for me or not
   */
  function isRootAvailableForMe(uint256 root) external view returns (bool) {
    return _roots[_msgSender()][root] || _roots[address(0)][root];
  }

  /**
   * @dev Initializes the contract, to be called by the proxy delegating calls to this implementation
   * @param attester Owner of the contract, can update public key and address
   * @param root Owner of the contract, can update public key and address
   */
  function isRootAvailableForAttester(address attester, uint256 root) external view returns (bool) {
    return _roots[attester][root] || _roots[address(0)][root];
  }

  function _registerRootForAttester(address attester, uint256 root) internal {
    _roots[attester][root] = true;
    if (attester == address(0)) {
      emit RegisteredRootForAll(root);
    } else {
      emit RegisteredRootForAttester(attester, root);
    }
  }

  function _unregisterRootForAttester(address attester, uint256 root) internal {
    _roots[attester][root] = false;
    if (attester == address(0)) {
      emit UnregisteredRootForAll(root);
    } else {
      emit UnregisteredRootForAttester(attester, root);
    }
  }
}
