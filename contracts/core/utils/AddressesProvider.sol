// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

import {Ownable} from '@openzeppelin/contracts/access/Ownable.sol';
import {Initializable} from '@openzeppelin/contracts/proxy/utils/Initializable.sol';

import {IAddressesProvider} from './interfaces/IAddressesProvider.sol';

// import core contracts
import {Badges} from '../Badges.sol';
import {AttestationsRegistry} from '../AttestationsRegistry.sol';
import {Front} from '../Front.sol';
import {HydraS1AccountboundAttester} from '../../attesters/hydra-s1/HydraS1AccountboundAttester.sol';
import {AvailableRootsRegistry} from '../../periphery/utils/AvailableRootsRegistry.sol';
import {CommitmentMapperRegistry} from '../../periphery/utils/CommitmentMapperRegistry.sol';
import {HydraS1Verifier} from '@sismo-core/hydra-s1/contracts/HydraS1Verifier.sol';

contract AddressesProvider is IAddressesProvider, Initializable, Ownable {
  uint8 public constant IMPLEMENTATION_VERSION = 2;

  Badges public immutable BADGES;
  AttestationsRegistry public immutable ATTESTATIONS_REGISTRY;
  Front public immutable FRONT;
  HydraS1AccountboundAttester public immutable HYDRA_S1_ACCOUNTBOUND_ATTESTER;
  AvailableRootsRegistry public immutable AVAILABLE_ROOTS_REGISTRY;
  CommitmentMapperRegistry public immutable COMMITMENT_MAPPER_REGISTRY;
  HydraS1Verifier public immutable HYDRA_S1_VERIFIER;

  mapping(bytes32 => address) private _contractAddresses;
  string[] private _contractNames;

  event ContractAddressSet(address contractAddress, string contractName);

  constructor(
    address badgesAddress,
    address attestationsRegistryAddress,
    address frontAddress,
    address hydraS1AccountboundAttesterAddress,
    address availableRootsRegistryAddress,
    address commitmentMapperRegistryAddress,
    address hydraS1VerifierAddress,
    address ownerAddress
  ) {
    BADGES = Badges(badgesAddress);
    ATTESTATIONS_REGISTRY = AttestationsRegistry(attestationsRegistryAddress);
    FRONT = Front(frontAddress);
    HYDRA_S1_ACCOUNTBOUND_ATTESTER = HydraS1AccountboundAttester(
      hydraS1AccountboundAttesterAddress
    );
    AVAILABLE_ROOTS_REGISTRY = AvailableRootsRegistry(availableRootsRegistryAddress);
    COMMITMENT_MAPPER_REGISTRY = CommitmentMapperRegistry(commitmentMapperRegistryAddress);
    HYDRA_S1_VERIFIER = HydraS1Verifier(hydraS1VerifierAddress);

    initialize(ownerAddress);
  }

  function initialize(address ownerAddress) public reinitializer(IMPLEMENTATION_VERSION) {
    // if proxy did not setup owner yet or if called by constructor (for implem setup)
    if (owner() == address(0) || address(this).code.length == 0) {
      _transferOwnership(ownerAddress);
      _set(address(BADGES), 'Badges');
      _set(address(ATTESTATIONS_REGISTRY), 'AttestationsRegistry');
      _set(address(FRONT), 'Front');
      _set(address(HYDRA_S1_ACCOUNTBOUND_ATTESTER), 'HydraS1AccountboundAttester');
      _set(address(AVAILABLE_ROOTS_REGISTRY), 'AvailableRootsRegistry');
      _set(address(COMMITMENT_MAPPER_REGISTRY), 'CommitmentMapperRegistry');
      _set(address(HYDRA_S1_VERIFIER), 'HydraS1Verifier');
    }
  }

  /**
   * @dev Sets the address of a contract.
   * @param contractAddress Address of the contract.
   * @param contractName Name of the contract.
   */
  function set(address contractAddress, string memory contractName) public onlyOwner {
    _set(contractAddress, contractName);
  }

  /**
   * @dev Sets the address of multiple contracts.
   * @param contractAddresses Addresses of the contracts.
   * @param contractNames Names of the contracts.
   */
  function setBatch(
    address[] calldata contractAddresses,
    string[] calldata contractNames
  ) external onlyOwner {
    for (uint256 i = 0; i < contractAddresses.length; i++) {
      _set(contractAddresses[i], contractNames[i]);
    }
  }

  /**
   * @dev Returns the address of a contract.
   * @param contractName Name of the contract (string).
   * @return Address of the contract.
   */
  function get(string memory contractName) public view returns (address) {
    bytes32 contractNameHash = keccak256(abi.encodePacked(contractName));

    return _contractAddresses[contractNameHash];
  }

  /**
   * @dev Returns the address of a contract.
   * @param contractNameHash Hash of the name of the contract (bytes32).
   * @return Address of the contract.
   */
  function get(bytes32 contractNameHash) public view returns (address) {
    return _contractAddresses[contractNameHash];
  }

  /**
   * @dev Returns the addresses of all contracts inputed.
   * @param contractNames Names of the contracts as strings.
   */
  function getBatch(string[] calldata contractNames) external view returns (address[] memory) {
    address[] memory contractAddresses = new address[](contractNames.length);

    for (uint256 i = 0; i < contractNames.length; i++) {
      contractAddresses[i] = get(contractNames[i]);
    }

    return contractAddresses;
  }

  /**
   * @dev Returns the addresses of all contracts inputed.
   * @param contractNamesHash Names of the contracts as bytes32.
   */
  function getBatch(bytes32[] calldata contractNamesHash) external view returns (address[] memory) {
    address[] memory contractAddresses = new address[](contractNamesHash.length);

    for (uint256 i = 0; i < contractNamesHash.length; i++) {
      contractAddresses[i] = get(contractNamesHash[i]);
    }

    return contractAddresses;
  }

  /**
   * @dev Returns the addresses of all contracts in `_contractNames`
   * @return Names, Hashed Names and Addresses of all contracts.
   */
  function getAll() external view returns (string[] memory, bytes32[] memory, address[] memory) {
    string[] memory contractNames = _contractNames;
    bytes32[] memory contractNamesHash = new bytes32[](contractNames.length);
    address[] memory contractAddresses = new address[](contractNames.length);

    for (uint256 i = 0; i < contractNames.length; i++) {
      contractAddresses[i] = get(contractNames[i]);
      contractNamesHash[i] = keccak256(abi.encodePacked(contractNames[i]));
    }

    return (contractNames, contractNamesHash, contractAddresses);
  }

  /**
   * @dev Sets the address of a contract.
   * @param contractAddress Address of the contract.
   * @param contractName Name of the contract.
   */
  function _set(address contractAddress, string memory contractName) internal {
    bytes32 contractNameHash = keccak256(abi.encodePacked(contractName));

    if (_contractAddresses[contractNameHash] == address(0)) {
      _contractNames.push(contractName);
    }

    _contractAddresses[contractNameHash] = contractAddress;

    emit ContractAddressSet(contractAddress, contractName);
  }
}
