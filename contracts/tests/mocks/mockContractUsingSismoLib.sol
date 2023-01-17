// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

import {UsingSismo, Request} from '../../libs/SismoLib.sol';

contract MockContractUsingSismoLib is UsingSismo {
  uint256 public constant FIRST_GATED_BADGE_ID = 200002;
  uint256 public constant SECOND_GATED_BADGE_ID = 200003;

  mapping(address => uint256) public balances;

  /*******************************************************
    1. MINT BADGES from sismoProof received by "Prove With Sismo" off-chain flow
  *******************************************************/

  function testMintSismoBadgeWithAttester(
    Request memory request,
    bytes memory proofData,
    address attester
  ) external {
    _mintSismoBadge(request, proofData, attester);
  }

  function testMintSismoBadge(Request memory request, bytes memory proofData) external {
    _mintSismoBadge(request, proofData);
  }

  function testMintSismoBadgesWithAttester(
    Request memory request,
    bytes memory proofData,
    address attester
  ) external {
    _mintSismoBadges(request, proofData, attester);
  }

  function testMintSismoBadges(Request memory request, bytes memory proofData) external {
    _mintSismoBadges(request, proofData);
  }

  /*******************************************************
    2. MODIFIERS
  *******************************************************/

  function testOnlyBadgeHoldersModifier() external onlyBadgeHolders(FIRST_GATED_BADGE_ID) {
    _inc(_msgSender());
  }

  function testOnlyBadgesHoldersWithAllBadgesRequiredModifier(
    uint256[] memory gatedBadge
  ) external onlyBadgesHolders(gatedBadge, true) {
    _inc(_msgSender());
  }

  function testOnlyBadgesHoldersWithOnlyOneBadgeRequiredModifier(
    uint256[] memory gatedBadge
  ) external onlyBadgesHolders(gatedBadge, false) {
    _inc(_msgSender());
  }

  function testOnlyBadgeHoldersWithGreaterBalanceModifier()
    external
    onlyBadgeHoldersWithGreaterBalance(FIRST_GATED_BADGE_ID, 2)
  {
    _inc(_msgSender());
  }

  function testOnlyBadgeHoldersWithLowerBalanceModifier()
    external
    onlyBadgeHoldersWithLowerBalance(FIRST_GATED_BADGE_ID, 2)
  {
    _inc(_msgSender());
  }

  function testOnlyBadgeHoldersWithExactBalanceModifier()
    external
    onlyBadgeHoldersWithExactBalance(FIRST_GATED_BADGE_ID, 1)
  {
    _inc(_msgSender());
  }

  function testOnlyBadgesHoldersWithGreaterBalanceAndAllBadgesRequiredModifier(
    uint256[] memory badgeTokenIds,
    uint256[] memory minBalances
  ) external onlyBadgesHoldersWithGreaterBalance(badgeTokenIds, minBalances, true) {
    _inc(_msgSender());
  }

  function testOnlyBadgesHoldersWithGreaterBalanceAndOnlyOneBadgeRequiredModifier(
    uint256[] memory badgeTokenIds,
    uint256[] memory minBalances
  ) external onlyBadgesHoldersWithGreaterBalance(badgeTokenIds, minBalances, false) {
    _inc(_msgSender());
  }

  function testOnlyBadgesHoldersWithLowerBalanceAndAllBadgesRequiredModifier(
    uint256[] memory badgeTokenIds,
    uint256[] memory maxBalances
  ) external onlyBadgesHoldersWithLowerBalance(badgeTokenIds, maxBalances, true) {
    _inc(_msgSender());
  }

  function testOnlyBadgesHoldersWithLowerBalanceAndOnlyOneBadgeRequiredModifier(
    uint256[] memory badgeTokenIds,
    uint256[] memory maxBalances
  ) external onlyBadgesHoldersWithLowerBalance(badgeTokenIds, maxBalances, false) {
    _inc(_msgSender());
  }

  function testOnlyBadgesHoldersWithExactBalanceAndAllBadgesRequiredModifier(
    uint256[] memory badgeTokenIds,
    uint256[] memory exactBalances
  ) external onlyBadgesHoldersWithExactBalance(badgeTokenIds, exactBalances, true) {
    _inc(_msgSender());
  }

  function testOnlyBadgesHoldersWithExactBalanceAndOnlyOneBadgeRequiredModifier(
    uint256[] memory badgeTokenIds,
    uint256[] memory exactBalances
  ) external onlyBadgesHoldersWithExactBalance(badgeTokenIds, exactBalances, false) {
    _inc(_msgSender());
  }

  function _inc(address account) internal {
    balances[account]++;
  }
}
