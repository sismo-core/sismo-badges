// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Ownable} from '@openzeppelin/contracts/access/Ownable.sol';

import {IBadges} from '../../interfaces/IBadges.sol';
import {IAttestationsRegistry} from '../../interfaces/IAttestationsRegistry.sol';
import {IAttester} from '../../interfaces/IAttester.sol';

import {Request} from '../Structs.sol';

contract SismoGated is Ownable {
  IBadges public immutable BADGES;
  IAttestationsRegistry public immutable ATTESTATIONS_REGISTRY;

  uint256[] public gatedBadges;

  error UserIsNotOwnerOfBadge(uint256 collectionId);

  /**
   * @dev Constructor
   * @param badgesAddress Badges contract address
   */
  constructor(address badgesAddress, uint256[] memory _gatedBadges) {
    BADGES = IBadges(badgesAddress);
    ATTESTATIONS_REGISTRY = IAttestationsRegistry(BADGES.getAttestationsRegistry());
    gatedBadges = _gatedBadges;
  }

  /**
   * @dev Modifier allowing only the owners of badges referenced in `gatedBadges` to trigger the function
   */
  modifier onlyBadgesOwner() {
    for (uint256 i = 0; i < gatedBadges.length; i++) {
      if (!ATTESTATIONS_REGISTRY.hasAttestation(gatedBadges[i], msg.sender)) {
        revert UserIsNotOwnerOfBadge(gatedBadges[i]);
      }
    }
    _;
  }

  // function setGatedBadges(uint256[] memory collectionIds) public onlyOwner {
  //   for (uint256 i = 0; i < collectionIds.length; i++) {}
  // }

  function _proveWithSismo(
    address attesterAddress,
    Request memory request,
    bytes memory proofData
  ) internal {
    IAttester(attesterAddress).generateAttestations(request, proofData);
  }

  // function proveAndMintERC721(address to, uint256 tokenId, bytes calldata proofData) {}
}
