// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

import {AddressesProvider} from '../../core/utils/AddressesProvider.sol';
import {Badges} from '../../core/Badges.sol';
import {Attester} from '../../core/Attester.sol';
import {HydraS1AccountboundAttester} from '../../attesters/hydra-s1/HydraS1AccountboundAttester.sol';
import {Context} from '@openzeppelin/contracts/utils/Context.sol';
import {Request, Claim, Attestation} from '../../core/libs/Structs.sol';

enum BalanceRequirementType {
  gte,
  lte,
  equal
}

/**
 * @title UsingSismo
 * @author Sismo
 * @notice This contract is intended to be used by other contracts that need to mint Sismo Badges from Sismo proofs or check if an user holds certain Sismo Badges thanks
 * to high level functions such as `_mintSismoBadge` and `_requireBadges`.
 *
 * This contract can be viewed as a library that goes by pair with the "Prove With Sismo" off-chain flow. The "Prove With Sismo" off-chain flow is a flow that allows
 * users to prove that they are eligible to a specific Sismo Badge and mint it on-chain thanks to a Sismo proof and a request.
 * There are two different "Prove With Sismo" flows for on-chain gating:
 *
 * 2-txs flow: #1(tx) user is directed to Sismo and mints the Badge.
 *             #2(tx) app smart contract uses the onlyBadgeOwner modifier
 *                                            or _requireBadges check function
 *                    to gate their function to Badge holders only
 * 1-tx flow:  #1(off-chain) user is directed to Sismo to create a Sismo Proof of Badge eligibility
 *             #(tx): app smart contract uses the _mintSismoBadge function that forwards the proof to the Attester
 *                    The Attester checks the proof (and mints the Sismo Badge).
 *
 */

