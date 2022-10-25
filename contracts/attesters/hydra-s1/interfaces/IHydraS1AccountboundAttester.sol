// SPDX-License-Identifier: MIT

pragma solidity ^0.8.14;
pragma experimental ABIEncoderV2;

import {Attestation} from '../../../core/libs/Structs.sol';
import {IAttester} from '../../../core/interfaces/IAttester.sol';
import {CommitmentMapperRegistry} from '../../../periphery/utils/CommitmentMapperRegistry.sol';
import {AvailableRootsRegistry} from '../../../periphery/utils/AvailableRootsRegistry.sol';
import {HydraS1Lib, HydraS1ProofData, HydraS1ProofInput} from './../libs/HydraS1Lib.sol';
import {IHydraS1Base} from './../base/IHydraS1Base.sol';

/**
 * @title Hydra-S1 Accountbound Interface
 * @author Sismo
 * @notice Interface with the errors, events and methods specific to the HydraS1AcountboundAttester.
 **/
interface IHydraS1AccountboundAttester is IHydraS1Base, IAttester {
  struct TicketData {
    address destination;
    uint32 cooldownStart;
    uint16 burnCount;
  }

  /**
   * @dev Error when the userTicket is on cooldown. The user have to wait the cooldownDuration
   * before being able to change again the destination address.
   **/
  error TicketOnCooldown(TicketData ticketData, uint32 cooldownDuration);

  /**
   * @dev Error when the collectionId of an attestation overflow the AUTHORIZED_COLLECTION_ID_LAST
   **/
  error CollectionIdOutOfBound(uint256 collectionId);

  /**
   * @dev Event emitted when the userTicket (or nullifierHash) is associated to a destination address.
   **/
  event TicketDestinationUpdated(uint256 ticket, address newOwner);

  /**
   * @dev Event emitted when the userTicket has been set on cooldown. This happens when the
   * attestation destination of a ticket has been changed
   **/
  event TicketSetOnCooldown(uint256 ticket, uint16 burnCount);

  /**
   * @dev Getter, returns the data linked to a ticket
   * @param userTicket ticket used
   **/
  function getTicketData(uint256 userTicket) external view returns (TicketData memory);

  /**
   * @dev Getter, returns the last attestation destination of a ticket
   * @param userTicket ticket used
   **/
  function getDestinationOfTicket(uint256 userTicket) external view returns (address);

  /**
   * @dev Getter
   * returns of the first collection in which the attester is supposed to record
   **/
  function AUTHORIZED_COLLECTION_ID_FIRST() external view returns (uint256);

  /**
   * @dev Getter
   * returns of the last collection in which the attester is supposed to record
   **/
  function AUTHORIZED_COLLECTION_ID_LAST() external view returns (uint256);
}
