// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;
import 'hardhat/console.sol';

import {SismoGatedState, Badges, HydraS1AccountboundAttester} from './SismoGatedState.sol';
import {HydraS1Base} from '../../../attesters/hydra-s1/base/HydraS1Base.sol';

import {Request, Claim, Attestation} from '../Structs.sol';

contract SismoGated is SismoGatedState {
  error UnsupportedNetwork();
  error UserIsNotOwnerOfBadge(uint256 collectionId);
  error NFTAlreadyMinted();

  /**
   * @dev Constructor
   * @param _gatedBadge Badge token id that is required to call the function using `onlyBadgesOwner` modifier
   */
  constructor(uint256 _gatedBadge) SismoGatedState(_gatedBadge) {}

  /**
   * @dev Modifier allowing only the owners of the `GATED_BADGE` to trigger the function
   * @param to Address of the badge owner
   * @param data Data containing the user request and the proof associated to it
   * @param hydraS1Attester Attester contract used to verify the proof
   * @notice a proof can also be sent to allow non-holders to prove their eligibility
   */
  modifier onlyBadgesOwner(
    address to,
    bytes calldata data,
    HydraS1Base hydraS1Attester
  ) {
    if (badges.balanceOf(to, gatedBadge) == 0) {
      if (data.length == 0) {
        revert UserIsNotOwnerOfBadge(gatedBadge);
      }
      proveWithSismo(hydraS1Attester, data);
    }

    uint256 nullifier = _getNulliferForAddress(to);

    if (isNullifierUsed(nullifier)) {
      revert NFTAlreadyMinted();
    }
    _;
  }

  /**
   * @dev Prove the user eligibility with Sismo
   * @param hydraS1Attester Attester contract used to verify the proof
   * @param data Bytes containing the user request and the proof associated to it
   */
  function proveWithSismo(
    HydraS1Base hydraS1Attester,
    bytes memory data
  ) public returns (Attestation memory) {
    (Request memory request, bytes memory proofData) = _buildRequestAndProof(data);

    Attestation[] memory attestations = hydraS1Attester.generateAttestations(request, proofData);

    return attestations[0];
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
   * @dev Getter to know a nullifier for a specific address
   * @param to destination address referenced in the proof with this nullifier
   */
  function _getNulliferForAddress(address to) internal view returns (uint256) {
    bytes memory extraData = badges.getBadgeExtraData(to, gatedBadge);
    address badgeIssuerAddress = badges.getBadgeIssuer(to, gatedBadge);
    return HydraS1Base(badgeIssuerAddress).getNullifierFromExtraData(extraData);
  }
}
