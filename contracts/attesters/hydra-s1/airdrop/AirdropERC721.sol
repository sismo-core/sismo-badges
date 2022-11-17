// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

import {ERC721Enumerable} from '@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol';

abstract contract AirdropERC721 is ERC721Enumerable {
  function burn(uint256 tokenId) public virtual {
    //solhint-disable-next-line max-line-length
    require(
      _isApprovedOrOwner(_msgSender(), tokenId),
      'ERC721Burnable: caller is not owner nor approved'
    );
    _burn(tokenId);
  }

  function safeMint(address to, uint256 tokenId) public virtual {
    _safeMint(to, tokenId);
  }
}
