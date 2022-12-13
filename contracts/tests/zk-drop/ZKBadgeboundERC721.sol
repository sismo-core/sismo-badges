// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;
import 'hardhat/console.sol';

import '@openzeppelin/contracts/token/ERC721/ERC721.sol';
import {UsingSismo, Request} from '../../core/SismoLib.sol';

/**
 * @title ZkBadgeboundERC721
 * @dev ERC721 token that can be minted by holding a specific ZK Badge
 * @notice This implementation offers to any account holding a specific ZK Badge the possibility to mint a NFT and transfer it to another account
 * The ZK Badge used in this implementation is bounded to an account thanks to a nullifier (in a zero knowledge way)
 *
 * The nullifier is a cryptographic information that prevents any account from producing a proof for the same ZK Badge twice
 * We use the nullifier in this contract to make sure that each NFT minted or transfered is linked with a 1-o-1 relationship to a specific ZK Badge and therefore to a specific account
 * To ensure this feature, we use the nullifier as the tokenId of the NFT that is minted or transferred
 * Each time a NFT is minted or transferred, we make sure that the ZK Badge owned by the account is the same as the one used to mint or transfer the NFT
 */

contract ZKBadgeboundERC721 is ERC721, UsingSismo {
  uint256 public constant MERGOOOR_PASS_BADGE_ID = 200002;

  error NFTAlreadyOwned(address owner, uint256 balance);
  error BadgeNullifierNotEqualToTokenId(uint256 badgeNullifier, uint256 tokenId);
  error BadgeDestinationAndNFTDestinationNotEqual(address badgeDestination, address nftDestination);

  constructor() ERC721('Mergoor Pass', 'MPT') {}

  /**
   * @dev Mints a NFT and transfers it to the account that holds the ZK Badge
   * @notice The account that calls this function must hold a ZK Badge with the id MERGOOOR_PASS_BADGE_ID
   */
  function claim() public onlyBadgeHolders(MERGOOOR_PASS_BADGE_ID) {
    uint256 nullifier = _getNulliferOfBadge(_msgSender());

    _mint(_msgSender(), nullifier);
  }

  /**
   * @dev Mints a NFT and transfers it to the account that holds the ZK Badge
   * @param to address of the account that will receive the NFT
   * @notice The address `to` must hold a ZK Badge with the id MERGOOOR_PASS_BADGE_ID
   */
  function claimTo(address to) public {
    _requireBadge(to, MERGOOOR_PASS_BADGE_ID);
    uint256 nullifier = _getNulliferOfBadge(to);

    _mint(to, nullifier);
  }

  /**
   * @dev Mints a ZK Badge and a NFT and transfers it to the account that holds the newly minted ZK Badge
   * @param request user request containing the data needed to mint the ZK Badge
   * @param sismoProof Proof of eligibilty to mint the ZK Badge
   */
  function claimWithSismo(Request memory request, bytes memory sismoProof) public {
    (address destination, , ) = _mintSismoBadge(request, sismoProof);
    claimTo(destination);
  }

  /**
   * @dev Transfers a NFT to the account that holds the ZK Badge with the same nullifier
   * @notice The address `to` must hold a ZK Badge with the id MERGOOOR_PASS_BADGE_ID
   * @param from address of the account that currently owns the NFT
   * @param to address of the account that will receive the NFT (must hold a ZK Badge with the id MERGOOOR_PASS_BADGE_ID)
   * @param tokenId id of the NFT to transfer
   */
  function safeTransferFrom(address from, address to, uint256 tokenId) public override(ERC721) {
    _requireBadge(to, MERGOOOR_PASS_BADGE_ID);
    uint256 badgeNullifier = _getNulliferOfBadge(to);
    if (badgeNullifier != tokenId) {
      revert BadgeNullifierNotEqualToTokenId(badgeNullifier, tokenId);
    }
    _safeTransfer(from, to, tokenId, '');
  }

  function transferFrom(address from, address to, uint256 tokenId) public override(ERC721) {
    _requireBadge(to, MERGOOOR_PASS_BADGE_ID);
    uint256 badgeNullifier = _getNulliferOfBadge(to);
    if (badgeNullifier != tokenId) {
      revert BadgeNullifierNotEqualToTokenId(badgeNullifier, tokenId);
    }
    _transfer(from, to, tokenId);
  }

  /**
   * @dev Transfers a NFT to the account that holds the ZK Badge with the same nullifier
   * @notice The address `to` will receive a ZK Badge and a NFT with the id MERGOOOR_PASS_BADGE_ID that is linked to the same nullifier
   * @param from address of the account that currently owns the NFT
   * @param to address of the account that will receive the NFT (the address will also receive a ZK Badge with the id MERGOOOR_PASS_BADGE_ID)
   * @param tokenId id of the NFT to transfer
   * @param request user request containing the data needed to mint the ZK Badge
   * @param sismoProof Proof of eligibilty to mint the ZK Badge
   */
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
  function _beforeTokenTransfer(
    address,
    address to,
    uint256,
    uint256
  ) internal view override(ERC721) {
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
