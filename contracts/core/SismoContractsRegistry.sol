// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

import {AttestationsRegistry} from './AttestationsRegistry.sol';
import {Badges} from './Badges.sol';
import {Front} from './Front.sol';
import {HydraS1AccountboundAttester} from '../attesters/hydra-s1/HydraS1AccountboundAttester.sol';

contract SismoContractsRegistry {
  Badges public immutable BADGES;
  AttestationsRegistry public immutable ATTESTATIONS_REGISTRY;
  Front public immutable FRONT;
  HydraS1AccountboundAttester public immutable HYDRA_S1_ACCOUNTBOUND_ATTESTER;

  constructor(
    address badgesAddress,
    address attestationsRegistryAddress,
    address frontAddress,
    address hydraS1AccountboundAttester
  ) {
    BADGES = Badges(badgesAddress);
    ATTESTATIONS_REGISTRY = AttestationsRegistry(attestationsRegistryAddress);
    FRONT = Front(frontAddress);
    HYDRA_S1_ACCOUNTBOUND_ATTESTER = HydraS1AccountboundAttester(hydraS1AccountboundAttester);
  }

  function getBadges() external view returns (Badges) {
    return Badges(BADGES);
  }

  function getAttestationsRegistry() external view returns (AttestationsRegistry) {
    return AttestationsRegistry(ATTESTATIONS_REGISTRY);
  }

  function getFront() external view returns (Front) {
    return Front(FRONT);
  }

  function getHydraS1AccountboundAttester() external view returns (HydraS1AccountboundAttester) {
    return HydraS1AccountboundAttester(HYDRA_S1_ACCOUNTBOUND_ATTESTER);
  }
}
