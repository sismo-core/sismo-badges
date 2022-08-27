// SPDX-License-Identifier: MIT

pragma solidity ^0.8.14;
pragma experimental ABIEncoderV2;

import {Pythia1Verifier, Pythia1Lib, Pythia1ProofData} from '../libs/Pythia1Lib.sol';
import {ICommitmentMapperRegistry} from '../../../periphery/utils/CommitmentMapperRegistry.sol';
import {IAvailableRootsRegistry} from '../../../periphery/utils/AvailableRootsRegistry.sol';

interface IPythia1Base {
  error ClaimsLengthDifferentThanOne(uint256 claimLength);
  error DestinationMismatch(address expectedDestination, address inputDestination);
  error CommitmentSignerPubKeyMismatch(
    uint256 expectedX,
    uint256 expectedY,
    uint256 inputX,
    uint256 inputY
  );
  error TicketIdentifierMismatch(uint256 expectedTicketIdentifier, uint256 ticketIdentifier);
  error IsStrictMismatch(bool expectedStrictness, bool strictNess);
  error ChainIdMismatch(uint256 expectedChainId, uint256 chainId);
  error ValueMismatch(uint256 expectedValue, uint256 inputValue);
  error GroupIdMismatch(uint256 expectedAccountsTreeValue, uint256 inputAccountsTreeValue);
  error InvalidPlonkProof(string reason);

  /**
   * @dev Getter of Hydra-S1 Verifier contract
   */
  function getVerifier() external view returns (Pythia1Verifier);

  /**
   * @dev Getter of Commitment Mapper Registry contract
   */
  function getCommitmentSignerPubKey() external view returns (uint256[2] memory);
}
