// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

import {Ownable} from '@openzeppelin/contracts/access/Ownable.sol';
import {Initializable} from '@openzeppelin/contracts/proxy/utils/Initializable.sol';

contract AddressesProvider is Initializable, Ownable {
  uint8 public constant IMPLEMENTATION_VERSION = 1;

  address public immutable BADGES;
  address public immutable ATTESTATIONS_REGISTRY;
  address public immutable FRONT;
  address public immutable HYDRA_S1_ACCOUNTBOUND_ATTESTER;
  address public immutable AVAILABLE_ROOTS_REGISTRY;
  address public immutable COMMITMENT_MAPPER_REGISTRY;
  address public immutable HYDRA_S1_VERIFIER;

  mapping(bytes32 => address) private _contractAddresses;
  string[] private _contractNames;

  // keeping some space for future upgrade
  uint256[18] private _placeHoldersAddressesProvider;

  event ContractAddressSet(address contractAddress, string contractName);

  constructor(
    address ownerAddress,
    address badgesAddress,
    address attestationsRegistryAddress,
    address frontAddress,
    address hydraS1AccountboundAttesterAddress,
    address availableRootsRegistryAddress,
    address commitmentMapperRegistryAddress,
    address hydraS1VerifierAddress
  ) {
    BADGES = badgesAddress;
    ATTESTATIONS_REGISTRY = attestationsRegistryAddress;
    FRONT = frontAddress;
    HYDRA_S1_ACCOUNTBOUND_ATTESTER = hydraS1AccountboundAttesterAddress;
    AVAILABLE_ROOTS_REGISTRY = availableRootsRegistryAddress;
    COMMITMENT_MAPPER_REGISTRY = commitmentMapperRegistryAddress;
    HYDRA_S1_VERIFIER = hydraS1VerifierAddress;

    initialize(ownerAddress);
  }

  function initialize(address ownerAddress) public reinitializer(IMPLEMENTATION_VERSION) {
    // if proxy did not setup owner yet or if called by constructor (for implem setup)
    if (owner() == address(0) || address(this).code.length == 0) {
      _transferOwnership(ownerAddress);
      set(BADGES, 'Badges');
      set(ATTESTATIONS_REGISTRY, 'AttestationsRegistry');
      set(FRONT, 'Front');
      set(HYDRA_S1_ACCOUNTBOUND_ATTESTER, 'HydraS1AccountboundAttester');
      set(AVAILABLE_ROOTS_REGISTRY, 'AvailableRootsRegistry');
      set(COMMITMENT_MAPPER_REGISTRY, 'CommitmentMapperRegistry');
      set(HYDRA_S1_VERIFIER, 'HydraS1Verifier');
    }
  }

  /**
   * @dev Sets the address of a contract.
   * @param contractAddress Address of the contract.
   * @param contractName Name of the contract.
   */
  function set(address contractAddress, string memory contractName) public onlyOwner {
    bytes32 contractNameHash = keccak256(abi.encodePacked(contractName));

    _contractAddresses[contractNameHash] = contractAddress;
    _contractNames.push(contractName);

    emit ContractAddressSet(contractAddress, contractName);
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
      set(contractAddresses[i], contractNames[i]);
    }
  }

  /**
   * @dev Returns the address of a contract.
   * @param contractName Name of the contract.
   * @return Address of the contract.
   */
  function get(string memory contractName) public view returns (address) {
    bytes32 contractNameHash = keccak256(abi.encodePacked(contractName));

    return _contractAddresses[contractNameHash];
  }

  /**
   * @dev Returns the address of a contract.
   * @param contractNameHash Hash of the name of the contract.
   * @return Address of the contract.
   */
  function get(bytes32 contractNameHash) external view returns (address) {
    return _contractAddresses[contractNameHash];
  }

  /**
   * @dev Returns the addresses of all contracts.
   * @return Addresses of all contracts.
   */
  function getAll() external view returns (string[] memory, bytes32[] memory, address[] memory) {
    string[] memory contractNames = _contractNames;
    bytes32[] memory contractNamesHash = new bytes32[](contractNames.length);
    address[] memory contractAddresses = new address[](contractNames.length);

    for (uint256 i = 0; i < contractNames.length; i++) {
      address contractAddress = get(contractNames[i]);
      if (contractAddress != address(0)) {
        contractAddresses[i] = contractAddress;
        contractNamesHash[i] = keccak256(abi.encodePacked(contractNames[i]));
      }
    }

    return (contractNames, contractNamesHash, contractAddresses);
  }
}
