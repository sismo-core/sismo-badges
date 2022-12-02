// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;
pragma experimental ABIEncoderV2;

import {IHydraS1SimpleAttester} from '././IHydraS1SimpleAttester.sol';

/**
 * @title Hydra-S1 Accountbound Interface
 * @author Sismo
 * @notice Interface of the HydraS1AccountboundAttester contract which inherits from the errors, events and methods specific to the HydraS1SimpleAttester interface.
 **/
interface IHydraS1AccountboundAttester is IHydraS1SimpleAttester {
  /**
   * @dev Event emitted when the duration of the cooldown duration for a group index (internal collection id) has been set
   * @param groupIndex internal collection id
   * @param cooldownDuration the duration of the cooldown period
   **/
  event CooldownDurationSetForGroupIndex(uint256 indexed groupIndex, uint32 cooldownDuration);

  /**
   * @dev Event emitted when the nullifier has been set on cooldown. This happens when the
   * attestation destination of a nullifier has been changed
   * @param nullifier user nullifier
   * @param burnCount the number of times the attestation destination of a nullifier has been changed
   **/
  event NullifierSetOnCooldown(uint256 indexed nullifier, uint16 burnCount);

  /**
   * @dev Error when the nullifier is on cooldown. The user have to wait the cooldownDuration
   * before being able to change again the destination address.
   **/
  error NullifierOnCooldown(
    uint256 nullifier,
    address destination,
    uint16 burnCount,
    uint32 cooldownStart
  );

  /**
   * @dev Error when the cooldown duration for a given groupIndex is equal to zero.
   * The HydraS1AccountboundAttester behaves like the HydraS1SimpleAttester.
   **/
  error CooldownDurationNotSetForGroupIndex(uint256 groupIndex);

  /**
   * @dev Initializes the contract, to be called by the proxy delegating calls to this implementation
   * @param owner Owner of the contract, can update public key and address
   */
  function initialize(address owner) external;

  /**
   * @dev ABI-encodes nullifier and the burn count of the nullifier
   * @param nullifier user nullifier
   * @param claimDestination destination referenced in the user claim
   */
  function generateAccountboundExtraData(
    uint256 nullifier,
    address claimDestination
  ) external view returns (bytes memory);

  /**
   * @dev returns the nullifier for a given extraData
   * @param extraData bytes where the nullifier is encoded
   */
  function getNullifierFromExtraData(bytes memory extraData) external pure returns (uint256);

  /**
   * @dev Returns the burn count for a given extraData
   * @param extraData bytes where the burnCount is encoded
   */
  function getBurnCountFromExtraData(bytes memory extraData) external pure returns (uint16);

  /**
   * @dev Getter, returns the cooldown start of a nullifier
   * @param nullifier nullifier used
   **/
  function getNullifierCooldownStart(uint256 nullifier) external view returns (uint32);

  /**
   * @dev Getter, returns the burnCount of a nullifier
   * @param nullifier nullifier used
   **/
  function getNullifierBurnCount(uint256 nullifier) external view returns (uint16);

  /**
   * @dev Setter, sets the cooldown duration of a groupIndex
   * @param groupIndex internal collection id
   * @param cooldownDuration cooldown duration we want to set for the groupIndex
   **/
  function setCooldownDurationForGroupIndex(uint256 groupIndex, uint32 cooldownDuration) external;

  /**
   * @dev Getter, get the cooldown duration of a groupIndex
   * @param groupIndex internal collection id
   **/
  function getCooldownDurationForGroupIndex(uint256 groupIndex) external view returns (uint32);
}
