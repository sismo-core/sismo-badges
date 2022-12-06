// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;
import 'hardhat/console.sol';

import {Badges} from '../../Badges.sol';
import {HydraS1AccountboundAttester} from '../../../attesters/hydra-s1/HydraS1AccountboundAttester.sol';

contract SismoGatedState {
  // polygon contract address
  address public constant BADGES_POLYGON_ADDRESS = 0xF12494e3545D49616D9dFb78E5907E9078618a34;
  address public constant HYDRA_S1_ACCOUNTBOUND_POLYGON_ADDRESS =
    0x10b27d9efa4A1B65412188b6f4F29e64Cf5e0146;

  // goerli contract address
  address public constant BADGES_GOERLI_ADDRESS = 0xE06B14D5835925e1642d7216F4563a1273509F10;
  address public constant HYDRA_S1_ACCOUNTBOUND_GOERLI_ADDRESS =
    0x89d80C9E65fd1aC8970B78A4F17E2e772030C1cB;

  // mumbai contract address
  address public constant BADGES_MUMBAI_ADDRESS = 0x5722fEa81027533721BA161964622271560da1aC;
  address public constant HYDRA_S1_ACCOUNTBOUND_MUMBAI_ADDRESS =
    0x069e6B99f4DA543156f66274FC6673442803C587;

  // local contract address
  address public constant BADGES_LOCAL_ADDRESS = 0xeF5b2Be9a6075a61bCA4384abc375485d5e196c3;
  address public constant HYDRA_S1_ACCOUNTBOUND_LOCAL_ADDRESS =
    0xf93A0C43A3466488D416628bf149495285e9f274;

  /**************************************
   * Storage slot
   * 20 slots
   * -> 4 slots used
   * -> 1 used by badges, 1 used by hydraS1AccountboundAttester, 1 used by gatedBadge and 1 used by _isNullifierUsed
   * * 0x0 - 0x20: Badges contract
   * 0x20 - 0x40: HydraS1AccountboundAttester contract
   * 0x40 - 0x60: Gated badge token id
   * 0x60 - 0x80: Nullifier used
   *
   * -> 16 free slots
   **************************************/

  Badges public badges;
  HydraS1AccountboundAttester public hydraS1AccountboundAttester;
  uint256 public gatedBadge;

  mapping(uint256 => bool) private _isNullifierUsed;

  uint256[16] private _storagePlaceHolders;

  /**
   * @dev Constructor
   * @param _gatedBadge Badge token id that is required to call the function using `onlyBadgesOwner` modifier
   */
  constructor(uint256 _gatedBadge) {
    // select the correct contract addresses based on the network
    if (block.chainid == 137) {
      badges = Badges(BADGES_POLYGON_ADDRESS);
      hydraS1AccountboundAttester = HydraS1AccountboundAttester(
        HYDRA_S1_ACCOUNTBOUND_POLYGON_ADDRESS
      );
    } else if (block.chainid == 5) {
      badges = Badges(BADGES_GOERLI_ADDRESS);
      hydraS1AccountboundAttester = HydraS1AccountboundAttester(
        HYDRA_S1_ACCOUNTBOUND_GOERLI_ADDRESS
      );
    } else if (block.chainid == 80001) {
      badges = Badges(BADGES_MUMBAI_ADDRESS);
      hydraS1AccountboundAttester = HydraS1AccountboundAttester(
        HYDRA_S1_ACCOUNTBOUND_MUMBAI_ADDRESS
      );
    } else {
      badges = Badges(BADGES_LOCAL_ADDRESS);
      hydraS1AccountboundAttester = HydraS1AccountboundAttester(
        HYDRA_S1_ACCOUNTBOUND_LOCAL_ADDRESS
      );
    }

    gatedBadge = _gatedBadge;
  }

  /**
   * @dev Getter to know if a nullifier has been used
   * @param nullifier Nullifier to check
   */
  function isNullifierUsed(uint256 nullifier) public view returns (bool) {
    return _isNullifierUsed[nullifier];
  }

  /**
   * @dev Marks a nullifier as used
   * @param nullifier Nullifier to mark as used
   */
  function _markNullifierAsUsed(uint256 nullifier) internal {
    _isNullifierUsed[nullifier] = true;
  }
}
