// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

import '@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol';
import {UsingSismo, Request} from '../../core/SismoLib.sol';
import {AccessControl} from '@openzeppelin/contracts/access/AccessControl.sol';
import {Pausable} from '@openzeppelin/contracts/security/Pausable.sol';
import {Context} from '@openzeppelin/contracts/utils/Context.sol';

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

contract ZKBadgeboundERC721 is ERC721Upgradeable, UsingSismo, AccessControl, Pausable {
  uint256 public immutable GATING_BADGE_TOKEN_ID;

  string private _baseTokenURI;

  event BaseTokenUriChanged(string baseTokenURI);

  error NFTAlreadyOwned(address owner, uint256 balance);
  error BadgeNullifierNotEqualToTokenId(uint256 badgeNullifier, uint256 tokenId);
  error BadgeNullifierZeroNotAllowed();
  error BadgeDestinationAndNFTDestinationNotEqual(address badgeDestination, address nftDestination);
  error NoTokenTransferWhilePaused();

  constructor(
    string memory name,
    string memory symbol,
    string memory baseTokenURI,
    uint256 gatingBadgeTokenId
  ) {
    GATING_BADGE_TOKEN_ID = gatingBadgeTokenId;
    initialize(name, symbol, baseTokenURI);
  }

  function initialize(
    string memory name,
    string memory symbol,
    string memory baseTokenURI
  ) public initializer {
    __ERC721_init(name, symbol);
    _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    _setBaseTokenUri(baseTokenURI);
  }

  /**
   * @dev Mints a NFT and transfers it to the account that holds the ZK Badge
   * @notice The account that calls this function must hold a ZK Badge with the id MERGOOOR_PASS_BADGE_TOKEN_ID
   */
  function claim() public onlyBadgeHolders(GATING_BADGE_TOKEN_ID) {
    uint256 nullifier = _getNulliferOfBadge(_msgSender());

    _mint(_msgSender(), nullifier);
  }

  /**
   * @dev Mints a NFT and transfers it to the account that holds the ZK Badge
   * @param to address of the account that will receive the NFT
   * @notice The address `to` must hold a ZK Badge with the id MERGOOOR_PASS_BADGE_TOKEN_ID
   */
  function claimTo(address to) public {
    _requireBadge(to, GATING_BADGE_TOKEN_ID);
    uint256 badgeNullifier = _getNulliferOfBadge(to);
    if (badgeNullifier == 0) {
      revert BadgeNullifierZeroNotAllowed();
    }

    _mint(to, badgeNullifier);
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
   * @notice The address `to` must hold a ZK Badge with the id MERGOOOR_PASS_BADGE_TOKEN_ID
   * @param from address of the account that currently owns the NFT
   * @param to address of the account that will receive the NFT (must hold a ZK Badge with the id MERGOOOR_PASS_BADGE_TOKEN_ID)
   * @param tokenId id of the NFT to transfer
   */
  function safeTransferFrom(
    address from,
    address to,
    uint256 tokenId
  ) public override(ERC721Upgradeable) {
    _requireBadge(to, GATING_BADGE_TOKEN_ID);
    uint256 badgeNullifier = _getNulliferOfBadge(to);
    if (badgeNullifier == 0) {
      revert BadgeNullifierZeroNotAllowed();
    }
    if (badgeNullifier != tokenId) {
      revert BadgeNullifierNotEqualToTokenId(badgeNullifier, tokenId);
    }

    _safeTransfer(from, to, tokenId, '');
  }

  function transferFrom(
    address from,
    address to,
    uint256 tokenId
  ) public override(ERC721Upgradeable) {
    _requireBadge(to, GATING_BADGE_TOKEN_ID);
    uint256 badgeNullifier = _getNulliferOfBadge(to);
    if (badgeNullifier == 0) {
      revert BadgeNullifierZeroNotAllowed();
    }
    if (badgeNullifier != tokenId) {
      revert BadgeNullifierNotEqualToTokenId(badgeNullifier, tokenId);
    }

    _transfer(from, to, tokenId);
  }

  /**
   * @dev Transfers a NFT to the account that holds the ZK Badge with the same nullifier
   * @notice The address `to` will receive a ZK Badge and a NFT with the id MERGOOOR_PASS_BADGE_TOKEN_ID that is linked to the same nullifier
   * @param from address of the account that currently owns the NFT
   * @param to address of the account that will receive the NFT (the address will also receive a ZK Badge with the id MERGOOOR_PASS_BADGE_TOKEN_ID)
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
   * @dev Prevent the transfer of a NFT if the destination address already owns a NFT
   * @param to Address to transfer the NFT to
   */
  function _beforeTokenTransfer(
    address,
    address to,
    uint256,
    uint256
  ) internal view override(ERC721Upgradeable) {
    if (balanceOf(to) > 0) {
      revert NFTAlreadyOwned(to, balanceOf(to));
    }

    if (paused()) {
      revert NoTokenTransferWhilePaused();
    }
  }

  /**
   * @dev Getter to know a nullifier for a specific address
   * @param to destination address referenced in the proof with this nullifier
   */
  function _getNulliferOfBadge(address to) internal view returns (uint256) {
    bytes memory extraData = BADGES.getBadgeExtraData(to, GATING_BADGE_TOKEN_ID);
    return HYDRA_S1_ACCOUNTBOUND_ATTESTER.getNullifierFromExtraData(extraData);
  }

  /**
   * @dev Set BaseTokenUri for ERC721 contract
   */
  function setBaseTokenUri(string memory baseUri) public onlyRole(DEFAULT_ADMIN_ROLE) {
    _setBaseTokenUri(baseUri);
  }

  function _setBaseTokenUri(string memory baseUri) private {
    _baseTokenURI = baseUri;
    emit BaseTokenUriChanged(baseUri);
  }

  function _baseURI() internal view override returns (string memory) {
    return _baseTokenURI;
  }

  /**
   * @dev Pauses all token transfers.
   */
  function pause() public virtual onlyRole(DEFAULT_ADMIN_ROLE) {
    _pause();
  }

  /**
   * @dev Unpauses all token transfers.
   */
  function unpause() public virtual onlyRole(DEFAULT_ADMIN_ROLE) {
    _unpause();
  }

  /**
   * @dev See {IERC165-supportsInterface}.
   */
  function supportsInterface(
    bytes4 interfaceId
  ) public view virtual override(ERC721Upgradeable, AccessControl) returns (bool) {
    return super.supportsInterface(interfaceId);
  }

  function _msgSender() internal view override(Context, ContextUpgradeable) returns (address) {
    return msg.sender;
  }

  function _msgData() internal pure override(Context, ContextUpgradeable) returns (bytes calldata) {
    return msg.data;
  }
}
