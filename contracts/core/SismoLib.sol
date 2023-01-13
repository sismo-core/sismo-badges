// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;
import {UsingSismo as _UsingSismo} from './libs/using-sismo/UsingSismo.sol';

contract SismoLibVersion {
  uint256 public constant SISMO_LIB_VERSION = 1;
}

contract UsingSismo is _UsingSismo, SismoLibVersion {}
