// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;
import 'hardhat/console.sol';

import '@openzeppelin/contracts/token/ERC721/ERC721.sol';
import {SismoGated, HydraS1AccountboundAttester} from '../core/libs/sismo-gated/SismoGated.sol';

contract MockGatedERC721 is ERC721, SismoGated {
  mapping(uint256 => bool) private _isNullifierUsed;

  error NFTAlreadyMinted();

  constructor(
    uint256 gatedBadgeTokenId
  ) ERC721('Sismo Gated NFT Contract', 'SGNFT') SismoGated(gatedBadgeTokenId) {}

  function safeMint(
    address to,
    uint256 tokenId,
    bytes calldata data
  ) public onlyBadgesOwner(to, data, address(hydraS1AccountboundAttester)) {
    uint256 nullifier = _getNulliferForAddress(to);

    if (isNullifierUsed(nullifier)) {
      revert NFTAlreadyMinted();
    }

    _mint(to, tokenId);
  }

  function safeTransferFrom(
    address from,
    address to,
    uint256 tokenId,
    bytes memory data
  ) public override(ERC721) {
    proveWithSismo(hydraS1AccountboundAttester, data);
    _transfer(from, to, tokenId);
  }

  function _afterTokenTransfer(address, address to, uint256, uint256) internal override(ERC721) {
    uint256 nullifier = _getNulliferForAddress(to);
    _markNullifierAsUsed(nullifier);
  }

  /**
   * @dev Getter to know a nullifier for a specific address
   * @param to destination address referenced in the proof with this nullifier
   */
  function _getNulliferForAddress(address to) internal view returns (uint256) {
    bytes memory extraData = badges.getBadgeExtraData(to, gatedBadge);
    address badgeIssuerAddress = badges.getBadgeIssuer(to, gatedBadge);
    return HydraS1AccountboundAttester(badgeIssuerAddress).getNullifierFromExtraData(extraData);
  }

  /**
   * @dev Getter to know if a nullifier has been used
   * @param nullifier Nullifier to check
   */
  function isNullifierUsed(uint256 nullifier) public view returns (bool) {
    return _isNullifierUsed[nullifier];
  }

  /**
   * @dev Marks a nullifier as used
   * @param nullifier Nullifier to mark as used
   */
  function _markNullifierAsUsed(uint256 nullifier) internal {
    _isNullifierUsed[nullifier] = true;
  }
}
