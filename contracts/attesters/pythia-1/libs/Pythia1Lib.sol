// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Claim, Request} from '../../../core/libs/Structs.sol';
import {Pythia1Verifier} from '@sismo-core/pythia-1/contracts/Pythia1Verifier.sol';

// user Pythia-1 claim retrieved form his request
struct Pythia1Claim {
  uint256 groupId; // user claims be part of this group
  uint256 claimedValue; // user claims this value for its account in the group
  address destination; // user claims to own this destination[]
  Pythia1GroupProperties groupProperties; // user claims the group has the following properties
}

struct Pythia1GroupProperties {
  uint128 internalCollectionId;
  bool isScore;
}

struct Pythia1CircomSnarkProof {
  uint256[2] a;
  uint256[2][2] b;
  uint256[2] c;
}

struct Pythia1ProofData {
  Pythia1CircomSnarkProof proof;
  uint256[9] input;
  // destination;
  // chainId;
  // commitmentSignerPubKey.x;
  // commitmentSignerPubKey.y;
  // groupId;
  // ticketIdentifier;
  // userTicket;
  // value;
  // isStrict;
}

struct Pythia1ProofInput {
  address destination;
  uint256 chainId;
  uint256 groupId;
  uint256 ticketIdentifier;
  uint256 ticket;
  uint256 value;
  bool isStrict;
  uint256[2] commitmentSignerPubKey;
}

library Pythia1Lib {
  uint256 constant SNARK_FIELD =
    21888242871839275222246405745257275088548364400416034343698204186575808495617;

  error GroupIdAndPropertiesMismatch(uint256 expectedGroupId, uint256 groupId);

  function _input(Pythia1ProofData memory self) internal pure returns (Pythia1ProofInput memory) {
    return
      Pythia1ProofInput(
        _getDestination(self),
        _getChainId(self),
        _getGroupId(self),
        _getExpectedExternalNullifier(self),
        _getTicket(self),
        _getValue(self),
        _getIsStrict(self),
        _getCommitmentMapperPubKey(self)
      );
  }

  function _claim(Request memory self) internal pure returns (Pythia1Claim memory) {
    Claim memory claim = self.claims[0];
    _validateClaim(claim);
    Pythia1GroupProperties memory groupProperties = abi.decode(
      claim.extraData,
      (Pythia1GroupProperties)
    );
    return (Pythia1Claim(claim.groupId, claim.claimedValue, self.destination, groupProperties));
  }

  function _toCircomFormat(
    Pythia1ProofData memory self
  )
    internal
    pure
    returns (uint256[2] memory, uint256[2][2] memory, uint256[2] memory, uint256[9] memory)
  {
    return (self.proof.a, self.proof.b, self.proof.c, self.input);
  }

  function _getDestination(Pythia1ProofData memory self) internal pure returns (address) {
    return address(uint160(self.input[0]));
  }

  function _getChainId(Pythia1ProofData memory self) internal pure returns (uint256) {
    return self.input[1];
  }

  function _getCommitmentMapperPubKey(
    Pythia1ProofData memory self
  ) internal pure returns (uint256[2] memory) {
    return [self.input[2], self.input[3]];
  }

  function _getGroupId(Pythia1ProofData memory self) internal pure returns (uint256) {
    return self.input[4];
  }

  function _getExpectedExternalNullifier(
    Pythia1ProofData memory self
  ) internal pure returns (uint256) {
    return self.input[5];
  }

  function _getTicket(Pythia1ProofData memory self) internal pure returns (uint256) {
    return self.input[6];
  }

  function _getValue(Pythia1ProofData memory self) internal pure returns (uint256) {
    return self.input[7];
  }

  function _getIsStrict(Pythia1ProofData memory self) internal pure returns (bool) {
    return self.input[8] == 1;
  }

  function _getTicket(bytes calldata self) internal pure returns (uint256) {
    Pythia1ProofData memory snarkProofData = abi.decode(self, (Pythia1ProofData));
    uint256 userTicket = uint256(_getTicket(snarkProofData));
    return userTicket;
  }

  function _generateGroupIdFromProperties(
    uint128 internalCollectionId,
    bool isScore
  ) internal pure returns (uint256) {
    return
      _generateGroupIdFromEncodedProperties(_encodeGroupProperties(internalCollectionId, isScore));
  }

  function _generateGroupIdFromEncodedProperties(
    bytes memory encodedProperties
  ) internal pure returns (uint256) {
    return uint256(keccak256(encodedProperties)) % Pythia1Lib.SNARK_FIELD;
  }

  function _encodeGroupProperties(
    uint128 internalCollectionId,
    bool isScore
  ) internal pure returns (bytes memory) {
    return abi.encode(internalCollectionId, isScore);
  }

  function _validateClaim(Claim memory claim) internal pure {
    uint256 expectedGroupId = _generateGroupIdFromEncodedProperties(claim.extraData);
    if (claim.groupId != expectedGroupId)
      revert GroupIdAndPropertiesMismatch(expectedGroupId, claim.groupId);
  }
}
