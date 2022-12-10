// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

import '@openzeppelin/contracts/token/ERC721/ERC721.sol';
import {UsingSismo, BadgesRequirementsLib, Request} from '../core/SismoLib.sol';

contract MergooorPass is ERC721, UsingSismo {
  using BadgesRequirementsLib for address;
  uint256 public constant MERGOOOR_PASS_BADGE_ID = 200001;

  error NFTAlreadyMinted();
  error NFTAlreadyOwned(address owner, uint256 balance);
  error BadgeNullifierNotEqualToTokenId(uint256 badgeNullifier, uint256 tokenId);
  error BadgeDestinationAndNFTDestinationNotEqual(address badgeDestination, address nftDestination);

  constructor(
    address badgesLocalAddress,
    address hydraS1AccountboundLocalAddress
  ) ERC721('Mergoor Pass', 'MPT') {}

  // could forward to claimTo, but chose to keep so it showcase the use of modifier
  function claim() public onlyBadgeHolders(MERGOOOR_PASS_BADGE_ID) {
    uint256 nullifier = _getNulliferOfBadge(_msgSender());

    if (ownerOf(nullifier) != address(0)) {
      revert NFTAlreadyMinted();
    }
    _mint(_msgSender(), nullifier);
  }

  function claimTo(address to) public {
    to._requireBadge(MERGOOOR_PASS_BADGE_ID);
    uint256 nullifier = _getNulliferOfBadge(to);

    // prevent minting with same badge twice
    if (ownerOf(nullifier) != address(0)) {
      revert NFTAlreadyMinted();
    }
    _mint(to, nullifier);
  }

  function claimWithSismo(Request memory request, bytes memory sismoProof) public {
    (address destination, , ) = _mintSismoBadge(request, sismoProof);
    claimTo(destination);
  }

  function safeTransferFrom(address from, address to, uint256 tokenId) public override(ERC721) {
    to._requireBadge(MERGOOOR_PASS_BADGE_ID);
    uint256 badgeNullifier = _getNulliferOfBadge(to);
    if (badgeNullifier != tokenId) {
      revert BadgeNullifierNotEqualToTokenId(badgeNullifier, tokenId);
    }
    _safeTransfer(from, to, tokenId, '');
  }

  function transferFrom(address from, address to, uint256 tokenId) public override(ERC721) {
    to._requireBadge(MERGOOOR_PASS_BADGE_ID);
    uint256 badgeNullifier = _getNulliferOfBadge(to);
    if (badgeNullifier != tokenId) {
      revert BadgeNullifierNotEqualToTokenId(badgeNullifier, tokenId);
    }
    _transfer(from, to, tokenId);
  }

  function transferWithSismo(
    address from,
    address to,
    uint256 tokenId,
    Request memory request,
    bytes memory sismoProof
  ) public {
    (address destination, , ) = _mintSismoBadge(request, sismoProof);
    if (destination != to) {
      revert BadgeDestinationAndNFTDestinationNotEqual(destination, to);
    }
    safeTransferFrom(from, destination, tokenId);
  }

  /**
   * @dev Set nullifier as used after a token transfer
   * @param to Address to transfer the NFT to
   */
  function _beforeTokenTransfer(address, address to, uint256, uint256) internal override(ERC721) {
    if (balanceOf(to) > 0) {
      revert NFTAlreadyOwned(to, balanceOf(to));
    }
  }

  /**
   * @dev Getter to know a nullifier for a specific address
   * @param to destination address referenced in the proof with this nullifier
   */
  function _getNulliferOfBadge(address to) internal view returns (uint256) {
    bytes memory extraData = BADGES.getBadgeExtraData(to, MERGOOOR_PASS_BADGE_ID);
    return HYDRA_S1_ACCOUNTBOUND_ATTESTER.getNullifierFromExtraData(extraData);
  }
}
