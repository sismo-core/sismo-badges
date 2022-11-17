// SPDX-License-Identifier: MIT

pragma solidity ^0.8.14;
pragma experimental ABIEncoderV2;

import {IAirdrop721} from './IAirdrop721.sol';

// Core protocol Protocol imports
import {Request, Attestation, Claim} from '../../../core/libs/Structs.sol';
import {Attester, IAttester, IAttestationsRegistry} from './../../../core/Attester.sol';
import {AirdropERC721} from './AirdropERC721.sol';

/**
 * @title  Airdrop721 contract
 * @author Sismo
 * @notice Contract that facilitates the use of the Airdrop logic (ERC721) for attesters.
 */
contract Airdrop721 is IAirdrop721 {
  struct Airdrops {
    address contractAddress;
    bool isContractRegistered;
  }

  error ContractNotRegisteredForAirdropWithGroupId(uint256 groupId);

  // we map a groupId to airdrop informations (contract address and isRegistered boolean)
  mapping(uint256 => Airdrops) internal _registeredAirdrops;

  modifier onlyRegisteredContracts(uint256 groupId) {
    // if BurnCount has changed -> burn the previous holded ERC721
    if (!_isContractRegisteredForGroupId(groupId)) {
      revert ContractNotRegisteredForAirdropWithGroupId(groupId);
    }
    _;
  }

  function _burnERC721ForGroupId(uint256 groupId, address owner)
    internal
    onlyRegisteredContracts(groupId)
  {
    AirdropERC721 airdropContract = AirdropERC721(_getContractRegisteredForGroupId(groupId));
    // only works if ERC721 is non-transferable
    // can throw if it's not the case
    uint256 tokenId = airdropContract.tokenOfOwnerByIndex(owner, 0);
    airdropContract.burn(tokenId);
  }

  function _safeMintERC721ForGroupId(uint256 groupId, address destination)
    internal
    onlyRegisteredContracts(groupId)
  {
    AirdropERC721 airdropContract = AirdropERC721(_getContractRegisteredForGroupId(groupId));
    airdropContract.safeMint(destination, airdropContract.totalSupply());
  }

  function register(uint256 groupId, address contractAddress) public {
    _registeredAirdrops[groupId].contractAddress = contractAddress;
    _registeredAirdrops[groupId].isContractRegistered = true;
  }

  function getContractRegisteredForGroupId(uint256 groupId) external view returns (address) {
    return _getContractRegisteredForGroupId(groupId);
  }

  function _getContractRegisteredForGroupId(uint256 groupId) internal view returns (address) {
    return _registeredAirdrops[groupId].contractAddress;
  }

  function isContractRegisteredForGroupId(uint256 groupId) external view returns (bool) {
    return _isContractRegisteredForGroupId(groupId);
  }

  function _isContractRegisteredForGroupId(uint256 groupId) internal view returns (bool) {
    return _registeredAirdrops[groupId].isContractRegistered;
  }
}
