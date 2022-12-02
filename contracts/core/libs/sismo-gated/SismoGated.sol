// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;
import 'hardhat/console.sol';

import {Ownable} from '@openzeppelin/contracts/access/Ownable.sol';

import {IBadges} from '../../interfaces/IBadges.sol';
import {IAttestationsRegistry} from '../../interfaces/IAttestationsRegistry.sol';
import {IHydraS1Base} from '../../../attesters/hydra-s1/base/IHydraS1Base.sol';

import {Request, Claim, Attestation} from '../Structs.sol';

contract SismoGated {
  IBadges public immutable BADGES;
  IHydraS1Base public immutable ATTESTER;

  uint256 public immutable GATED_BADGE;
  mapping(uint256 => bool) private _isNullifierUsed;

  error UserIsNotOwnerOfBadge(uint256 collectionId);
  error NFTAlreadyMinted();

  /**
   * @dev Constructor
   * @param badgesAddress Badges contract address
   * @param attesterAddress Hydra S1 attester contract address
   * @param gatedBadge Badge token id that is required to call the function using `onlyBadgesOwner` modifier
   */
  constructor(address badgesAddress, address attesterAddress, uint256 gatedBadge) {
    BADGES = IBadges(badgesAddress);
    ATTESTER = IHydraS1Base(attesterAddress);
    GATED_BADGE = gatedBadge;
  }

  /**
   * @dev Modifier allowing only the owners of the `GATED_BADGE` to trigger the function
   * @param to Address of the badge owner
   * @param data Data containing the user request and the proof associated to it
   * @notice a proof can also be sent to allow non-holders to prove their eligibility
   */
  modifier onlyBadgesOwner(address to, bytes calldata data) {
    if (BADGES.balanceOf(to, GATED_BADGE) == 0) {
      if (data.length == 0) {
        revert UserIsNotOwnerOfBadge(GATED_BADGE);
      }
      proveWithSismo(data);
    }

    bytes memory extraData = BADGES.getBadgeExtraData(to, GATED_BADGE);

    uint256 nullifier = ATTESTER.getNullifierFromExtraData(extraData);

    if (_isNullifierUsed[nullifier]) {
      revert NFTAlreadyMinted();
    }
    // mark the nullifier as used to prevent from bypassing
    // this modifier several times with different destination address
    _markNullifierAsUsed(nullifier);

    _;
  }

  /**
   * @dev Prove the user eligibility with Sismo
   * @param data Bytes containing the user request and the proof associated to it
   */
  function proveWithSismo(bytes memory data) public returns (uint256) {
    (Request memory request, bytes memory proofData) = _buildRequestAndProof(data);

    Attestation[] memory attestations = ATTESTER.generateAttestations(request, proofData);

    (uint256 nullifier, ) = abi.decode(attestations[0].extraData, (uint256, uint16));

    return nullifier;
  }

  /**
   * @dev Build the request and the proof from data
   * @param data Bytes containing the user request and the proof associated to it
   */
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

  /**
   * @dev Mark a nullifier as used
   * @param nullifier Nullifier to mark as used
   */
  function _markNullifierAsUsed(uint256 nullifier) internal {
    _isNullifierUsed[nullifier] = true;
  }
}
