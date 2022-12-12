// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

import {Ownable} from '@openzeppelin/contracts/access/Ownable.sol';
import {HydraS1AccountboundAttester} from '../../attesters/hydra-s1/HydraS1AccountboundAttester.sol';
import {Initializable} from '@openzeppelin/contracts/proxy/utils/Initializable.sol';

contract FrontendLib {
  address private immutable _hydraS1AccountboundAttester;

  constructor(address hydraS1AccountboundAttester) {
    _hydraS1AccountboundAttester = hydraS1AccountboundAttester;
  }

  function getHydraS1AccountboundAttesterDestinationOfNullifierBatch(
    uint256[] calldata nullifiers
  ) external view returns (address[] memory) {
    address[] memory destinations = new address[](nullifiers.length);

    for (uint256 i = 0; i < nullifiers.length; i++) {
      destinations[i] = HydraS1AccountboundAttester(_hydraS1AccountboundAttester)
        .getDestinationOfNullifier(nullifiers[i]);
    }

    return destinations;
  }
}
