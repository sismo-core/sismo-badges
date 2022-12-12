// SPDX-License-Identifier: MIT

pragma solidity ^0.8.14;

import {Attestation, Request} from '../core/libs/Structs.sol';
import {Attester} from '../core/Attester.sol';
import {IAttester} from '../core/interfaces/IAttester.sol';
import {IHydraS1AccountboundAttester} from '../attesters/hydra-s1/interfaces/IHydraS1AccountboundAttester.sol';

contract MockHydraS1SimpleAttester {
  mapping(uint256 => address) internal _nullifiersDestinations;

  function getDestinationOfNullifier(uint256 nullifier) external view returns (address) {
    return _nullifiersDestinations[nullifier];
  }

  function setDestinationOfNullifier(uint256 nullifier, address destination) external {
    _nullifiersDestinations[nullifier] = destination;
  }
}
