// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;
import 'hardhat/console.sol';

import {Badges} from '../../Badges.sol';
import {Attester} from '../../Attester.sol';
import {HydraS1AccountboundAttester} from '../../../attesters/hydra-s1/HydraS1AccountboundAttester.sol';
import {HydraS1Base} from '../../../attesters/hydra-s1/base/HydraS1Base.sol';

import {Request, Claim, Attestation} from '../Structs.sol';

contract SismoGated {
  // polygon contract address
  address public constant BADGES_POLYGON_ADDRESS = 0xF12494e3545D49616D9dFb78E5907E9078618a34;
  address public constant HYDRA_S1_ACCOUNTBOUND_POLYGON_ADDRESS =
    0x10b27d9efa4A1B65412188b6f4F29e64Cf5e0146;

  // goerli contract address
  address public constant BADGES_GOERLI_ADDRESS = 0xE06B14D5835925e1642d7216F4563a1273509F10;
  address public constant HYDRA_S1_ACCOUNTBOUND_GOERLI_ADDRESS =
    0x89d80C9E65fd1aC8970B78A4F17E2e772030C1cB;

  // mumbai contract address
  address public constant BADGES_MUMBAI_ADDRESS = 0x5722fEa81027533721BA161964622271560da1aC;
  address public constant HYDRA_S1_ACCOUNTBOUND_MUMBAI_ADDRESS =
    0x069e6B99f4DA543156f66274FC6673442803C587;

  // local contract address
  address public constant BADGES_LOCAL_ADDRESS = 0xeF5b2Be9a6075a61bCA4384abc375485d5e196c3;
  address public constant HYDRA_S1_ACCOUNTBOUND_LOCAL_ADDRESS =
    0xf93A0C43A3466488D416628bf149495285e9f274;

  uint8 public constant MAX_NUMBER_OF_BADGES = 10;

  /**************************************
   * Storage slot
   * 20 slots
   * -> 2 slots used
   * -> 1 used by badges, 1 used by hydraS1AccountboundAttester
   *
   * -> 18 free slots
   **************************************/

  Badges public badges;
  HydraS1AccountboundAttester public hydraS1AccountboundAttester;

  uint256[18] private _storagePlaceHolders;

  error UnsupportedNetwork();
  error UserIsNotOwnerOfBadge(uint256 badgeTokenId);

  /**
   * @dev Constructor
   */
  constructor() {
    // select the correct contract addresses based on the network
    if (block.chainid == 137) {
      badges = Badges(BADGES_POLYGON_ADDRESS);
      hydraS1AccountboundAttester = HydraS1AccountboundAttester(
        HYDRA_S1_ACCOUNTBOUND_POLYGON_ADDRESS
      );
    } else if (block.chainid == 5) {
      badges = Badges(BADGES_GOERLI_ADDRESS);
      hydraS1AccountboundAttester = HydraS1AccountboundAttester(
        HYDRA_S1_ACCOUNTBOUND_GOERLI_ADDRESS
      );
    } else if (block.chainid == 80001) {
      badges = Badges(BADGES_MUMBAI_ADDRESS);
      hydraS1AccountboundAttester = HydraS1AccountboundAttester(
        HYDRA_S1_ACCOUNTBOUND_MUMBAI_ADDRESS
      );
    } else if (block.chainid == 31337 || block.chainid == 1337) {
      badges = Badges(BADGES_LOCAL_ADDRESS);
      hydraS1AccountboundAttester = HydraS1AccountboundAttester(
        HYDRA_S1_ACCOUNTBOUND_LOCAL_ADDRESS
      );
    } else {
      revert UnsupportedNetwork();
    }
  }

  /**
   * @dev Modifier allowing only the owners of the `GATED_BADGE` to trigger the function
   * @param badgeOwnerAddress Address of the badge owner
   * @param gatedBadgeTokenId Token ID of the badge that the user needs to hold to access the function
   * @param data Data containing the user request and the proof associated to it
   * @param attester Attester contract used to verify the proof
   * @notice a proof can also be sent to allow non-holders to prove their eligibility
   */
  modifier onlyBadgesOwner(
    address badgeOwnerAddress,
    uint256 gatedBadgeTokenId,
    Attester attester,
    bytes memory data
  ) {
    if (badges.balanceOf(badgeOwnerAddress, gatedBadgeTokenId) == 0) {
      if (data.length == 0) {
        revert UserIsNotOwnerOfBadge(gatedBadgeTokenId);
      }
      proveWithSismo(attester, data);
    }

    _;
  }

  /**
   * @dev Prove the user eligibility with Sismo
   * @param attester Attester contract used to verify proofs
   * @param data Bytes containing the user request and the proof associated to it
   */
  function proveWithSismo(
    Attester attester,
    bytes memory data
  ) public returns (Attestation memory) {
    (Request memory request, bytes memory proofData) = _buildRequestAndProof(data);
    Attestation[] memory attestations = attester.generateAttestations(request, proofData);

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
}
