// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;
pragma experimental ABIEncoderV2;

import {IHydraS1SimpleAttester} from '././IHydraS1SimpleAttester.sol';

/**
 * @title Hydra-S1 Accountbound Interface
 * @author Sismo
 * @notice Interface with inherits from the errors, events and methods specific to the HydraS1SimpleAttester interface and Accountbound interface.
 **/
interface IHydraS1AccountboundAttesterv2 is IHydraS1SimpleAttester {
  event NullifierSetOnCooldown(uint256 nullifier, uint16 burnCount);

  error CooldownDurationNotSetForGroupId(uint256 groupId);
  error NullifierOnCooldown(
    uint256 nullifier,
    address destination,
    uint16 burnCount,
    uint32 cooldownStart
  );
}
