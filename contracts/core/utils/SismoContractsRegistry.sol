// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

import {Ownable} from '@openzeppelin/contracts/access/Ownable.sol';
import {Initializable} from '@openzeppelin/contracts/proxy/utils/Initializable.sol';
import {AttestationsRegistry} from '../AttestationsRegistry.sol';
import {Badges} from '../Badges.sol';
import {Front} from '../Front.sol';
import {HydraS1AccountboundAttester} from '../../attesters/hydra-s1/HydraS1AccountboundAttester.sol';
import {AvailableRootsRegistry} from '../../periphery/utils/AvailableRootsRegistry.sol';
import {CommitmentMapperRegistry} from '../../periphery/utils/CommitmentMapperRegistry.sol';
import {Pythia1SimpleAttester} from '../../attesters/pythia-1/Pythia1SimpleAttester.sol';

contract SismoContractsRegistry is Initializable, Ownable {
  uint8 public constant IMPLEMENTATION_VERSION = 1;
  // keeping some space for future upgrade
  uint256[20] private _placeHoldersContractsRegistry;

  address private _badges;
  address private _attestationsRegistry;
  address private _front;
  address private _hydraS1AccountboundAttester;
  address private _availableRootsRegistry;
  address private _commitmentMapperRegistry;
  address private _synapsPythia1SimpleAttester;

  event BadgesSet(address badgesAddress);
  event AttestationsRegistrySet(address attestationsRegistryAddress);
  event FrontSet(address frontAddress);
  event HydraS1AccountboundAttesterSet(address hydraS1AccountboundAttesterAddress);
  event AvailableRootsRegistrySet(address availableRootsRegistryAddress);
  event CommitmentMapperRegistrySet(address commitmentMapperRegistryAddress);
  event SynapsPythia1SimpleAttesterSet(address synapsPythia1SimpleAttesterAddress);

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

  function getAvailableRootsRegistry() external view returns (AvailableRootsRegistry) {
    return AvailableRootsRegistry(_availableRootsRegistry);
  }

  function getCommitmentMapperRegistry() external view returns (CommitmentMapperRegistry) {
    return CommitmentMapperRegistry(_commitmentMapperRegistry);
  }

  function getSynapsPythia1SimpleAttester() external view returns (Pythia1SimpleAttester) {
    return Pythia1SimpleAttester(_synapsPythia1SimpleAttester);
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
    _setHydraS1AccountboundAttester(hydraS1AccountboundAttesterAddress);
  }

  function setAvailableRootsRegistry(address availableRootsRegistryAddress) external onlyOwner {
    _setAvailableRootsRegistry(availableRootsRegistryAddress);
  }

  function setCommitmentMapperRegistry(address commitmentMapperRegistryAddress) external onlyOwner {
    _setCommitmentMapperRegistry(commitmentMapperRegistryAddress);
  }

  function setSynapsPythia1SimpleAttester(
    address synapsPythia1SimpleAttesterAddress
  ) external onlyOwner {
    _setSynapsPythia1SimpleAttester(synapsPythia1SimpleAttesterAddress);
  }

  function setbatchAddresses(
    address badgesAddress,
    address attestationsRegistryAddress,
    address frontAddress,
    address hydraS1AccountboundAttesterAddress,
    address availableRootsRegistryAddress,
    address commitmentMapperRegistryAddress,
    address synapsPythia1SimpleAttesterAddress
  ) external onlyOwner {
    _setBadges(badgesAddress);
    _setFront(frontAddress);
    _setAttestationsRegistry(attestationsRegistryAddress);
    _setHydraS1AccountboundAttester(hydraS1AccountboundAttesterAddress);
    _setAvailableRootsRegistry(availableRootsRegistryAddress);
    _setCommitmentMapperRegistry(commitmentMapperRegistryAddress);
    _setSynapsPythia1SimpleAttester(synapsPythia1SimpleAttesterAddress);
  }

  function _setFront(address frontAddress) internal {
    _front = address(frontAddress);
    emit FrontSet(frontAddress);
  }

  function _setBadges(address badgesAddress) internal {
    _badges = address(badgesAddress);
    emit BadgesSet(badgesAddress);
  }

  function _setAttestationsRegistry(address attestationsRegistryAddress) internal {
    _attestationsRegistry = address(attestationsRegistryAddress);
    emit AttestationsRegistrySet(attestationsRegistryAddress);
  }

  function _setHydraS1AccountboundAttester(address hydraS1AccountboundAttesterAddress) internal {
    _hydraS1AccountboundAttester = address(hydraS1AccountboundAttesterAddress);
    emit HydraS1AccountboundAttesterSet(hydraS1AccountboundAttesterAddress);
  }

  function _setAvailableRootsRegistry(address availableRootsRegistryAddress) internal {
    _availableRootsRegistry = address(availableRootsRegistryAddress);
    emit AvailableRootsRegistrySet(availableRootsRegistryAddress);
  }

  function _setCommitmentMapperRegistry(address commitmentMapperRegistryAddress) internal {
    _commitmentMapperRegistry = address(commitmentMapperRegistryAddress);
    emit CommitmentMapperRegistrySet(commitmentMapperRegistryAddress);
  }

  function _setSynapsPythia1SimpleAttester(address synapsPythia1SimpleAttesterAddress) internal {
    _synapsPythia1SimpleAttester = address(synapsPythia1SimpleAttesterAddress);
    emit SynapsPythia1SimpleAttesterSet(synapsPythia1SimpleAttesterAddress);
  }
}
