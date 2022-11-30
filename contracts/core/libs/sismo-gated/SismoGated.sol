// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;
import 'hardhat/console.sol';

import {Ownable} from '@openzeppelin/contracts/access/Ownable.sol';

import {IBadges} from '../../interfaces/IBadges.sol';
import {IAttestationsRegistry} from '../../interfaces/IAttestationsRegistry.sol';
import {IAttester} from '../../interfaces/IAttester.sol';

import {Request, Claim, Attestation} from '../Structs.sol';

contract SismoGated {
  IBadges public immutable BADGES;
  IAttester public immutable ATTESTER;

  uint256[] public allGatedBadges;
  mapping(uint256 => address) private _nullifiedAddresses;

  error UserIsNotOwnerOfBadge(uint256 collectionId);
  error NeedToMintWithProof();
  error GatedBadgesAreNotCorrect();

  /**
   * @dev Constructor
   * @param badgesAddress Badges contract address
   */
  constructor(address badgesAddress, address attesterAddress, uint256[] memory _gatedBadges) {
    BADGES = IBadges(badgesAddress);
    ATTESTER = IAttester(attesterAddress);
    allGatedBadges = _gatedBadges;
  }

  /**
   * @dev Modifier allowing only the owners of badges referenced in `gatedBadges` to trigger the function
   * @notice the burnCount for msg.sender should not be greater than zero
   */
  modifier onlyBadgesOwner(address to, uint256 badgeId) {
    bool canGate = false;
    for (uint256 i = 0; i < allGatedBadges.length; i++) {
      if (allGatedBadges[i] == badgeId) {
        canGate = true;
      }
    }
    if (!canGate) {
      revert GatedBadgesAreNotCorrect();
    }

    for (uint256 i = 0; i < allGatedBadges.length; i++) {
      if (BADGES.balanceOf(to, allGatedBadges[i]) == 0) {
        revert UserIsNotOwnerOfBadge(allGatedBadges[i]);
      }
    }

    (uint256 nullifier, ) = abi.decode(BADGES.getBadgeExtraData(to, badgeId), (uint256, uint16));

    console.log('nullifier', nullifier);

    if (_nullifiedAddresses[nullifier] != address(0x0)) {
      revert NeedToMintWithProof();
    }
    // set to address owning the badge for this nullifier to prevent from bypassing this modifier several times with different destination address
    _nullifiedAddresses[nullifier] = msg.sender;
    _;
  }

  function _proveWithSismo(bytes memory data) internal returns (Attestation[] memory, address) {
    Claim[] memory claims = new Claim[](1);
    address newDestination;
    bytes memory proofData;
    Request memory request;

    (claims[0], newDestination, proofData) = abi.decode(data, (Claim, address, bytes));

    request.claims = claims;
    request.destination = newDestination;

    Attestation[] memory attestations = ATTESTER.generateAttestations(request, proofData);
    (uint256 nullifier, ) = abi.decode(attestations[0].extraData, (uint256, uint16));

    address oldDestination = _nullifiedAddresses[nullifier];
    _nullifiedAddresses[nullifier] = newDestination;

    return (attestations, oldDestination);
  }
}
