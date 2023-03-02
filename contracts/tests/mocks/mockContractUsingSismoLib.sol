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

  function mintSismoBadgeWithAttester(
    Request memory request,
    bytes memory proofData,
    address attester
  ) external {
    _mintSismoBadge(request, proofData, attester);
  }

  function mintSismoBadge(Request memory request, bytes memory proofData) external {
    _mintSismoBadge(request, proofData);
  }

  function mintSismoBadgesWithAttester(
    Request memory request,
    bytes memory proofData,
    address attester
  ) external {
    _mintSismoBadges(request, proofData, attester);
  }

  function mintSismoBadges(Request memory request, bytes memory proofData) external {
    _mintSismoBadges(request, proofData);
  }

  /*******************************************************
    2. MODIFIERS
  *******************************************************/

  function onlyBadgeHoldersModifier() external onlyBadgeHolders(FIRST_GATED_BADGE_ID) {
    _inc(_msgSender());
  }

  function onlyBadgesHoldersWithAllBadgesRequiredModifier(
    uint256[] memory gatedBadge
  ) external onlyBadgesHolders(gatedBadge, true) {
    _inc(_msgSender());
  }

  function onlyBadgesHoldersWithOnlyOneBadgeRequiredModifier(
    uint256[] memory gatedBadge
  ) external onlyBadgesHolders(gatedBadge, false) {
    _inc(_msgSender());
  }

  function onlyBadgeHoldersWithGreaterBalanceModifier()
    external
    onlyBadgeHoldersWithGreaterBalance(FIRST_GATED_BADGE_ID, 2)
  {
    _inc(_msgSender());
  }

  function onlyBadgeHoldersWithLowerBalanceModifier()
    external
    onlyBadgeHoldersWithLowerBalance(FIRST_GATED_BADGE_ID, 2)
  {
    _inc(_msgSender());
  }

  function onlyBadgeHoldersWithExactBalanceModifier()
    external
    onlyBadgeHoldersWithExactBalance(FIRST_GATED_BADGE_ID, 1)
  {
    _inc(_msgSender());
  }

  function onlyBadgesHoldersWithGreaterBalanceAndAllBadgesRequiredModifier(
    uint256[] memory badgeTokenIds,
    uint256[] memory minBalances
  ) external onlyBadgesHoldersWithGreaterBalance(badgeTokenIds, minBalances, true) {
    _inc(_msgSender());
  }

  function onlyBadgesHoldersWithGreaterBalanceAndOnlyOneBadgeRequiredModifier(
    uint256[] memory badgeTokenIds,
    uint256[] memory minBalances
  ) external onlyBadgesHoldersWithGreaterBalance(badgeTokenIds, minBalances, false) {
    _inc(_msgSender());
  }

  function onlyBadgesHoldersWithLowerBalanceAndAllBadgesRequiredModifier(
    uint256[] memory badgeTokenIds,
    uint256[] memory maxBalances
  ) external onlyBadgesHoldersWithLowerBalance(badgeTokenIds, maxBalances, true) {
    _inc(_msgSender());
  }

  function onlyBadgesHoldersWithLowerBalanceAndOnlyOneBadgeRequiredModifier(
    uint256[] memory badgeTokenIds,
    uint256[] memory maxBalances
  ) external onlyBadgesHoldersWithLowerBalance(badgeTokenIds, maxBalances, false) {
    _inc(_msgSender());
  }

  function onlyBadgesHoldersWithExactBalanceAndAllBadgesRequiredModifier(
    uint256[] memory badgeTokenIds,
    uint256[] memory exactBalances
  ) external onlyBadgesHoldersWithExactBalance(badgeTokenIds, exactBalances, true) {
    _inc(_msgSender());
  }

  function onlyBadgesHoldersWithExactBalanceAndOnlyOneBadgeRequiredModifier(
    uint256[] memory badgeTokenIds,
    uint256[] memory exactBalances
  ) external onlyBadgesHoldersWithExactBalance(badgeTokenIds, exactBalances, false) {
    _inc(_msgSender());
  }

  function _inc(address account) internal {
    balances[account]++;
  }
}
