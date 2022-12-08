// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;
import 'hardhat/console.sol';

import '@openzeppelin/contracts/token/ERC721/ERC721.sol';
import {SismoGated, Request} from '../core/libs/sismo-gated/SismoGated.sol';

contract MockGatedERC721 is ERC721, SismoGated {
  uint256 public constant GATED_BADGE_TOKEN_ID = 200001;
  uint256 public constant GATED_BADGE_MIN_LEVEL = 1;
  mapping(uint256 => bool) private _isNullifierUsed;

  error NFTAlreadyMinted();
  error AccountAndRequestDestinationDoNotMatch(address account, address requestDestination);
  error BadgeLevelIsLowerThanMinBalance(uint256 badgeLevel, uint256 minBalance);

  constructor(
    address badgesLocalAddress,
    address hydraS1AccountboundLocalAddress
  )
    ERC721('Sismo Gated NFT Contract', 'SGNFT')
    SismoGated(badgesLocalAddress, hydraS1AccountboundLocalAddress)
  {}

  function safeMint(
    address to,
    uint256 tokenId
  ) public ERC1155Gated(to, GATED_BADGE_TOKEN_ID, GATED_BADGE_MIN_LEVEL) {
    uint256 nullifier = _getNulliferForAddress(to);

    if (isNullifierUsed(nullifier)) {
      revert NFTAlreadyMinted();
    }

    _mint(to, tokenId);
  }

  function mintWithSismo(
    address to,
    uint256 tokenId,
    Request memory request,
    bytes memory sismoProof
  ) public {
    if (to != request.destination) {
      revert AccountAndRequestDestinationDoNotMatch(to, request.destination);
    }

    (, uint256[] memory values) = proveWithSismo(
      HYDRA_S1_ACCOUNTBOUND_ATTESTER,
      request,
      sismoProof
    );

    for (uint256 i = 0; i < values.length; i++) {
      if (values[i] < GATED_BADGE_MIN_LEVEL) {
        revert BadgeLevelIsLowerThanMinBalance(values[i], GATED_BADGE_MIN_LEVEL);
      }
    }

    safeMint(to, tokenId);
  }

  function safeMintWithTwoGatedBadges(address to, uint256 tokenId) public {
    uint256[] memory badgeTokenIds = new uint256[](2);
    badgeTokenIds[0] = GATED_BADGE_TOKEN_ID;
    badgeTokenIds[1] = GATED_BADGE_TOKEN_ID + 1;

    uint256[] memory badgeMinimumValues = new uint256[](2);
    badgeMinimumValues[0] = GATED_BADGE_MIN_LEVEL;
    badgeMinimumValues[1] = GATED_BADGE_MIN_LEVEL;

    bool isInclusive = true;

    checkAccountBadges(to, badgeTokenIds, badgeMinimumValues, isInclusive);

    uint256 nullifier = _getNulliferForAddress(to);

    if (isNullifierUsed(nullifier)) {
      revert NFTAlreadyMinted();
    }

    _mint(to, tokenId);
  }

  function safeTransferFrom(
    address from,
    address to,
    uint256 tokenId
  ) public override(ERC721) ERC1155Gated(to, GATED_BADGE_TOKEN_ID, GATED_BADGE_MIN_LEVEL) {
    _transfer(from, to, tokenId);
  }

  function transferWithSismo(
    address from,
    address to,
    uint256 tokenId,
    Request memory request,
    bytes memory sismoProof
  ) public {
    if (to != request.destination) {
      revert AccountAndRequestDestinationDoNotMatch(to, request.destination);
    }

    (, uint256[] memory values) = proveWithSismo(
      HYDRA_S1_ACCOUNTBOUND_ATTESTER,
      request,
      sismoProof
    );

    for (uint256 i = 0; i < values.length; i++) {
      if (values[i] < GATED_BADGE_MIN_LEVEL) {
        revert BadgeLevelIsLowerThanMinBalance(values[i], GATED_BADGE_MIN_LEVEL);
      }
    }

    safeTransferFrom(from, to, tokenId);
  }

  function _afterTokenTransfer(address, address to, uint256, uint256) internal override(ERC721) {
    uint256 nullifier = _getNulliferForAddress(to);
    _setNullifierAsUsed(nullifier);
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
  function _setNullifierAsUsed(uint256 nullifier) internal {
    _isNullifierUsed[nullifier] = true;
  }
}
