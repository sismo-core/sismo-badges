// SPDX-License-Identifier: MIT

pragma solidity ^0.8.14;
pragma experimental ABIEncoderV2;

import {IAirdrop721} from '../airdrop/IAirdrop721.sol';
import {IHydraS1AccountboundAttesterv2} from './IHydraS1AccountboundAttesterv2.sol';

/**
 * @title Hydra-S1 Accountbound Interface
 * @author Sismo
 * @notice Interface with inherits from the errors, events and methods specific to the HydraS1SimpleAttester interface and Accountbound interface.
 **/
interface IHydraS1Airdrop721AccountboundAttester is IAirdrop721, IHydraS1AccountboundAttesterv2 {

}
