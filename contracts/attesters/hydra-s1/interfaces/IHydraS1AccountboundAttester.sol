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
   * @dev Event emitted when the nullifier has been set on cooldown. This happens when the
   * attestation destination of a nullifier has been changed
   **/
  event NullifierSetOnCooldown(uint256 nullifier, uint16 burnCount);

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
   * @dev Error when the cooldown duration for a given groupId is equal to zero.
   * The HydraS1AccountboundAttester behaves like the HydraS1SimpleAttester.
   **/
  error CooldownDurationNotSetForGroupId(uint256 groupId);

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
   * @dev Setter, sets the cooldown duration of a groupId
   * @param groupId Id of the group
   * @param cooldownDuration cooldown duration we want to set for the groupId
   **/
  function setCooldownDurationForGroupId(uint256 groupId, uint32 cooldownDuration) external;

  /**
   * @dev Getter, get the cooldown duration of a groupId
   * @param groupId Id of the group
   **/
  function getCooldownDurationForGroupId(uint256 groupId) external view returns (uint32);
}
