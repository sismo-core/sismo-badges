// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import '@openzeppelin/contracts/token/ERC721/ERC721.sol';
import {SismoGated} from '../core/libs/sismo-gated/SismoGated.sol';

contract MockGatedERC721 is ERC721, SismoGated {
  constructor(
    address badgesAddress,
    address attesterAddress,
    uint256[] memory _gatedBadges
  )
    ERC721('Sismo Gated NFT Contract', 'SGNFT')
    SismoGated(badgesAddress, attesterAddress, _gatedBadges)
  {}

  function mint(address to, uint256 tokenId, uint256 badgeId) public onlyBadgesOwner(to, badgeId) {
    _mint(to, tokenId);
  }

  function safeTransferFrom(
    address from,
    address to,
    uint256 tokenId,
    bytes memory data
  ) public override(ERC721) {
    _proveWithSismo(data);
    _transfer(from, to, tokenId);
  }
}
