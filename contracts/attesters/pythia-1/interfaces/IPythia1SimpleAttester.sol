// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;
pragma experimental ABIEncoderV2;

import {Attestation} from '../../../core/libs/Structs.sol';
import {IAttester} from '../../../core/interfaces/IAttester.sol';
import {Pythia1Lib, Pythia1ProofData, Pythia1ProofInput} from './../libs/Pythia1Lib.sol';
import {IPythia1Base} from './../base/IPythia1Base.sol';

interface IPythia1SimpleAttester is IPythia1Base, IAttester {
  error TicketUsed(uint256 userTicket);
  error CollectionIdOutOfBound(uint256 collectionId);

  event TicketDestinationUpdated(uint256 ticket, address newOwner);
  event CommitmentSignerPubKeyUpdated(uint256[2] newCommitmentSignerPubKey);

  /**
   * @dev Initializes the contract, to be called by the proxy delegating calls to this implementation
   * @param commitmentSignerPubKey EdDSA public key of the commitment signer
   * @param owner Owner of the contract, can update public key and address
   * @notice The reinitializer modifier is needed to configure modules that are added through upgrades and that require initialization.
   */
  function initialize(uint256[2] memory commitmentSignerPubKey, address owner) external;

  /**
   * @dev Getter, returns the last attestation destination of a ticket
   * @param userTicket ticket used
   **/
  function getDestinationOfTicket(uint256 userTicket) external view returns (address);

  /**
   * @dev Getter
   * returns of the first collection in which the attester is supposed to record
   **/
  function AUTHORIZED_COLLECTION_ID_FIRST() external view returns (uint256);

  /**
   * @dev Getter
   * returns of the last collection in which the attester is supposed to record
   **/
  function AUTHORIZED_COLLECTION_ID_LAST() external view returns (uint256);
}
