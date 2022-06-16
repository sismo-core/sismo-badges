// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

/**
 * @title  Attestations Registry State
 * @author Sismo
 * @notice This contract holds all of the storage variables and data
 *         structures used by the AttestationsRegistry and parent
 *         contracts.
 */

// User Attestation Request, can be made by any user
// The context of an Attestation Request is a specific attester contract
// Each attester has groups of accounts in its available data
// eg: for a specific attester:
//     group 1 <=> accounts that sent txs on mainnet
//     group 2 <=> accounts that sent txs on polygon
// eg: for another attester:
//     group 1 <=> accounts that sent eth txs in 2022
//     group 2 <=> accounts sent eth txs in 2021
struct Request {
  // implicit address attester;
  // implicit uint256 chainId;
  Claim[] claims;
  address destination; // destination that will receive the end attestation
}

struct Claim {
  uint256 groupId; // user claims to have an account in this group
  uint256 claimedValue; // user claims this value for its account in the group
  bytes extraData; // arbitrary data, may be required by the attester to verify claims or generate a specific attestation
}

/**
 * @dev Attestation Struct. This is the struct receive as argument by the Attestation Registry.
 * @param collectionId Attestation collection
 * @param owner Attestation collection
 * @param issuer Attestation collection
 * @param value Attestation collection
 * @param timestamp Attestation collection
 * @param extraData Attestation collection
 */
struct Attestation {
  // implicit uint256 chainId;
  uint256 collectionId; // Id of the attestation collection (in the registry)
  address owner; // Owner of the attestation
  address issuer; // Contract that created or last updated the record.
  uint256 value; // Value of the attestation
  uint32 timestamp; // Timestamp chosen by the attester, should correspond to the effective date of the attestation
  // it is different from the recording timestamp (date when the attestation was recorded)
  // e.g a proof of NFT ownership may have be recorded today which is 2 month old data.
  bytes extraData; // arbitrary data that can be added by the attester
}

// Attestation Data, stored in the registry
// The context is a specific owner of a specific collection
struct AttestationData {
  // implicit uint256 chainId
  // implicit uint256 collectionId - from context
  // implicit owner
  address issuer; // Address of the contract that recorded the attestation
  uint256 value; // Value of the attestation
  uint32 timestamp; // Effective date of issuance of the attestation. (can be different from the recording timestamp)
  bytes extraData; // arbitrary data that can be added by the attester
}
