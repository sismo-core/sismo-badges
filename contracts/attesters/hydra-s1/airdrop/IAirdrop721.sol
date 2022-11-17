// SPDX-License-Identifier: MIT

pragma solidity ^0.8.14;
pragma experimental ABIEncoderV2;

// Core protocol Protocol imports
import {Request, Attestation, Claim} from '../../../core/libs/Structs.sol';
import {Attester, IAttester, IAttestationsRegistry} from '../../../core/Attester.sol';

// Imports related to HydraS1 Proving Scheme
import {HydraS1Base, HydraS1Lib, HydraS1ProofData, HydraS1ProofInput, HydraS1Claim} from '../../hydra-s1/base/HydraS1Base.sol';
import {HydraS1AccountboundLib, HydraS1AccountboundClaim} from '../../hydra-s1/libs/HydraS1AccountboundLib.sol';

interface IAirdrop721 {}
