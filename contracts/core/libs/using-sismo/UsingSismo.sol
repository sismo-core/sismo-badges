// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

import {Badges} from '../../Badges.sol';
import {Attester} from '../../Attester.sol';
import {HydraS1AccountboundAttester} from '../../../attesters/hydra-s1/HydraS1AccountboundAttester.sol';
import {Context} from '@openzeppelin/contracts/utils/Context.sol';
import {Request, Claim, Attestation} from '../Structs.sol';

enum BalanceRequirementType {
  gte,
  lte,
  equal
}

contract UsingSismo is Context {
  // this will be replaced by the contract registry
  HydraS1AccountboundAttester public immutable HYDRA_S1_ACCOUNTBOUND_ATTESTER =
    HydraS1AccountboundAttester(0x10b27d9efa4A1B65412188b6f4F29e64Cf5e0146);
  Badges public immutable BADGES = Badges(0xF12494e3545D49616D9dFb78E5907E9078618a34);

  error UserDoesNotMeetAllRequirements(uint256 badgeTokenId, uint256 minBalance);
  error UserDoesNotMeetRequirements();
  error InvalidArgumentsLength();
  error WrongBalanceRequirementType();

  /*******************************************************
    1. MINT BADGES from sismoProof received by "Prove With Sismo" off-chain flow
  *******************************************************/

  /**
   * @dev Mint badges from sismoProof received by "Prove With Sismo" off-chain flow
   * @param request user request
   * @param sismoProof Sismo proof
   * @param attester Attester address
   * @return Address of the owner of the badges, tokenIds of the badges minted and levels of the badges minted
   * @notice This function will use the default attester (HYDRA_S1_ACCOUNTBOUND_ATTESTER) if no attester is specified (see the function below).
   */
  function _mintSismoBadge(
    Request memory request,
    bytes memory sismoProof,
    address attester // default == HYDRA_S1_ACCOUNTBOUND_ATTESTER, see Section 3.
  ) public returns (address, uint256[] memory, uint256[] memory) {
    (address owner, uint256[] memory badgesTokenIds, uint256[] memory badgesLevels) = Attester(
      attester
    ).mintBadges(request, sismoProof);
    return (owner, badgesTokenIds, badgesLevels);
  }

  /**
   * @dev Mint badges from sismoProof received by "Prove With Sismo" off-chain flow (DEFAULT ATTESTER USAGE)
   * @param request user request
   * @param sismoProof Sismo proof
   * @return Address of the owner of the badges, tokenIds of the badges minted and levels of the badges minted
   */
  function _mintSismoBadge(
    Request memory request,
    bytes memory sismoProof
  ) internal returns (address, uint256[] memory, uint256[] memory) {
    (
      address owner,
      uint256[] memory badgesTokenIds,
      uint256[] memory badgesLevels
    ) = HYDRA_S1_ACCOUNTBOUND_ATTESTER.mintBadges(request, sismoProof);

    return (owner, badgesTokenIds, badgesLevels);
  }

  /*******************************************************
    2. CORE BADGE REQUIREMENTS FUNCTIONS, SEE BadgesRequirementsLib
    (with default values, see section 4)
  *******************************************************/

  function _requireBadges(
    address account,
    uint256[] memory badgeTokenIds,
    bool isEachBadgeRequired, // default = false, see Section 3.
    uint256[] memory requiredBalances, // default = [1, .., 1], see Section 3.
    BalanceRequirementType balanceRequirementType // default = [gte], see Section 3.
  ) internal view {
    _checkArgumentsLength(badgeTokenIds, requiredBalances);

    bool atLeastOneRequirementOk = false;

    for (uint32 i = 0; i < badgeTokenIds.length; i++) {
      uint256 balance = BADGES.balanceOf(account, badgeTokenIds[i]);
      uint256 requiredBalance = requiredBalances[i];
      if (_isBalanceRequirementOk(balance, requiredBalance, balanceRequirementType) == true) {
        atLeastOneRequirementOk = true;
      } else {
        if (isEachBadgeRequired) {
          revert UserDoesNotMeetAllRequirements(badgeTokenIds[i], requiredBalance);
        }
      }
    }
    if (!atLeastOneRequirementOk) {
      revert UserDoesNotMeetRequirements();
    }
  }

  function _requireBadge(
    address account,
    uint256 badgeTokenId,
    uint256 requiredBalance, // default = 1, see Section 3.
    BalanceRequirementType balanceRequirementType // default = gte, see Section 3.
  ) internal view {
    uint256[] memory badgeTokenIds = new uint256[](1);
    badgeTokenIds[0] = badgeTokenId;

    uint256[] memory requiredBalances = new uint256[](1);
    requiredBalances[0] = requiredBalance;
    _requireBadges(account, badgeTokenIds, false, requiredBalances, balanceRequirementType);
  }

  /*******************************************************
    3. MODIFIERS
  *******************************************************/

  modifier onlyBadgeHolders(uint256 badgeTokenId) {
    _requireBadge(_msgSender(), badgeTokenId);
    _;
  }

  modifier onlyBadgesHolders(uint256[] memory badgeTokenIds, bool isEachBadgeRequired) {
    _requireBadges(_msgSender(), badgeTokenIds, isEachBadgeRequired);
    _;
  }

  modifier onlyBadgeHoldersWithGreaterBalance(uint256 badgeTokenId, uint256 minBalance) {
    _requireBadge(_msgSender(), badgeTokenId, minBalance);
    _;
  }
  modifier onlyBadgeHoldersWithLowerBalance(uint256 badgeTokenId, uint256 maxBalance) {
    _requireBadge(_msgSender(), badgeTokenId, maxBalance, BalanceRequirementType.lte);
    _;
  }

  modifier onlyBadgeHoldersWithExactBalance(uint256 badgeTokenId, uint256 exactBalance) {
    _requireBadge(_msgSender(), badgeTokenId, exactBalance, BalanceRequirementType.equal);
    _;
  }

  modifier onlyBadgesHoldersWithGreaterBalance(
    uint256[] memory badgeTokenIds,
    uint256[] memory minBalances,
    bool isEachBadgeRequired
  ) {
    _requireBadges(_msgSender(), badgeTokenIds, isEachBadgeRequired, minBalances);
    _;
  }

  modifier onlyBadgesHoldersWithExactBalance(
    uint256[] memory badgeTokenIds,
    uint256[] memory exactBalances,
    bool isEachBadgeRequired
  ) {
    _requireBadges(
      _msgSender(),
      badgeTokenIds,
      isEachBadgeRequired,
      exactBalances,
      BalanceRequirementType.equal
    );
    _;
  }

  modifier onlyBadgesHoldersWithLowerBalance(
    uint256[] memory badgeTokenIds,
    uint256[] memory maxBalances,
    bool isEachBadgeRequired
  ) {
    _requireBadges(
      _msgSender(),
      badgeTokenIds,
      isEachBadgeRequired,
      maxBalances,
      BalanceRequirementType.lte
    );
    _;
  }

  /*******************************************************
    4. CORE FUNCTIONS WITH DEFAULT VALUES HARD CODED (SAME NAME, DIFFERENT SIGNATURES)
  *******************************************************/

  function _requireBadge(
    address account,
    uint256 badgeTokenId,
    uint256 requiredBalance
  ) internal view {
    uint256[] memory badgeTokenIds = new uint256[](1);
    badgeTokenIds[0] = badgeTokenId;

    uint256[] memory requiredBalances = new uint256[](1);
    requiredBalances[0] = requiredBalance;

    _requireBadges(account, badgeTokenIds, false, requiredBalances, BalanceRequirementType.gte);
  }

  function _requireBadge(address account, uint256 badgeTokenId) internal view {
    uint256[] memory badgeTokenIds = new uint256[](1);
    badgeTokenIds[0] = badgeTokenId;
    _requireBadges(account, badgeTokenIds);
  }

  function _requireBadges(
    address account,
    uint256[] memory badgeTokenIds,
    bool isEachBadgeRequired,
    uint256[] memory minBalances
  ) internal view {
    _requireBadges(
      account,
      badgeTokenIds,
      isEachBadgeRequired,
      minBalances,
      BalanceRequirementType.gte
    );
  }

  function _requireBadges(
    address account,
    uint256[] memory badgeTokenIds,
    bool isEachBadgeRequired
  ) internal view {
    uint256[] memory arrayOfOnes = new uint256[](badgeTokenIds.length);
    for (uint32 i = 0; i < badgeTokenIds.length; i++) {
      arrayOfOnes[i] = 1;
    }
    _requireBadges(account, badgeTokenIds, isEachBadgeRequired, arrayOfOnes);
  }

  function _requireBadges(address account, uint256[] memory badgeTokenIds) internal view {
    uint256[] memory arrayOfOnes = new uint256[](badgeTokenIds.length);
    for (uint32 i = 0; i < badgeTokenIds.length; i++) {
      arrayOfOnes[i] = 1;
    }
    _requireBadges(account, badgeTokenIds, false);
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

  function _isBalanceRequirementOk(
    uint256 balance,
    uint256 requiredBalance,
    BalanceRequirementType balanceRequirementType
  ) internal pure returns (bool) {
    if (balanceRequirementType == BalanceRequirementType.gte) {
      return balance >= requiredBalance;
    } else if (balanceRequirementType == BalanceRequirementType.lte) {
      return balance <= requiredBalance;
    } else if (balanceRequirementType == BalanceRequirementType.equal) {
      return balance == requiredBalance;
    } else {
      revert WrongBalanceRequirementType();
    }
  }
}
