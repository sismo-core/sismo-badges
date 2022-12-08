// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;
import 'hardhat/console.sol';

import {Badges} from '../../Badges.sol';
import {Attester} from '../../Attester.sol';
import {HydraS1AccountboundAttester} from '../../../attesters/hydra-s1/HydraS1AccountboundAttester.sol';

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
  address public immutable BADGES_LOCAL_ADDRESS;
  address public immutable HYDRA_S1_ACCOUNTBOUND_LOCAL_ADDRESS;

  Badges public immutable BADGES;
  HydraS1AccountboundAttester public immutable HYDRA_S1_ACCOUNTBOUND_ATTESTER;

  error UnsupportedNetwork();
  error InvalidArgumentsLength();
  error UserIsNotOwnerOfBadge(uint256 badgeTokenId, uint256 balance);
  error AccountAndRequestDestinationDoNotMatch(address account, address requestDestination);
  error AttestationValueIsLowerThanMinBalance(uint256 attestationValue, uint256 minBalance);

  /**
   * @dev Constructor
   */
  constructor(address badgesLocalAddress, address hydraS1AccountboundLocalAddress) {
    BADGES_LOCAL_ADDRESS = badgesLocalAddress;
    HYDRA_S1_ACCOUNTBOUND_LOCAL_ADDRESS = hydraS1AccountboundLocalAddress;

    // select the correct contract addresses based on the network
    (address badgesAddress, address hydraS1AccountboundAttesterAddress) = _getContractAddresses();
    BADGES = Badges(badgesAddress);
    HYDRA_S1_ACCOUNTBOUND_ATTESTER = HydraS1AccountboundAttester(
      hydraS1AccountboundAttesterAddress
    );
  }

  /**
   * @dev Modifier allowing only:
   *      - Owners of the badge with tokenId == badgeTokenId and a badge balance >= minBalance
   *      - Addresses used in a valid proof of elibility that can be provided in `sismoProofData`
   * @param account Address which holds the badge or is eligible for the badge (need to provide the correct proof for this account)
   * @param badgeTokenId Token ID of the badge that the user needs to hold to access the function
   * @param minBalance Minimum balance (= level) of the badge that the user needs to hold to access the function (if no proof is provided)
   * @param attester Attester contract used to verify the proof
   * @param sismoProofData Data containing the user request and the proof of eligibility associated to it
   */
  modifier onlyBadgeOwnerOrValidProof(
    address account,
    uint256 badgeTokenId,
    uint256 minBalance,
    Attester attester,
    bytes memory sismoProofData
  ) {
    uint256[] memory badgeTokenIds = new uint256[](1);
    badgeTokenIds[0] = badgeTokenId;

    uint256[] memory minBalances = new uint256[](1);
    minBalances[0] = minBalance;

    Attester[] memory attesters = new Attester[](1);
    attesters[0] = attester;

    bytes[] memory sismoProofDataArray = new bytes[](1);
    sismoProofDataArray[0] = sismoProofData;

    checkAccountBadgesOrSismoProofs(
      account,
      badgeTokenIds,
      minBalances,
      attesters,
      sismoProofDataArray
    );

    _;
  }

  /**
   * @dev Check if the `account` address holds badges or is used in valid sismo proofs
   * @param account Address which holds badges or is used in valid sismo proofs
   * @param badgeTokenIds Token ID of the badges
   * @param minBalances Minimum balances (= levels) of the badges
   * @param attesters Attester contracts used to verify proofs
   * @param sismoProofDataArray Array of bytes containing the user requests and the proofs of each badge eligibility
   */
  function checkAccountBadgesOrSismoProofs(
    address account,
    uint256[] memory badgeTokenIds,
    uint256[] memory minBalances,
    Attester[] memory attesters,
    bytes[] memory sismoProofDataArray
  ) public {
    _checkArgumentsLength(badgeTokenIds, minBalances, attesters, sismoProofDataArray);

    for (uint32 i = 0; i < badgeTokenIds.length; i++) {
      if (BADGES.balanceOf(account, badgeTokenIds[i]) < minBalances[i]) {
        if (sismoProofDataArray[i].length == 0) {
          revert UserIsNotOwnerOfBadge(badgeTokenIds[i], minBalances[i]);
        }
        Attestation memory attestation = proveWithSismo(
          account,
          attesters[i],
          sismoProofDataArray[i]
        );

        if (attestation.value < minBalances[i]) {
          revert AttestationValueIsLowerThanMinBalance(attestation.value, minBalances[i]);
        }
      }
    }
  }

  /**
   * @dev Prove the eligibility of an address with Sismo
   * @param account Address used in the proof of eligibility
   * @param attester Attester contract used to verify proofs
   * @param sismoProofData Bytes containing a request and the proof associated to it
   */
  function proveWithSismo(
    address account,
    Attester attester,
    bytes memory sismoProofData
  ) public returns (Attestation memory) {
    (Request memory request, bytes memory proofData) = _decodeRequestAndProofFromBytes(
      sismoProofData
    );

    if (account != request.destination) {
      revert AccountAndRequestDestinationDoNotMatch(account, request.destination);
    }

    Attestation[] memory attestations = attester.generateAttestations(request, proofData);

    return attestations[0];
  }

  /**
   * @dev Decode the user request and the proof from bytes
   * @param data Bytes containing the user request and the proof associated to it
   */
  function _decodeRequestAndProofFromBytes(
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
   * @dev Check if the arguments have the same length
   * @param badgeTokenIds Token ID of the badges
   * @param minBalances Minimum balances (= levels) of the badges
   * @param attesters Attester contracts used to verify proofs
   * @param sismoProofDataArray Array of bytes containing the user requests and the proofs of each badge eligibility
   */
  function _checkArgumentsLength(
    uint256[] memory badgeTokenIds,
    uint256[] memory minBalances,
    Attester[] memory attesters,
    bytes[] memory sismoProofDataArray
  ) internal pure {
    if (
      badgeTokenIds.length != minBalances.length ||
      badgeTokenIds.length != attesters.length ||
      badgeTokenIds.length != sismoProofDataArray.length
    ) {
      revert InvalidArgumentsLength();
    }
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
