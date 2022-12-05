// SPDX-License-Identifier: MIT

pragma solidity ^0.8.14;
pragma experimental ABIEncoderV2;

import {IAttester} from '../../../core/interfaces/IAttester.sol';
import {HydraS1Verifier, HydraS1Lib, HydraS1ProofData} from '../libs/HydraS1Lib.sol';
import {ICommitmentMapperRegistry} from '../../../periphery/utils/CommitmentMapperRegistry.sol';
import {IAvailableRootsRegistry} from '../../../periphery/utils/AvailableRootsRegistry.sol';

/**
 * @title Hydra-S1 Base Interface
 * @author Sismo
 * @notice Interface that facilitates the use of the Hydra-S1 ZK Proving Scheme.
 * Hydra-S1 is single source, single group: it allows users to verify they are part of one and only one group at a time
 * It is inherited by the family of Hydra-S1 attesters.
 * It contains the errors and method specific of the Hydra-S1 attesters family and the Hydra-S1 ZK Proving Scheme
 * We invite readers to refer to the following:
 *    - https://hydra-s1.docs.sismo.io for a full guide through the Hydra-S1 ZK Attestations
 *    - https://hydra-s1-circuits.docs.sismo.io for circuits, prover and verifiers of Hydra-S1
 **/
interface IHydraS1Base is IAttester {
  error ClaimsLengthDifferentThanOne(uint256 claimLength);
  error RegistryRootMismatch(uint256 inputRoot);
  error DestinationMismatch(address expectedDestination, address inputDestination);
  error CommitmentMapperPubKeyMismatch(
    uint256 expectedX,
    uint256 expectedY,
    uint256 inputX,
    uint256 inputY
  );
  error ExternalNullifierMismatch(uint256 expectedExternalNullifier, uint256 externalNullifier);
  error IsStrictMismatch(bool expectedStrictness, bool strictNess);
  error ChainIdMismatch(uint256 expectedChainId, uint256 chainId);
  error ValueMismatch(uint256 expectedValue, uint256 inputValue);
  error AccountsTreeValueMismatch(
    uint256 expectedAccountsTreeValue,
    uint256 inputAccountsTreeValue
  );
  error InvalidGroth16Proof(string reason);

  function getNullifierFromExtraData(bytes memory extraData) external view returns (uint256);

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
