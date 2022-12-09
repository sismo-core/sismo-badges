// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;
import 'hardhat/console.sol';

import '@openzeppelin/contracts/token/ERC721/ERC721.sol';
import {SismoGated, Request} from '../core/libs/sismo-gated/SismoGated.sol';

/**
 *  @notice Mock contract to test the SismoGated contract with ERC721 that will have accountbound feature
 *
 *  This contract is not meant to be used in production
 *  It is only used for testing purposes
 *
 */

contract MockGatedERC721 is ERC721, SismoGated {
  uint256 public constant GATED_BADGE_TOKEN_ID = 200001;
  uint256 public constant GATED_BADGE_MIN_LEVEL = 1;

  mapping(uint256 => bool) private _isNullifierUsed;
  // store nullifier used for each ERC721 token
  mapping(uint256 => uint256) private _tokenIdNullifiers;

  error NFTAlreadyMinted();
  error NFTAlreadyOwned(address owner, uint256 balance);
  error BadgeNullifierAndERC721NullifierAreDifferent(
    uint256 badgeNullifier,
    uint256 erc721Nullifier
  );

  constructor(
    address badgesLocalAddress,
    address hydraS1AccountboundLocalAddress
  )
    ERC721('Sismo Gated NFT Contract', 'SGNFT')
    SismoGated(badgesLocalAddress, hydraS1AccountboundLocalAddress)
  {}

  /**
   * @dev Mint a new NFT if the user has the required badge
   * @param to Address to mint the NFT to
   * @param tokenId Token ID of the NFT
   */
  function safeMint(
    address to,
    uint256 tokenId
  ) public onlySismoBadgeHolder(to, GATED_BADGE_TOKEN_ID, GATED_BADGE_MIN_LEVEL) {
    uint256 nullifier = _getNulliferForAddress(to);

    // prevent minting with same badge twice
    if (isNullifierUsed(nullifier)) {
      revert NFTAlreadyMinted();
    }

    // prevent minting if `to` already has an ERC721 token (only one ERC721 token per account)
    if (ERC721.balanceOf(to) > 0) {
      revert NFTAlreadyMinted();
    }

    _mint(to, tokenId);
  }

  /**
   * @dev Mint a new NFT if a valid Sismo proof is provided
   * @param to Address to mint the NFT to
   * @param tokenId Token ID of the NFT
   * @param request Request to prove
   * @param sismoProof Proof to prove the request
   */
  function mintWithSismo(
    address to,
    uint256 tokenId,
    Request memory request,
    bytes memory sismoProof
  ) public {
    proveWithSismo(request, sismoProof);

    safeMint(to, tokenId);
  }

  /**
   * @dev Transfer a NFT if the user has the required badge
   * @param from Address to transfer the NFT from
   * @param to Address to transfer the NFT to
   * @param tokenId Token ID of the NFT
   */
  function safeTransferFrom(
    address from,
    address to,
    uint256 tokenId
  ) public override(ERC721) onlySismoBadgeHolder(to, GATED_BADGE_TOKEN_ID, GATED_BADGE_MIN_LEVEL) {
    // prevent transfer if `to` already has an ERC721 token (only one ERC721 token per account)
    if (ERC721.balanceOf(to) > 0) {
      revert NFTAlreadyOwned(to, ERC721.balanceOf(to));
    }

    // prevent transfer if the nullifier used for the ERC721 tokenId is different from the badge nullifier
    uint256 badgeNullifier = _getNulliferForAddress(to);
    uint256 erc721Nullifier = _tokenIdNullifiers[tokenId];
    if (erc721Nullifier != badgeNullifier) {
      revert BadgeNullifierAndERC721NullifierAreDifferent(badgeNullifier, erc721Nullifier);
    }

    ERC721.safeTransferFrom(from, to, tokenId);
  }

  /**
   * @dev Transfer a NFT if a valid Sismo proof is provided
   * @param from Address to transfer the NFT from
   * @param to Address to transfer the NFT to
   * @param tokenId Token ID of the NFT
   * @param request Request to prove
   * @param sismoProof Proof to prove the request
   */
  function transferWithSismo(
    address from,
    address to,
    uint256 tokenId,
    Request memory request,
    bytes memory sismoProof
  ) public {
    proveWithSismo(request, sismoProof);

    safeTransferFrom(from, to, tokenId);
  }

  /**
   * @dev Set nullifier as used after a token transfer
   * @param to Address to transfer the NFT to
   */
  function _afterTokenTransfer(
    address,
    address to,
    uint256 firstTokenId,
    uint256
  ) internal override(ERC721) {
    uint256 nullifier = _getNulliferForAddress(to);
    _setNullifierAsUsed(nullifier);
    _setNullifierForTokenId(firstTokenId, nullifier);
  }

  /**
   * @dev Getter to know a nullifier for a specific address
   * @param to destination address referenced in the proof with this nullifier
   */
  function _getNulliferForAddress(address to) internal view returns (uint256) {
    bytes memory extraData = BADGES.getBadgeExtraData(to, GATED_BADGE_TOKEN_ID);
    return HYDRA_S1_ACCOUNTBOUND_ATTESTER.getNullifierFromExtraData(extraData);
  }

  /**
   * @dev Marks a nullifier as used
   * @param nullifier Nullifier to mark as used
   */
  function _setNullifierAsUsed(uint256 nullifier) internal {
    _isNullifierUsed[nullifier] = true;
  }

  /**
   * @dev Getter to know if a nullifier has been used
   * @param nullifier Nullifier to check
   */
  function isNullifierUsed(uint256 nullifier) public view returns (bool) {
    return _isNullifierUsed[nullifier];
  }

  function _setNullifierForTokenId(uint256 tokenId, uint256 nullifier) internal {
    _tokenIdNullifiers[tokenId] = nullifier;
  }
}
