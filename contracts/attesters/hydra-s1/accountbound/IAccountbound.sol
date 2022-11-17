// SPDX-License-Identifier: MIT

pragma solidity ^0.8.14;
pragma experimental ABIEncoderV2;

// Core protocol Protocol imports
import {Request, Attestation, Claim} from '../../../core/libs/Structs.sol';
import {Attester, IAttester, IAttestationsRegistry} from '../../../core/Attester.sol';

// Imports related to HydraS1 Proving Scheme
import {HydraS1Base, HydraS1Lib, HydraS1ProofData, HydraS1ProofInput, HydraS1Claim} from '../../hydra-s1/base/HydraS1Base.sol';
import {HydraS1AccountboundLib, HydraS1AccountboundClaim} from '../../hydra-s1/libs/HydraS1AccountboundLib.sol';

interface IAccountbound {
  struct AccountboundClaim {
    address destination; // user claims to own this destination[]
    uint256 claimedValue; // user claims this value for its account in the group
    uint128 groupIndex;
    uint32 generationTimestamp;
    uint32 cooldownDuration;
  }

  function handleAccountboundBurnCount(
    uint256 userTicket,
    address ticketDestination,
    address claimDestination
  ) external view returns (uint16);

  /**
   * @dev Event emitted when the userTicket has been set on cooldown. This happens when the
   * attestation destination of a ticket has been changed
   **/
  event TicketSetOnCooldown(uint256 ticket, uint16 burnCount);

  /**
   * @dev Error when the userTicket is on cooldown. The user have to wait the cooldownDuration
   * before being able to change again the destination address.
   **/
  error TicketOnCooldown(
    uint256 userTicket,
    address destination,
    uint16 burnCount,
    uint32 cooldownDuration
  );
}
