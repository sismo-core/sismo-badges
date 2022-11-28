// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import '@openzeppelin/contracts/token/ERC721/ERC721.sol';
import {SismoGated} from '../core/libs/sismo-gated/SismoGated.sol';

contract MyNFT is ERC721, SismoGated {
  constructor(
    address badgesAddress,
    uint256[] memory _gatedBadges
  ) ERC721('Sismo Gated NFT Contract', 'SGNFT') SismoGated(badgesAddress, _gatedBadges) {}

  function mint(address to, uint256 tokenId) public onlyBadgesOwner {
    _mint(to, tokenId);
  }

  function proveAndMintERC721(
    address to,
    uint256 tokenId,
    bytes calldata data
  ) public onlyBadgesOwner {
    _safeMint(to, tokenId, data);
  }
}
