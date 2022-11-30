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

  uint256 public immutable GATED_BADGE;
  mapping(uint256 => bool) private _isNullifierUsed;

  error UserIsNotOwnerOfBadge(uint256 collectionId);
  error NFTAlreadyMinted();

  /**
   * @dev Constructor
   * @param badgesAddress Badges contract address
   */
  constructor(address badgesAddress, address attesterAddress, uint256 _gatedBadge) {
    BADGES = IBadges(badgesAddress);
    ATTESTER = IAttester(attesterAddress);
    GATED_BADGE = _gatedBadge;
  }

  /**
   * @dev Modifier allowing only the owners of the `GATED_BADGE` to trigger the function
   * @notice a proof can also be sent to allow non-holders to prove their eligibility
   */
  modifier onlyBadgesOwner(address to, bytes calldata data) {
    if (BADGES.balanceOf(to, GATED_BADGE) == 0) {
      if (data.length == 0) {
        revert UserIsNotOwnerOfBadge(GATED_BADGE);
      }
      proveWithSismo(data);
    }

    // to remove to hydra-s1
    (uint256 nullifier, ) = abi.decode(
      BADGES.getBadgeExtraData(to, GATED_BADGE),
      (uint256, uint16)
    );

    if (_isNullifierUsed[nullifier]) {
      revert NFTAlreadyMinted();
    }
    // mark the nullifier as used to prevent from bypassing this modifier several times with different destination address
    _markNullifierAsUsed(nullifier);

    _;
  }

  function proveWithSismo(bytes memory data) public returns (uint256) {
    (Request memory request, bytes memory proofData) = _buildRequestAndProof(data);

    Attestation[] memory attestations = ATTESTER.generateAttestations(request, proofData);

    (uint256 nullifier, ) = abi.decode(attestations[0].extraData, (uint256, uint16));

    return nullifier;
  }

  function _buildRequestAndProof(
    bytes memory data
  ) internal pure returns (Request memory, bytes memory) {
    Claim[] memory claims = new Claim[](1);
    address newDestination;
    bytes memory proofData;
    Request memory request;

    (claims[0], newDestination, proofData) = abi.decode(data, (Claim, address, bytes));

    request.claims = claims;
    request.destination = newDestination;

    return (request, proofData);
  }

  function _markNullifierAsUsed(uint256 nullifier) internal {
    _isNullifierUsed[nullifier] = true;
  }
}
