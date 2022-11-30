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
  mapping(uint256 => NullifierData) private _nullifiedAddresses;

  error UserIsNotOwnerOfBadge(uint256 collectionId);
  error NFTAlreadyMintedOnAddress(address owner);

  struct NullifierData {
    address destination;
    bool hasAlreadyBeenUsedInProof;
  }

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
    bool isProofProvided = false;

    if (data.length > 0) {
      isProofProvided = true;
    }

    if (BADGES.balanceOf(to, GATED_BADGE) > 0) {
      // badge already minted on address `to`
      (uint256 previousNullifier, ) = abi.decode(
        BADGES.getBadgeExtraData(to, GATED_BADGE),
        (uint256, uint16)
      );

      if (_nullifiedAddresses[previousNullifier].destination != address(0x0)) {
        revert NFTAlreadyMintedOnAddress(_nullifiedAddresses[previousNullifier].destination);
      }
      // set to address owning the badge for this nullifier to prevent from bypassing this modifier several times with different destination address
      _nullifiedAddresses[previousNullifier].destination = to;
    } else {
      // badge NOT already minted on address `to`

      // if no proof is provided
      if (!isProofProvided) {
        revert UserIsNotOwnerOfBadge(GATED_BADGE);
      }
      proveWithSismo(data);

      (uint256 newNullifier, ) = abi.decode(
        BADGES.getBadgeExtraData(to, GATED_BADGE),
        (uint256, uint16)
      );

      if (
        _nullifiedAddresses[newNullifier].destination != address(0x0) &&
        _nullifiedAddresses[newNullifier].hasAlreadyBeenUsedInProof
      ) {
        revert NFTAlreadyMintedOnAddress(_nullifiedAddresses[newNullifier].destination);
      }
      _nullifiedAddresses[newNullifier].hasAlreadyBeenUsedInProof = true;
    }

    _;
  }

  function proveWithSismo(bytes memory data) public returns (uint256) {
    Claim[] memory claims = new Claim[](1);
    address newDestination;
    bytes memory proofData;
    Request memory request;

    (claims[0], newDestination, proofData) = abi.decode(data, (Claim, address, bytes));

    request.claims = claims;
    request.destination = newDestination;

    Attestation[] memory attestations = ATTESTER.generateAttestations(request, proofData);
    (uint256 nullifier, ) = abi.decode(attestations[0].extraData, (uint256, uint16));

    _nullifiedAddresses[nullifier].destination = newDestination;

    return nullifier;
  }
}
