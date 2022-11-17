// SPDX-License-Identifier: MIT

pragma solidity ^0.8.14;
pragma experimental ABIEncoderV2;

import {IHydraS1Airdrop721AccountboundAttester} from '../interfaces/IHydraS1Airdrop721AccountboundAttester.sol';
import {Airdrop721} from '../airdrop/Airdrop721.sol';
import {HydraS1AccountboundAttesterv2} from '../variants/HydraS1AccountboundAttesterv2.sol';
import {AirdropERC721} from '../airdrop/AirdropERC721.sol';

// Core protocol Protocol imports
import {Request, Attestation, Claim} from '../../../core/libs/Structs.sol';
import {Attester, IAttester, IAttestationsRegistry} from '../../../core/Attester.sol';

// Imports related to HydraS1 Proving Scheme
import {HydraS1Base, HydraS1Lib, HydraS1ProofData, HydraS1ProofInput, HydraS1Claim} from '../base/HydraS1Base.sol';
import {HydraS1AccountboundLib, HydraS1AccountboundClaim} from '../libs/HydraS1AccountboundLib.sol';

/**
 * @title  Hydra-S1 Airdrop721 Accountbound Attester
 * @author Sismo
 * @notice This attester is part of the family of the Hydra-S1 Attesters.
 **/
contract HydraS1Airdrop721AccountboundAttester is
  IHydraS1Airdrop721AccountboundAttester,
  Airdrop721,
  HydraS1AccountboundAttesterv2
{
  using HydraS1Lib for HydraS1ProofData;
  using HydraS1Lib for bytes;
  using HydraS1Lib for Request;

  /*******************************************************
    INITIALIZATION FUNCTIONS                           
  *******************************************************/
  /**
   * @dev Constructor. Initializes the contract
   * @param attestationsRegistryAddress Attestations Registry contract on which the attester will write attestations
   * @param hydraS1VerifierAddress ZK Snark Hydra-S1 Verifier contract
   * @param availableRootsRegistryAddress Registry storing the available groups for this attester (e.g roots of registry merkle trees)
   * @param commitmentMapperAddress commitment mapper's public key registry
   * @param collectionIdFirst Id of the first collection in which the attester is supposed to record
   * @param collectionIdLast Id of the last collection in which the attester is supposed to record
   */
  constructor(
    address attestationsRegistryAddress,
    address hydraS1VerifierAddress,
    address availableRootsRegistryAddress,
    address commitmentMapperAddress,
    uint256 collectionIdFirst,
    uint256 collectionIdLast,
    uint32 defaultCooldownDuration
  )
    HydraS1AccountboundAttesterv2(
      attestationsRegistryAddress,
      hydraS1VerifierAddress,
      availableRootsRegistryAddress,
      commitmentMapperAddress,
      collectionIdFirst,
      collectionIdLast,
      defaultCooldownDuration
    )
  {}

  /*******************************************************
    OPTIONAL HOOK VIRTUAL FUNCTIONS FROM ATTESTER.SOL
  *******************************************************/
  /**
   * @dev Hook run before recording the attestation.
   * Throws if ticket already used, not a renewal, ticket on cooldown and if airdrop contract is not registered.
   * @param request users request. Claim of having an account part of a group of accounts
   * @param proofData provided to back the request. snark input and snark proof
   */
  function _beforeRecordAttestations(Request calldata request, bytes calldata proofData)
    internal
    virtual
    override(HydraS1AccountboundAttesterv2)
  {
    HydraS1Claim memory claim = request._claim();
    uint256 userTicket = proofData._getTicket();
    uint16 oldBurnCount = _getTicketBurnCount(userTicket);
    super._beforeRecordAttestations(request, proofData);
    uint16 newBurnCount = _getTicketBurnCount(userTicket);

    if (oldBurnCount != newBurnCount) {
      _burnERC721ForGroupId(claim.groupId, _getDestinationOfTicket(userTicket));
    }

    // mint a new ERC721
    _safeMintERC721ForGroupId(claim.groupId, claim.destination);
  }
}
