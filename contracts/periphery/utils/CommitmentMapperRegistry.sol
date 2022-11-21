// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Ownable} from '@openzeppelin/contracts/access/Ownable.sol';
import {Initializable} from '@openzeppelin/contracts/proxy/utils/Initializable.sol';
import {ICommitmentMapperRegistry} from './interfaces/ICommitmentMapperRegistry.sol';

/**
 * @title Commitment Mapper Registry Contract
 * @author Sismo
 * @notice This contract stores information about the commitment mapper.
 * Its ethereum address and its EdDSA public key
 * For more information: https://commitment-mapper.docs.sismo.io
 *
 **/
contract CommitmentMapperRegistry is ICommitmentMapperRegistry, Initializable, Ownable {
  uint256[2] internal _commitmentMapperPubKey;
  address _commitmentMapperAddress;

  /**
   * @dev Constructor
   * @param owner Owner of the contract, can update public key and address
   * @param commitmentMapperEdDSAPubKey EdDSA public key of the commitment mapper
   * @param commitmentMapperAddress Address of the commitment mapper
   */
  constructor(
    address owner,
    uint256[2] memory commitmentMapperEdDSAPubKey,
    address commitmentMapperAddress
  ) {
    initialize(owner, commitmentMapperEdDSAPubKey, commitmentMapperAddress);
  }

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
  ) public initializer {
    _transferOwnership(owner);
    _updateCommitmentMapperEdDSAPubKey(commitmentMapperEdDSAPubKey);
    _updateCommitmentMapperAddress(commitmentMapperAddress);
  }

  /**
   * @dev Updates the EdDSA public key
   * @param newEdDSAPubKey new EdDSA pubic key
   */
  function updateCommitmentMapperEdDSAPubKey(uint256[2] memory newEdDSAPubKey) external onlyOwner {
    _updateCommitmentMapperEdDSAPubKey(newEdDSAPubKey);
  }

  /**
   * @dev Updates the address
   * @param newAddress new address
   */
  function updateCommitmentMapperAddress(address newAddress) external onlyOwner {
    _updateCommitmentMapperAddress(newAddress);
  }

  /**
   * @dev Getter of the EdDSA public key of the commitment mapper
   */
  function getEdDSAPubKey() external view override returns (uint256[2] memory) {
    return _commitmentMapperPubKey;
  }

  /**
   * @dev Getter of the address of the commitment mapper
   */
  function getAddress() external view override returns (address) {
    return _commitmentMapperAddress;
  }

  function _updateCommitmentMapperAddress(address newAddress) internal {
    _commitmentMapperAddress = newAddress;
    emit UpdatedCommitmentMapperAddress(newAddress);
  }

  function _updateCommitmentMapperEdDSAPubKey(uint256[2] memory pubKey) internal {
    _commitmentMapperPubKey = pubKey;
    emit UpdatedCommitmentMapperEdDSAPubKey(pubKey);
  }
}
