// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;
import 'hardhat/console.sol';

import {Badges} from '../../Badges.sol';
import {Attester} from '../../Attester.sol';
import {HydraS1AccountboundAttester} from '../../../attesters/hydra-s1/HydraS1AccountboundAttester.sol';

import {Request, Claim, Attestation} from '../Structs.sol';

contract SismoGated {
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
  address public immutable BADGES_LOCAL_ADDRESS;
  address public immutable HYDRA_S1_ACCOUNTBOUND_LOCAL_ADDRESS;

  Badges public immutable BADGES;
  HydraS1AccountboundAttester public immutable HYDRA_S1_ACCOUNTBOUND_ATTESTER;

  error UnsupportedNetwork();
  error InvalidArgumentsLength();
  error UserIsNotOwnerOfBadge(uint256 badgeTokenId, uint256 balance);
  error UserDoesNotHoldAnyRequiredBadge();

  /**
   * @dev Constructor
   */
  constructor(address badgesLocalAddress, address hydraS1AccountboundLocalAddress) {
    BADGES_LOCAL_ADDRESS = badgesLocalAddress;
    HYDRA_S1_ACCOUNTBOUND_LOCAL_ADDRESS = hydraS1AccountboundLocalAddress;

    // select the correct contract addresses based on the network
    (address badgesAddress, address hydraS1AccountboundAttesterAddress) = _getContractAddresses();
    BADGES = Badges(badgesAddress);
    HYDRA_S1_ACCOUNTBOUND_ATTESTER = HydraS1AccountboundAttester(
      hydraS1AccountboundAttesterAddress
    );
  }

  modifier ERC1155Gated(
    address account,
    uint256 badgeTokenId,
    uint256 minBalance
  ) {
    uint256[] memory badgeTokenIds = new uint256[](1);
    badgeTokenIds[0] = badgeTokenId;

    uint256[] memory minBalances = new uint256[](1);
    minBalances[0] = minBalance;

    checkAccountBadges(account, badgeTokenIds, minBalances, false);

    _;
  }

  function checkAccountBadges(
    address account,
    uint256[] memory badgeTokenIds,
    uint256[] memory minBalances,
    bool isInclusive
  ) public view {
    _checkArgumentsLength(badgeTokenIds, minBalances);

    uint32 holdedBadgesByAccount = 0;

    for (uint32 i = 0; i < badgeTokenIds.length; i++) {
      uint256 balance = BADGES.balanceOf(account, badgeTokenIds[i]);
      if (balance < minBalances[i]) {
        if (!isInclusive) {
          revert UserIsNotOwnerOfBadge(badgeTokenIds[i], balance);
        }
      } else {
        holdedBadgesByAccount += 1;
      }
    }

    if (holdedBadgesByAccount == 0) {
      revert UserDoesNotHoldAnyRequiredBadge();
    }
  }

  /**
   * @dev Prove the eligibility of an address with Sismo
   * @param attester Attester contract used to verify request and proof
   * @param request user request
   * @param sismoProof Bytes containing the proof associated to the user request
   */
  function proveWithSismo(
    Attester attester,
    Request memory request,
    bytes memory sismoProof
  ) public returns (address, uint256[] memory) {
    (address owner, , uint256[] memory values) = attester.mintBadges(request, sismoProof);

    return (owner, values);
  }

  /**
   * @dev Check if the arguments have the same length
   * @param badgeTokenIds Token ID of the badges
   * @param minBalances Minimum balances (= levels) of the badges
   */
  function _checkArgumentsLength(
    uint256[] memory badgeTokenIds,
    uint256[] memory minBalances
  ) internal pure {
    if (badgeTokenIds.length != minBalances.length) {
      revert InvalidArgumentsLength();
    }
  }

  /**
   * @dev Get the contract addresses based on the network
   */
  function _getContractAddresses() internal view returns (address, address) {
    address badgesAddress;
    address hydraS1AccountboundAttesterAddress;

    if (block.chainid == 137) {
      badgesAddress = BADGES_POLYGON_ADDRESS;
      hydraS1AccountboundAttesterAddress = HYDRA_S1_ACCOUNTBOUND_POLYGON_ADDRESS;
    } else if (block.chainid == 5) {
      badgesAddress = BADGES_GOERLI_ADDRESS;
      hydraS1AccountboundAttesterAddress = HYDRA_S1_ACCOUNTBOUND_GOERLI_ADDRESS;
    } else if (block.chainid == 80001) {
      badgesAddress = BADGES_MUMBAI_ADDRESS;
      hydraS1AccountboundAttesterAddress = HYDRA_S1_ACCOUNTBOUND_MUMBAI_ADDRESS;
    } else if (block.chainid == 31337 || block.chainid == 1337) {
      badgesAddress = BADGES_LOCAL_ADDRESS;
      hydraS1AccountboundAttesterAddress = HYDRA_S1_ACCOUNTBOUND_LOCAL_ADDRESS;
    } else {
      revert UnsupportedNetwork();
    }

    return (badgesAddress, hydraS1AccountboundAttesterAddress);
  }
}
