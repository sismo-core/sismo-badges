// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Ownable} from '@openzeppelin/contracts/access/Ownable.sol';

import {IBadges} from '../../interfaces/IBadges.sol';
import {IAttestationsRegistry} from '../../interfaces/IAttestationsRegistry.sol';
import {IAttester} from '../../interfaces/IAttester.sol';

import {Request} from '../Structs.sol';

contract SismoGated {
  IBadges public immutable BADGES;
  IAttester public immutable ATTESTER;

  uint256[] public gatedBadges;

  error UserIsNotOwnerOfBadge(uint256 collectionId);

  /**
   * @dev Constructor
   * @param badgesAddress Badges contract address
   */
  constructor(address badgesAddress, address attesterAddress, uint256[] memory _gatedBadges) {
    BADGES = IBadges(badgesAddress);
    ATTESTER = IAttester(attesterAddress);
    gatedBadges = _gatedBadges;
  }

  /**
   * @dev Modifier allowing only the owners of badges referenced in `gatedBadges` to trigger the function
   */
  modifier onlyBadgesOwner() {
    for (uint256 i = 0; i < gatedBadges.length; i++) {
      if (BADGES.balanceOf(msg.sender, gatedBadges[i]) == 0) {
        revert UserIsNotOwnerOfBadge(gatedBadges[i]);
      }
    }
    _;
  }

  function _proveWithSismo(bytes calldata data) internal {
    (Request memory request, bytes memory proofData) = abi.decode(data, (Request, bytes));

    ATTESTER.generateAttestations(request, proofData);
  }

  // function proveAndMintERC721(address to, uint256 tokenId, bytes calldata proofData) {}
}
