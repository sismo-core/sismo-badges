// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

import '@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol';
import {UsingSismo, Request} from '../../core/SismoLib.sol';
import {AccessControl} from '@openzeppelin/contracts/access/AccessControl.sol';
import {Pausable} from '@openzeppelin/contracts/security/Pausable.sol';
import {Context} from '@openzeppelin/contracts/utils/Context.sol';

/**
 * @title ZKBadgeboundERC721 (ZK-SBT)
 * @dev Non-Transferrable NFT (SBT) that can only be claimed by users eligible to a specific ZK Badge.
 * This contract implements two different "Prove With Sismo" flows to claim the SBT:
 * 2-txs flow: #1(tx) user is directed to Sismo to mint the ZK badge.
 *             #2(tx) user calls claim() that checks that they own the ZK badge and mints the SBT
 * 1-tx flow:  #1(off-chain) user is directed to Sismo to create a ZK Proof of eligibility
 *             #(tx): user calls claimWithSismo(req, proof) that forwards the proof to the ZK Attester
 *                    ZK Attester checks the proof (and mints the ZK Badge). Then the SBT is claimed.
 *
 * BadgeBound: The SBT is bound to a specific ZK Badge, which is identified by its nullifier.
 * tokenId Of SBT == nullifier of ZK Badge
 * The nullifier is an anon identifier of the source account used to prove eligibility to the ZK Badge.
 *
 * Accountbound: The Badge is Accountbound, so is the SBT.
 * The eligible account used to generate ZK Proof can burn and mint the ZK Badge to a new destination
 * Can be done only once every cooldown duration. Makes it possible to lose
 * 2-tx flow:  #1(tx) Burn/mint ZK Badge to new destination
 *             #2(tx) call transfer() SBT to new destination
 * 1-tx flow:  #1(off-chain) get ZK Proof of eligibility
 *             #2(tx) call transferWithSismo(req,proof)
 */

contract ZKBadgeboundERC721 is ERC721Upgradeable, UsingSismo, AccessControl, Pausable {
  uint256 public immutable GATING_BADGE_TOKEN_ID;

  string private _baseTokenURI;

  event BaseTokenUriChanged(string baseTokenURI);

  error ERC721AlreadyOwned(address owner, uint256 balance);
  error BadgeNullifierNotEqualToTokenId(uint256 badgeNullifier, uint256 tokenId);
  error BadgeNullifierZeroNotAllowed();
  error BadgeDestinationAndSBTDestinationNotEqual(address badgeDestination, address nftDestination);
  error NoTokenTransferWhilePaused();

  constructor(
    string memory name,
    string memory symbol,
    string memory baseTokenURI,
    uint256 gatingBadgeTokenId,
    address admin
  ) {
    GATING_BADGE_TOKEN_ID = gatingBadgeTokenId;
    initialize(name, symbol, baseTokenURI, admin);
  }

  function initialize(
    string memory name,
    string memory symbol,
    string memory baseTokenURI,
    address admin
  ) public initializer {
    __ERC721_init(name, symbol);
    _setupRole(DEFAULT_ADMIN_ROLE, admin);
    _setBaseTokenUri(baseTokenURI);
  }

  /**
   * @dev Claim function callable by ZK Badge holders
   * @notice Claim 2-tx flow (see L14)
   */
  function claim() public onlyBadgeHolders(GATING_BADGE_TOKEN_ID) {
    uint256 nullifier = _getNulliferOfBadge(_msgSender());

    _mint(_msgSender(), nullifier);
  }

  /**
   * @dev Claim function callable by anyone for ZK Badge holders
   * @notice Claim 2-tx flow (see L14)
   * @param to recipient of the SBT, must hold the ZK Badge
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
   * @dev Claim by providing the ZK Proof of eligibility
   * @notice Claim 1-tx flow (see L16)
   * @param request user request containing the data needed to mint the ZK Badge
   * @param sismoProof Proof of eligibility to mint the ZK Badge
   */
  function claimWithSismo(Request memory request, bytes memory sismoProof) public {
    (address destination, , ) = _mintSismoBadge(request, sismoProof);
    claimTo(destination);
  }

  /**
   * @dev Transfers the SBT to a new destination
   * @notice Mint/burn 2-tx flow (see L27)
   * @notice The address `to` must hold a ZK Badge
   * @param from address of the account that currently owns the SBT
   * @param to address of the account that will receive the SBT (must hold a ZK Badge)
   * @param tokenId id of the SBT to transfer (= ZK Badge nullifer)
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

  /**
   * @dev Transfers the SBT to a new destination
   * @notice Mint/burn 2-tx flow (see L27)
   * @notice The address `to` must hold a ZK Badge
   * @param from address of the account that currently owns the SBT
   * @param to address of the account that will receive the SBT (must hold a ZK Badge)
   * @param tokenId id of the SBT to transfer (= ZK Badge nullifer)
   */
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
   * @dev Transfers the SBT to a new destination
   * @notice Mint/burn 1-tx flow (see L29)
   * @param from address of the account that currently owns the SBT
   * @param to address of the account that will receive the SBT (must hold a ZK Badge with the id MERGOOOR_PASS_BADGE_TOKEN_ID)
   * @param tokenId id of the SBT to transfer
   * @param request user request containing the data needed to mint the ZK Badge
   * @param sismoProof Proof of eligibility to mint the ZK Badge
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
      revert BadgeDestinationAndSBTDestinationNotEqual(destination, to);
    }
    safeTransferFrom(from, destination, tokenId);
  }

  /**
   * @dev Prevent the transfer of a SBT if the destination address already owns a SBT
   * @param to Address to transfer the SBT to
   */
  function _beforeTokenTransfer(
    address,
    address to,
    uint256,
    uint256
  ) internal view override(ERC721Upgradeable) {
    // Prevent the transfer of a SBT if the destination address already owns a SBT
    // Not critical but lowers the complexity
    if (balanceOf(to) > 0) {
      revert ERC721AlreadyOwned(to, balanceOf(to));
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
   * @dev Set BaseTokenUri for SBT contract
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
