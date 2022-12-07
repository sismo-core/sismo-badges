// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;
import 'hardhat/console.sol';

import '@openzeppelin/contracts/token/ERC721/ERC721.sol';
import {SismoGated, HydraS1AccountboundAttester} from '../core/libs/sismo-gated/SismoGated.sol';

contract MockGatedERC721 is ERC721, SismoGated {
  uint256 public constant GATED_BADGE_TOKEN_ID = 200001;
  uint256 public constant GATED_BADGE_MIN_VALUE = 1;
  mapping(uint256 => bool) private _isNullifierUsed;

  error NFTAlreadyMinted();

  constructor() ERC721('Sismo Gated NFT Contract', 'SGNFT') SismoGated() {}

  function safeMint(
    address to,
    uint256 tokenId,
    bytes calldata data
  ) public onlyBadgesOwner(to, GATED_BADGE_TOKEN_ID, 1, HYDRA_S1_ACCOUNTBOUND_ATTESTER, data) {
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
    proveWithSismo(HYDRA_S1_ACCOUNTBOUND_ATTESTER, data);
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
    bytes memory extraData = BADGES.getBadgeExtraData(to, GATED_BADGE_TOKEN_ID);
    address badgeIssuerAddress = BADGES.getBadgeIssuer(to, GATED_BADGE_TOKEN_ID);
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
