// SPDX-License-Identifier: MIT

pragma solidity ^0.8.14;
pragma experimental ABIEncoderV2;

import {IAccountbound} from './IAccountbound.sol';

// Core protocol Protocol imports
import {Request, Attestation, Claim} from '../../../core/libs/Structs.sol';
import {Attester, IAttester, IAttestationsRegistry} from './../../../core/Attester.sol';

/**
 * @title  Accountbound Abstract contract
 * @author Sismo
 * @notice Abstract contract that facilitates the use of the Accountbound logic for attesters.
 */
contract Accountbound is IAccountbound {
  mapping(uint256 => uint32) internal _ticketsCooldownStart;
  mapping(uint256 => uint32) internal _groupIdCooldowns;
  mapping(uint256 => uint16) internal _ticketsBurnCount;

  uint32 public immutable DEFAULT_COOLDOWN_DURATION;

  constructor(uint32 defaultCooldownDuration) {
    DEFAULT_COOLDOWN_DURATION = defaultCooldownDuration;
  }

  /**
   * @dev Returns the actual attestations constructed from the user claim and ticket
   * @param claimDestination destiantion referenced in the user claim
   * @param userTicket user ticket
   */
  function handleAccountboundBurnCount(
    uint256 userTicket,
    address ticketDestination,
    address claimDestination
  ) public view virtual returns (uint16) {
    uint16 burnCount = _ticketsBurnCount[userTicket];
    // If the attestation is minted on a new destination address
    // the burnCount encoded in the extraData of the Attestation should be incremented
    if (ticketDestination != address(0) && ticketDestination != claimDestination) {
      burnCount += 1;
    }
    return (burnCount);
  }

  /**
   * @dev Hook run before recording the attestation.
   * Throws if ticket already used, not a renewal, and ticket on cooldown.
   * @param userTicket ticket of the user
   * @param oldDestination destination address of the userTicket
   * @param newDestination destination specified in the user claim.
   */
  function _isCooldownRenewedForTicket(
    uint256 userTicket,
    address oldDestination,
    address newDestination,
    uint256 groupId
  ) internal virtual returns (bool) {
    uint16 burnCount = _getTicketBurnCount(userTicket);

    if (oldDestination != address(0) && oldDestination != newDestination) {
      uint32 cooldownDuration = _getCooldownDurationForGroupId(groupId);
      if (_isOnCooldown(userTicket, cooldownDuration))
        revert TicketOnCooldown(userTicket, oldDestination, burnCount, cooldownDuration);
      return true;
    }
    return false;
  }

  function _setTicketOnCooldown(uint256 userTicket) internal {
    _ticketsCooldownStart[userTicket] = uint32(block.timestamp);
    _ticketsBurnCount[userTicket] += 1;
    emit TicketSetOnCooldown(userTicket, _ticketsBurnCount[userTicket]);
  }

  function _isOnCooldown(uint256 userTicket, uint32 cooldownDuration) internal view returns (bool) {
    return _getTicketCooldownStart(userTicket) + cooldownDuration > block.timestamp;
  }

  function getTicketCooldownStart(uint256 userTicket) external view returns (uint32) {
    return _getTicketCooldownStart(userTicket);
  }

  function _getTicketCooldownStart(uint256 userTicket) internal view returns (uint32) {
    return _ticketsCooldownStart[userTicket];
  }

  function getTicketBurnCount(uint256 userTicket) external view returns (uint16) {
    return _getTicketBurnCount(userTicket);
  }

  function _getTicketBurnCount(uint256 userTicket) internal view returns (uint16) {
    return _ticketsBurnCount[userTicket];
  }

  function setCooldownDurationForgroupId(uint256 groupId, uint32 cooldownDuration) public {
    _groupIdCooldowns[groupId] = cooldownDuration;
  }

  function getCooldownDurationForGroupId(uint256 groupId) external view returns (uint32) {
    return _getCooldownDurationForGroupId(groupId);
  }

  function _getCooldownDurationForGroupId(uint256 groupId) internal view returns (uint32) {
    uint32 cooldownDuration = _groupIdCooldowns[groupId];
    if (cooldownDuration == 0) {
      cooldownDuration = DEFAULT_COOLDOWN_DURATION;
    }
    return cooldownDuration;
  }
}
