// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {ERC1155} from '@openzeppelin/contracts/token/ERC1155/ERC1155.sol';
import {Initializable} from '@openzeppelin/contracts/proxy/utils/Initializable.sol';
import {ERC1155Pausable} from '@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Pausable.sol';
import {AccessControl} from '@openzeppelin/contracts/access/AccessControl.sol';
import {IAttestationsRegistry} from './interfaces/IAttestationsRegistry.sol';
import {IBadges} from './interfaces/IBadges.sol';

/**
 * @title Badges contract
 * @author Sismo
 * @notice Stateless, Non-transferrable ERC1155 contract. Reads balance from the values of attestations
 * The associated attestations registry triggers TransferSingle events from this contract
 * It allows badge "shadow mints and burns" to be caught by off-chain platforms
 * For more information: https://badges.docs.sismo.io
 */
contract Badges is IBadges, Initializable, AccessControl, ERC1155 {
  // implementation version
  uint8 public constant VERSION = 3;

  IAttestationsRegistry internal _attestationsRegistry;

  bytes32 public constant EVENT_TRIGGERER_ROLE = keccak256('EVENT_TRIGGERER_ROLE');

  /**
   * @dev Constructor
   * @param uri Uri for the metadata of badges
   * @param owner Owner of the contract, super admin, can setup roles and update the attestation registry
   */
  constructor(
    string memory uri,
    address owner // This is Sismo Frontend Contract
  ) ERC1155(uri) {
    initialize(uri, owner);
  }

  /**
   * @dev Initializes the contract, to be called by the proxy delegating calls to this implementation
   * @param uri Uri for the metadata of badges
   * @param owner Owner of the contract, super admin, can setup roles and update the attestation registry
   * @notice The reinitializer modifier is needed to configure modules that are added through upgrades and that require initialization.
   */
  function initialize(string memory uri, address owner) public reinitializer(VERSION) {
    _setURI(uri);
    _grantRole(DEFAULT_ADMIN_ROLE, owner);
  }

  /**
   * @dev Main function of the ERC1155 badge
   * The balance of a user is equal to the value of the underlying attestation.
   * attestationCollectionId == badgeId
   * @param account Address to check badge balance (= value of attestation)
   * @param id Badge Id to check (= attestationCollectionId)
   */
  function balanceOf(
    address account,
    uint256 id
  ) public view virtual override(ERC1155, IBadges) returns (uint256) {
    return _attestationsRegistry.getAttestationValue(id, account);
  }

  /**
   * @dev Reverts, this is a non transferable ERC115 contract
   */
  function setApprovalForAll(address operator, bool approved) public virtual override {
    revert BadgesNonTransferrable();
  }

  /**
   * @dev Reverts, this is a non transferable ERC115 contract
   */
  function isApprovedForAll(
    address account,
    address operator
  ) public view virtual override returns (bool) {
    revert BadgesNonTransferrable();
  }

  /**
   * @dev Emits a TransferSingle event, so subgraphs and other off-chain apps relying on events can see badge minting/burning
   * can only be called by address having the EVENT_TRIGGERER_ROLE (attestations registry address)
   * @param operator who is calling the TransferEvent
   * @param from address(0) if minting, address of the badge holder if burning
   * @param to address of the badge holder is minting, address(0) if burning
   * @param id badgeId for which to trigger the event
   * @param value minted/burned balance
   */
  function triggerTransferEvent(
    address operator,
    address from,
    address to,
    uint256 id,
    uint256 value
  ) external onlyRole(EVENT_TRIGGERER_ROLE) {
    emit TransferSingle(operator, from, to, id, value);
  }

  /**
   * @dev Set the attestations registry address. Can only be called by owner (default admin)
   * @param attestationsRegistry new attestations registry address
   */
  function setAttestationsRegistry(
    address attestationsRegistry
  ) external override onlyRole(DEFAULT_ADMIN_ROLE) {
    _attestationsRegistry = IAttestationsRegistry(attestationsRegistry);
  }

  /**
   * @dev Set the URI. Can only be called by owner (default admin)
   * @param uri new attestations registry address
   */
  function setUri(string memory uri) external override onlyRole(DEFAULT_ADMIN_ROLE) {
    _setURI(uri);
  }

  /**
   * @dev Getter of the attestations registry
   */
  function getAttestationsRegistry() external view override returns (address) {
    return address(_attestationsRegistry);
  }

  /**
   * @dev Getter of the badge issuer
   * @param account Address that holds the badge
   * @param id Badge Id to check (= attestationCollectionId)
   */
  function getBadgeIssuer(address account, uint256 id) external view returns (address) {
    return _attestationsRegistry.getAttestationIssuer(id, account);
  }

  /**
   * @dev Getter of the badge timestamp
   * @param account Address that holds the badge
   * @param id Badge Id to check (= attestationCollectionId)
   */
  function getBadgeTimestamp(address account, uint256 id) external view returns (uint32) {
    return _attestationsRegistry.getAttestationTimestamp(id, account);
  }

  /**
   * @dev Getter of the badge extra data (it can store nullifier and burnCount)
   * @param account Address that holds the badge
   * @param id Badge Id to check (= attestationCollectionId)
   */
  function getBadgeExtraData(address account, uint256 id) external view returns (bytes memory) {
    return _attestationsRegistry.getAttestationExtraData(id, account);
  }

  /**
   * @dev Getter of the value of a specific badge attribute
   * @param id Badge Id to check (= attestationCollectionId)
   * @param index Index of the attribute
   */
  function getAttributeValueForBadge(uint256 id, uint8 index) external view returns (uint8) {
    return _attestationsRegistry.getAttributeValueForAttestationsCollection(id, index);
  }

  /**
   * @dev Getter of all badge attributes and their values for a specific badge
   * @param id Badge Id to check (= attestationCollectionId)
   */
  function getAttributesNamesAndValuesForBadge(
    uint256 id
  ) external view returns (bytes32[] memory, uint8[] memory) {
    return _attestationsRegistry.getAttributesNamesAndValuesForAttestationsCollection(id);
  }

  /**
   * @dev ERC165
   */
  function supportsInterface(
    bytes4 interfaceId
  ) public view virtual override(AccessControl, ERC1155) returns (bool) {
    return super.supportsInterface(interfaceId);
  }

  /**
   * @dev Reverts, this is a non transferable ERC115 contract
   */
  function _beforeTokenTransfer(
    address operator,
    address from,
    address to,
    uint256[] memory ids,
    uint256[] memory amounts,
    bytes memory data
  ) internal virtual override {
    revert BadgesNonTransferrable();
  }
}