contract UsingSismo is Context {
  uint256 public constant SISMO_LIB_VERSION = 1;

  AddressesProvider public immutable ADDRESSES_PROVIDER =
    AddressesProvider(0x3340Ac0CaFB3ae34dDD53dba0d7344C1Cf3EFE05);

  HydraS1AccountboundAttester public immutable HYDRA_S1_ACCOUNTBOUND_ATTESTER;
  Badges public immutable BADGES;

  error UserDoesNotMeetAllRequirements(uint256 badgeTokenId, uint256 minBalance);
  error UserDoesNotMeetRequirements();
  error InvalidArgumentsLength();
  error WrongBalanceRequirementType();

  constructor() {
    string[] memory contractNames = new string[](2);
    contractNames[0] = 'HydraS1AccountboundAttester';
    contractNames[1] = 'Badges';

    address[] memory contractAddresses = ADDRESSES_PROVIDER.getBatch(contractNames);

    HYDRA_S1_ACCOUNTBOUND_ATTESTER = HydraS1AccountboundAttester(contractAddresses[0]);
    BADGES = Badges(contractAddresses[1]);
  }

  /*******************************************************
    1. MINT BADGES from sismoProof received by "Prove With Sismo" off-chain flow
  *******************************************************/

  /**
   * @dev Mint badge from sismoProof received by "Prove With Sismo" off-chain flow
   * @param request user request
   * @param sismoProof Sismo proof
   * @param attester Attester address (default = HYDRA_S1_ACCOUNTBOUND_ATTESTER, see the next function)
   * @return Address of the owner of the badges, tokenIds of the badges minted and levels of the badges minted
   * @notice This function will use the default attester (HYDRA_S1_ACCOUNTBOUND_ATTESTER) if no attester is specified.
   */
  function _mintSismoBadge(
    Request memory request,
    bytes memory sismoProof,
    address attester // default == HYDRA_S1_ACCOUNTBOUND_ATTESTER, see next function.
  ) public returns (address, uint256, uint256) {
    (address owner, uint256[] memory badgesTokenIds, uint256[] memory badgesLevels) = Attester(
      attester
    ).mintBadges(request, sismoProof);
    return (owner, badgesTokenIds[0], badgesLevels[0]);
  }

  /**
   * @dev Mint badge from sismoProof received by "Prove With Sismo" off-chain flow (DEFAULT ATTESTER USAGE)
   * @param request user request
   * @param sismoProof Sismo proof
   * @return Address of the owner of the badges, tokenIds of the badges minted and levels of the badges minted
   */
  function _mintSismoBadge(
    Request memory request,
    bytes memory sismoProof
  ) internal returns (address, uint256, uint256) {
    (
      address owner,
      uint256[] memory badgesTokenIds,
      uint256[] memory badgesLevels
    ) = HYDRA_S1_ACCOUNTBOUND_ATTESTER.mintBadges(request, sismoProof);

    return (owner, badgesTokenIds[0], badgesLevels[0]);
  }

  /**
   * @dev Mint badges from sismoProof received by "Prove With Sismo" off-chain flow
   * @param request user request
   * @param sismoProof Sismo proof
   * @param attester Attester address (default = HYDRA_S1_ACCOUNTBOUND_ATTESTER, see the next function)
   * @return Address of the owner of the badges, tokenIds of the badges minted and levels of the badges minted
   * @notice This function will use the default attester (HYDRA_S1_ACCOUNTBOUND_ATTESTER) if no attester is specified.
   */
  function _mintSismoBadges(
    Request memory request,
    bytes memory sismoProof,
    address attester // default == HYDRA_S1_ACCOUNTBOUND_ATTESTER, see next function.
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
  function _mintSismoBadges(
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
    2. CORE BADGE REQUIREMENTS FUNCTIONS 
    (with default values, see section 4)
  *******************************************************/

  /**
   * @dev Check if the user has the required badges
   * @param account User address
   * @param badgeTokenIds TokenIds of the required badges
   * @param isEachBadgeRequired If true, the user must have all the badges required. If false, the user must have at least one of the badges required. Default = false (see section 4).
   * @param requiredBalances Required balances of the required badges. Default = [1, .., 1] (see section 4).
   * @param balanceRequirementType Balance requirement type. Default = gte (see section 4).
   */
  function _requireBadges(
    address account,
    uint256[] memory badgeTokenIds,
    bool isEachBadgeRequired, // default = false, see Section 4.
    uint256[] memory requiredBalances, // default = [1, .., 1], see Section 4.
    BalanceRequirementType balanceRequirementType // default = [gte], see Section 4.
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

  /**
   * @dev Modifier to check if msg.sender has the required badge
   * @param badgeTokenId TokenId of the badge required
   */
  modifier onlyBadgeHolders(uint256 badgeTokenId) {
    _requireBadge(_msgSender(), badgeTokenId);
    _;
  }

  /**
   * @dev Modifier to check if msg.sender has the required badges
   * @param badgeTokenIds TokenIds of the badges required
   * @param isEachBadgeRequired If true, the user must have all the badges required. If false, the user must have at least one of the badges required. Default = false (see section 4).
   */
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

  /*******************************************************
    4. CORE FUNCTIONS WITH DEFAULT VALUES HARD CODED (SAME NAME, DIFFERENT SIGNATURES)
  *******************************************************/

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
    // by default, we require at least a balance of 1 for each badge
    for (uint32 i = 0; i < badgeTokenIds.length; i++) {
      arrayOfOnes[i] = 1;
    }
    _requireBadges(account, badgeTokenIds, isEachBadgeRequired, arrayOfOnes);
  }

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

  function _requireBadges(address account, uint256[] memory badgeTokenIds) internal view {
    _requireBadges(account, badgeTokenIds, false);
  }

  function _requireBadge(address account, uint256 badgeTokenId) internal view {
    uint256[] memory badgeTokenIds = new uint256[](1);
    badgeTokenIds[0] = badgeTokenId;
    _requireBadges(account, badgeTokenIds);
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
   * @dev Check if the balance of the badge meets the requirement
   * @param balance Balance of the badge
   * @param requiredBalance Required balance of the badge
   * @param balanceRequirementType Type of the balance requirement (gte, lte, equal)
   */
  function _isBalanceRequirementOk(
    uint256 balance,
    uint256 requiredBalance,
    BalanceRequirementType balanceRequirementType
  ) internal pure returns (bool) {
    if (balanceRequirementType == BalanceRequirementType.gte) {
      return balance >= requiredBalance;
    } else if (balanceRequirementType == BalanceRequirementType.lte) {
      return balance <= requiredBalance && balance > 0;
    } else if (balanceRequirementType == BalanceRequirementType.equal) {
      return balance == requiredBalance;
    } else {
      revert WrongBalanceRequirementType();
    }
  }
}
