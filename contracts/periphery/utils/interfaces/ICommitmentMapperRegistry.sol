// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

interface ICommitmentMapperRegistry {
  event UpdatedCommitmentMapperEdDSAPubKey(uint256[2] newEdDSAPubKey);
  event UpdatedCommitmentMapperAddress(address newAddress);
  error PubKeyNotValid(uint256[2] pubKey);

  /**
   * @dev Initializes the contract, to be called by the proxy delegating calls to this implementation
   * @param owner Owner of the contract, can update public key and address
   * @param commitmentMapperEdDSAPubKey EdDSA public key of the commitment mapper
   * @param commitmentMapperAddress Address of the commitment mapper
   */
  function initialize(
    address owner,
    uint256[2] memory commitmentMapperEdDSAPubKey,
    address commitmentMapperAddress
  ) external;

  /**
   * @dev Updates the EdDSA public key
   * @param newEdDSAPubKey new EdDSA pubic key
   */
  function updateCommitmentMapperEdDSAPubKey(uint256[2] memory newEdDSAPubKey) external;

  /**
   * @dev Updates the address
   * @param newAddress new address
   */
  function updateCommitmentMapperAddress(address newAddress) external;

  /**
   * @dev Getter of the address of the commitment mapper
   */
  function getEdDSAPubKey() external view returns (uint256[2] memory);

  /**
   * @dev Getter of the address of the commitment mapper
   */
  function getAddress() external view returns (address);
}
