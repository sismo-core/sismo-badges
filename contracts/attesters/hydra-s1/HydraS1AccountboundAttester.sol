// SPDX-License-Identifier: MIT

pragma solidity ^0.8.14;
pragma experimental ABIEncoderV2;
import 'hardhat/console.sol';

import {IHydraS1AccountboundAttester} from './interfaces/IHydraS1AccountboundAttester.sol';
import {HydraS1SimpleAttester} from './HydraS1SimpleAttester.sol';
import {Ownable} from '@openzeppelin/contracts/access/Ownable.sol';
import {IHydraS1Base} from './base/IHydraS1Base.sol';

// Core protocol Protocol imports
import {Request, Attestation, Claim} from '../../core/libs/Structs.sol';
import {IAttester} from '../../core/Attester.sol';

// Imports related to HydraS1 Proving Scheme
import {HydraS1Base, HydraS1Lib, HydraS1ProofData, HydraS1ProofInput, HydraS1Claim} from './base/HydraS1Base.sol';

/**
 * @title  Hydra-S1 Accountbound Attester
 * @author Sismo
 * @notice This attester is part of the family of the Hydra-S1 Attesters.
 * Hydra-S1 attesters enable users to prove they have an account in a group in a privacy preserving way.
 * The Hydra-S1 Simple Attester contract is inherited and holds the complex Hydra S1 verification logic.
 * Request verification alongside proof verification is already implemented in the inherited HydraS1SimpleAttester, along with the buildAttestations logic.
 * However, we override the buildAttestations function to encode the nullifier and its burn count in the user attestation.
 * The _beforeRecordAttestations is also overriden to fit the Accountbound logic.
 * We invite readers to refer to:
 *    - https://hydra-s1.docs.sismo.io for a full guide through the Hydra-S1 ZK Attestations
 *    - https://hydra-s1-circuits.docs.sismo.io for circuits, prover and verifiers of Hydra-S1

 * This specific attester has the following characteristics:

 * - Zero Knowledge
 *   One cannot deduct from an attestation what source account was used to generate the underlying proof

 * - Non Strict (scores)
 *   If a user can generate an attestation of max value 100, they can also generate any attestation with value < 100.
 *   This attester generate attestations of scores

 * - Nullified
 *   Each source account gets one nullifier per claim (i.e only one attestation per source account per claim)
 *   While semaphore/ tornado cash are using the following notations: nullifierHash = hash(IdNullifier, externalNullifier)
 *   We prefered to use the naming 'nullifier' instead of 'nullifierHash' in our contracts and documentation.
 *   We also renamed 'IdNullifier' in 'sourceSecret' (the secret tied to a source account) and we kept the 'externalNullifier' notation.
 *   Finally, here is our notations at Sismo: nullifier = hash(sourceSecret, externalNullifier)

 * - Accountbound (opt-in, with cooldown period)
 *   The owner of this attester can set a cooldown duration for a specific group, activating the accountbound feature for this group.
 *   Users can update their attestation's destination by providing a new Hydra-S1 ZK proof 
 *   It means the attestation is bound to the source account, stored on an updatable destination account.
 *   When deleting/ sending to a new destination, the nullifier will enter a cooldown period, so it remains occasional.
 *   A group that has its cooldown duration set to 0 means it has been configured to not feature accountbound attestations, attestations can not be transferred
 *   One can however know that the former and the new destinations were created using the same nullifier, thus creating a link between those two destinations.
 
 * - Renewable
 *   A nullifier can actually be reused as long as the destination of the attestation remains the same
 *   It enables users to renew or update their attestations
 **/

