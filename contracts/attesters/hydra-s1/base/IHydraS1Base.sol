// SPDX-License-Identifier: MIT

pragma solidity ^0.8.14;
pragma experimental ABIEncoderV2;

import {HydraS1Verifier, HydraS1Lib, HydraS1ProofData} from '../libs/HydraS1Lib.sol';
import {ICommitmentMapperRegistry} from '../../../periphery/utils/CommitmentMapperRegistry.sol';
import {IAvailableRootsRegistry} from '../../../periphery/utils/AvailableRootsRegistry.sol';

// todo: explain well what is specific to this attester
interface IHydraS1Base {
  error ClaimsLengthDifferentThanOne(uint256 claimLength);
  error RegistryRootMismatch(uint256 inputRoot);
  error DestinationMismatch(address expectedDestination, address inputDestination);
  error CommitmentMapperPubKeyMismatch(
    uint256 expectedX,
    uint256 expectedY,
    uint256 inputX,
    uint256 inputY
  );
  error TicketIdentifierMismatch(uint256 expectedTicketIdentifier, uint256 ticketIdentifier);
  error IsStrictMismatch(bool expectedStrictness, bool strictNess);
  error ChainIdMismatch(uint256 expectedChainId, uint256 chainId);
  error ValueMismatch(uint256 expectedValue, uint256 inputValue);
  error AccountsTreeValueMismatch(
    uint256 expectedAccountsTreeValue,
    uint256 inputAccountsTreeValue
  );
  error InvalidGroth16Proof(string reason);

  /**
   * @dev Getter of Hydra-S1 Verifier contract
   */
  function getVerifier() external view returns (HydraS1Verifier);

  /**
   * @dev Getter of Commitment Mapper Registry contract
   */
  function getCommitmentMapperRegistry() external view returns (ICommitmentMapperRegistry);

  /**
   * @dev Getter of Roots Registry Contract
   */
  function getAvailableRootsRegistry() external view returns (IAvailableRootsRegistry);
}
