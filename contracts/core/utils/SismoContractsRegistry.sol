// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

import {Ownable} from '@openzeppelin/contracts/access/Ownable.sol';
import {Initializable} from '@openzeppelin/contracts/proxy/utils/Initializable.sol';
import {AttestationsRegistry} from '../AttestationsRegistry.sol';
import {Badges} from '../Badges.sol';
import {Front} from '../Front.sol';
import {HydraS1AccountboundAttester} from '../../attesters/hydra-s1/HydraS1AccountboundAttester.sol';

contract SismoContractsRegistry is Initializable, Ownable {
  uint8 public constant IMPLEMENTATION_VERSION = 1;
  // keeping some space for future upgrade
  uint256[20] private _placeHoldersContractsRegistry;

  address private _badges;
  address private _attestationsRegistry;
  address private _front;
  address private _hydraS1AccountboundAttester;

  constructor(address ownerAddress) {
    initialize(ownerAddress);
  }

  function initialize(address ownerAddress) public reinitializer(IMPLEMENTATION_VERSION) {
    // if proxy did not setup owner yet or if called by constructor (for implem setup)
    if (owner() == address(0) || address(this).code.length == 0) {
      _transferOwnership(ownerAddress);
    }
  }

  function getBadges() external view returns (Badges) {
    return Badges(_badges);
  }

  function getAttestationsRegistry() external view returns (AttestationsRegistry) {
    return AttestationsRegistry(_attestationsRegistry);
  }

  function getFront() external view returns (Front) {
    return Front(_front);
  }

  function getHydraS1AccountboundAttester() external view returns (HydraS1AccountboundAttester) {
    return HydraS1AccountboundAttester(_hydraS1AccountboundAttester);
  }

  function setBadges(address badgesAddress) external onlyOwner {
    _setBadges(badgesAddress);
  }

  function setAttestationsRegistry(address attestationsRegistryAddress) external onlyOwner {
    _setAttestationsRegistry(attestationsRegistryAddress);
  }

  function setFront(address frontAddress) external onlyOwner {
    _setFront(frontAddress);
  }

  function setHydraS1AccountboundAttester(
    address hydraS1AccountboundAttesterAddress
  ) external onlyOwner {
    _hydraS1AccountboundAttester = address(hydraS1AccountboundAttesterAddress);
  }

  function setbatchAddresses(
    address badgesAddress,
    address attestationsRegistryAddress,
    address frontAddress,
    address hydraS1AccountboundAttesterAddress
  ) external onlyOwner {
    _setBadges(badgesAddress);
    _setFront(frontAddress);
    _setAttestationsRegistry(attestationsRegistryAddress);
    _setHydraS1AccountboundAttester(hydraS1AccountboundAttesterAddress);
  }

  function _setFront(address frontAddress) internal {
    _front = address(frontAddress);
  }

  function _setBadges(address badgesAddress) internal {
    _badges = address(badgesAddress);
  }

  function _setAttestationsRegistry(address attestationsRegistryAddress) internal {
    _attestationsRegistry = address(attestationsRegistryAddress);
  }

  function _setHydraS1AccountboundAttester(address hydraS1AccountboundAttesterAddress) internal {
    _hydraS1AccountboundAttester = address(hydraS1AccountboundAttesterAddress);
  }
}