contract HydraS1AccountboundAttester is
  IHydraS1AccountboundAttester,
  HydraS1SimpleAttester,
  Ownable
{
  using HydraS1Lib for HydraS1ProofData;
  using HydraS1Lib for bytes;
  using HydraS1Lib for Request;

  // implementation version
  uint8 public constant VERSION = 4;

  /*******************************************************
    Storage layout:
    20 slots between HydraS1SimpleAttester and HydraS1AccountboundAttester
      1 currently used by Ownable
      19 place holders
    2O for config
      1 currently used
      18 place holders
    20 for logic
      2 currently used
      18 place holders
  *******************************************************/

  // keeping some space for future config logics
  uint256[19] private _placeHolderBeforeHydraS1Accountbound;

  // cooldown durations for each groupIndex
  mapping(uint256 => uint32) internal _cooldownDurations;

  // keeping some space for future config logics
  uint256[19] private _placeHoldersHydraS1AccountboundConfig;

  mapping(uint256 => uint32) internal _nullifiersCooldownStart;
  mapping(uint256 => uint16) internal _nullifiersBurnCount;

  // keeping some space for future config logics
  uint256[18] private _placeHoldersHydraS1AccountboundLogic;

  /*******************************************************
    INITIALIZATION FUNCTIONS                           
  *******************************************************/
  /**
   * @dev Constructor. Initializes the contract
   * @param attestationsRegistryAddress Attestations Registry contract on which the attester will write attestations
   * @param hydraS1VerifierAddress ZK Snark Hydra-S1 Verifier contract
   * @param availableRootsRegistryAddress Registry storing the available groups for this attester (e.g roots of registry merkle trees)
   * @param commitmentMapperAddress commitment mapper's public key registry
   * @param collectionIdFirst Id of the first attestation collection in which the attester is supposed to record
   * @param collectionIdLast Id of the last attestation collection in which the attester is supposed to record
   */
  constructor(
    address attestationsRegistryAddress,
    address hydraS1VerifierAddress,
    address availableRootsRegistryAddress,
    address commitmentMapperAddress,
    uint256 collectionIdFirst,
    uint256 collectionIdLast,
    address owner
  )
    HydraS1SimpleAttester(
      attestationsRegistryAddress,
      hydraS1VerifierAddress,
      availableRootsRegistryAddress,
      commitmentMapperAddress,
      collectionIdFirst,
      collectionIdLast
    )
  {
    initialize(owner);
  }

  /**
   * @dev Initialize function, to be called by the proxy delegating calls to this implementation
   * @param owner Owner of the contract, has the right to authorize/unauthorize attestations issuers
   * @notice The reinitializer modifier is needed to configure modules that are added through upgrades and that require initialization.
   */
  function initialize(address owner) public reinitializer(VERSION) {
    _transferOwnership(owner);
  }

  /*******************************************************
    MANDATORY FUNCTIONS TO OVERRIDE FROM ATTESTER.SOL
  *******************************************************/

  /**
   * @dev Returns the actual attestations constructed from the user request
   * @param request users request. Claim of having an account part of a group of accounts
   * @param proofData snark public input as well as snark proof
   */
  function buildAttestations(
    Request calldata request,
    bytes calldata proofData
  ) public view virtual override(IAttester, HydraS1SimpleAttester) returns (Attestation[] memory) {
    Attestation[] memory attestations = super.buildAttestations(request, proofData);

    uint256 nullifier = proofData._getNullifier();
    attestations[0].extraData = abi.encodePacked(
      attestations[0].extraData,
      generateAccountboundExtraData(nullifier, attestations[0].owner)
    );

    return (attestations);
  }

  /*******************************************************
    OPTIONAL HOOK VIRTUAL FUNCTIONS FROM ATTESTER.SOL
  *******************************************************/
  /**
   * @dev Hook run before recording the attestation.
   * Throws if nullifier already used, not a renewal, and nullifier on cooldown.
   * @param request users request. Claim of having an account part of a group of accounts
   * @param proofData provided to back the request. snark input and snark proof
   */
  function _beforeRecordAttestations(
    Request calldata request,
    bytes calldata proofData
  ) internal virtual override {
    uint256 nullifier = proofData._getNullifier();
    address previousNullifierDestination = _getDestinationOfNullifier(nullifier);

    HydraS1Claim memory claim = request._claim();

    // check if the nullifier has already been used previously, if so it may be on cooldown
    if (
      previousNullifierDestination != address(0) &&
      previousNullifierDestination != claim.destination
    ) {
      uint32 cooldownDuration = _getCooldownDurationForGroupIndex(claim.groupProperties.groupIndex);
      if (cooldownDuration == 0) {
        revert CooldownDurationNotSetForGroupIndex(claim.groupProperties.groupIndex);
      }
      if (_isOnCooldown(nullifier, cooldownDuration)) {
        uint16 burnCount = _getNullifierBurnCount(nullifier);
        revert NullifierOnCooldown(
          nullifier,
          previousNullifierDestination,
          burnCount,
          cooldownDuration
        );
      }

      // Delete the old Attestation linked to the nullifier before recording the new one (accountbound behaviour)
      _deletePreviousAttestation(claim, previousNullifierDestination);

      _setNullifierOnCooldownAndIncrementBurnCount(nullifier);
    }
    _setDestinationForNullifier(nullifier, request.destination);
  }

  /*******************************************************
    LOGIC FUNCTIONS RELATED TO ACCOUNTBOUND BEHAVIOUR
  *******************************************************/

  /**
   * @dev ABI-encodes nullifier and the burn count of the nullifier
   * @param nullifier user nullifier
   * @param claimDestination destination referenced in the user claim
   */
  function generateAccountboundExtraData(
    uint256 nullifier,
    address claimDestination
  ) public view virtual returns (bytes memory) {
    address previousNullifierDestination = _getDestinationOfNullifier(nullifier);
    uint16 burnCount = _getNullifierBurnCount(nullifier);
    // If the attestation is minted on a new destination address
    // the burnCount that will be encoded in the extraData of the Attestation should be incremented
    if (
      previousNullifierDestination != address(0) && previousNullifierDestination != claimDestination
    ) {
      burnCount += 1;
    }
    return (abi.encode(nullifier, burnCount));
  }

  function getNullifierCooldownStart(uint256 nullifier) external view returns (uint32) {
    return _getNullifierCooldownStart(nullifier);
  }

  /**
   * @dev returns the nullifier for a given extraData
   * @param extraData bytes where the nullifier is encoded
   */
  function getNullifierFromExtraData(
    bytes memory extraData
  ) external pure override(HydraS1SimpleAttester, IHydraS1AccountboundAttester) returns (uint256) {
    (uint256 nullifier, ) = abi.decode(extraData, (uint256, uint16));

    return nullifier;
  }

  /**
   * @dev Returns the burn count for a given extraData
   * @param extraData bytes where the burnCount is encoded
   */
  function getBurnCountFromExtraData(bytes memory extraData) external pure returns (uint16) {
    (, uint16 burnCount) = abi.decode(extraData, (uint256, uint16));

    return burnCount;
  }

  /**
   * @dev Checks if a nullifier is on cooldown
   * @param nullifier user nullifier
   * @param cooldownDuration waiting time before the user can change its badge destination
   */
  function _isOnCooldown(uint256 nullifier, uint32 cooldownDuration) internal view returns (bool) {
    return _getNullifierCooldownStart(nullifier) + cooldownDuration > block.timestamp;
  }

  function getNullifierBurnCount(uint256 nullifier) external view returns (uint16) {
    return _getNullifierBurnCount(nullifier);
  }

  /**
   * @dev Delete the previous attestation created with this nullifier
   * @param claim user claim
   * @param previousNullifierDestination previous destination chosen for this user nullifier
   */
  function _deletePreviousAttestation(
    HydraS1Claim memory claim,
    address previousNullifierDestination
  ) internal {
    address[] memory attestationOwners = new address[](1);
    uint256[] memory attestationCollectionIds = new uint256[](1);

    attestationOwners[0] = previousNullifierDestination;
    attestationCollectionIds[0] = AUTHORIZED_COLLECTION_ID_FIRST + claim.groupProperties.groupIndex;

    ATTESTATIONS_REGISTRY.deleteAttestations(attestationOwners, attestationCollectionIds);
  }

  function _setNullifierOnCooldownAndIncrementBurnCount(uint256 nullifier) internal {
    _nullifiersCooldownStart[nullifier] = uint32(block.timestamp);
    _nullifiersBurnCount[nullifier] += 1;
    emit NullifierSetOnCooldown(nullifier, _nullifiersBurnCount[nullifier]);
  }

  function _getNullifierCooldownStart(uint256 nullifier) internal view returns (uint32) {
    return _nullifiersCooldownStart[nullifier];
  }

  function _getNullifierBurnCount(uint256 nullifier) internal view returns (uint16) {
    return _nullifiersBurnCount[nullifier];
  }

  /*******************************************************
    GROUP CONFIGURATION LOGIC
  *******************************************************/

  function setCooldownDurationForGroupIndex(
    uint256 groupIndex,
    uint32 cooldownDuration
  ) external onlyOwner {
    _cooldownDurations[groupIndex] = cooldownDuration;
    emit CooldownDurationSetForGroupIndex(groupIndex, cooldownDuration);
  }

  function getCooldownDurationForGroupIndex(uint256 groupIndex) external view returns (uint32) {
    return _getCooldownDurationForGroupIndex(groupIndex);
  }

  function _getCooldownDurationForGroupIndex(uint256 groupIndex) internal view returns (uint32) {
    // if cooldownDuration == 0, the accountbound behaviour is prohibited
    return _cooldownDurations[groupIndex];
  }
}
