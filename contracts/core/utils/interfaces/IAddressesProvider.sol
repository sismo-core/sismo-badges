// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

interface IAddressesProvider {
  /**
   * @dev Sets the address of a contract.
   * @param contractAddress Address of the contract.
   * @param contractName Name of the contract.
   */
  function set(address contractAddress, string memory contractName) external;

  /**
   * @dev Sets the address of multiple contracts.
   * @param contractAddresses Addresses of the contracts.
   * @param contractNames Names of the contracts.
   */
  function setBatch(address[] calldata contractAddresses, string[] calldata contractNames) external;

  /**
   * @dev Returns the address of a contract.
   * @param contractName Name of the contract (string).
   * @return Address of the contract.
   */
  function get(string memory contractName) external view returns (address);

  /**
   * @dev Returns the address of a contract.
   * @param contractNameHash Hash of the name of the contract (bytes32).
   * @return Address of the contract.
   */
  function get(bytes32 contractNameHash) external view returns (address);

  /**
   * @dev Returns the addresses of all contracts inputed.
   * @param contractNames Names of the contracts as strings.
   */
  function getBatch(string[] calldata contractNames) external view returns (address[] memory);

  /**
   * @dev Returns the addresses of all contracts inputed.
   * @param contractNamesHash Names of the contracts as strings.
   */
  function getBatch(bytes32[] calldata contractNamesHash) external view returns (address[] memory);

  /**
   * @dev Returns the addresses of all contracts in `_contractNames`
   * @return Names, Hashed Names and Addresses of all contracts.
   */
  function getAll() external view returns (string[] memory, bytes32[] memory, address[] memory);
}
