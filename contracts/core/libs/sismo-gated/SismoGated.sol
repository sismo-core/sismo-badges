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

  /**************************************
   * Storage slot
   * 20 slots
   *
   * -> 20 free slots
   **************************************/

  Badges public immutable BADGES;
  HydraS1AccountboundAttester public immutable HYDRA_S1_ACCOUNTBOUND_ATTESTER;

  uint256[20] private _storagePlaceHolders;

  error UnsupportedNetwork();
  error UserIsNotOwnerOfBadge(uint256 badgeTokenId, uint256 badgeValue);

  /**
   * @dev Constructor
   */
  constructor() {
    // select the correct contract addresses based on the network
    (address badgesAddress, address hydraS1AccountboundAttesterAddress) = _getContractAddresses();
    BADGES = Badges(badgesAddress);
    HYDRA_S1_ACCOUNTBOUND_ATTESTER = HydraS1AccountboundAttester(
      hydraS1AccountboundAttesterAddress
    );
  }

  /**
   * @dev Modifier allowing only the owners of the `GATED_BADGE` to trigger the function
   * @param badgeOwnerAddress Address of the badge owner
   * @param gatedBadgeTokenId Token ID of the badge that the user needs to hold to access the function
   * @param gatedBadgeMinimumValue Minimum value of the badge that the user needs to hold to access the function
   * @param data Data containing the user request and the proof associated to it
   * @param attester Attester contract used to verify the proof
   * @notice a proof can also be sent to allow non-holders to prove their eligibility
   */
  modifier onlyBadgeOwner(
    address badgeOwnerAddress,
    uint256 gatedBadgeTokenId,
    uint256 gatedBadgeMinimumValue,
    Attester attester,
    bytes memory data
  ) {
    uint256[] memory gatedBadgeTokenIds = new uint256[](1);
    gatedBadgeTokenIds[0] = gatedBadgeTokenId;

    uint256[] memory gatedBadgeMinimumValues = new uint256[](1);
    gatedBadgeMinimumValues[0] = gatedBadgeMinimumValue;

    bytes[] memory dataArray = new bytes[](1);
    dataArray[0] = data;

    checkBadgesOwnership(
      badgeOwnerAddress,
      gatedBadgeTokenIds,
      gatedBadgeMinimumValues,
      attester,
      dataArray
    );

    _;
  }

  /**
   * @dev Check if the user is the owner of the badge, a proof can be supplied to allow non-holders to prove they can mint a badge
   * @param account Address of the user
   * @param badgeTokenIds Token ID of the badges
   * @param badgeMinimumValues Minimum value of the badges
   * @param attester Attester contract used to verify proofs
   * @param dataArray Array of bytes containing the user requests and the proofs of each badge eligibility
   */
  function checkBadgesOwnership(
    address account,
    uint256[] memory badgeTokenIds,
    uint256[] memory badgeMinimumValues,
    Attester attester,
    bytes[] memory dataArray
  ) public {
    for (uint32 i = 0; i < badgeTokenIds.length; i++) {
      if (BADGES.balanceOf(account, badgeTokenIds[i]) < badgeMinimumValues[i]) {
        if (dataArray[i].length == 0) {
          revert UserIsNotOwnerOfBadge(badgeTokenIds[i], badgeMinimumValues[i]);
        }
        proveWithSismo(attester, dataArray[i]);
      }
    }
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

  /**
   * @dev Get the contract addresses based on the network
   */
  function _getContractAddresses() internal view returns (address, address) {
    address badgesAddress;
    address hydraS1AccountboundAttesterAddress;

    if (block.chainid == 137) {
      badgesAddress = BADGES_POLYGON_ADDRESS;
      hydraS1AccountboundAttesterAddress = HYDRA_S1_ACCOUNTBOUND_POLYGON_ADDRESS;
    } else if (block.chainid == 5) {
      badgesAddress = BADGES_GOERLI_ADDRESS;
      hydraS1AccountboundAttesterAddress = HYDRA_S1_ACCOUNTBOUND_GOERLI_ADDRESS;
    } else if (block.chainid == 80001) {
      badgesAddress = BADGES_MUMBAI_ADDRESS;
      hydraS1AccountboundAttesterAddress = HYDRA_S1_ACCOUNTBOUND_MUMBAI_ADDRESS;
    } else if (block.chainid == 31337 || block.chainid == 1337) {
      badgesAddress = BADGES_LOCAL_ADDRESS;
      hydraS1AccountboundAttesterAddress = HYDRA_S1_ACCOUNTBOUND_LOCAL_ADDRESS;
    } else {
      revert UnsupportedNetwork();
    }

    return (badgesAddress, hydraS1AccountboundAttesterAddress);
  }
}
