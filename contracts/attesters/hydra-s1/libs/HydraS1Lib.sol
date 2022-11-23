// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Claim, Request} from '../../../core/libs/Structs.sol';
import {HydraS1Verifier} from '@sismo-core/hydra-s1/contracts/HydraS1Verifier.sol';

// user Hydra-S1 claim retrieved form his request
struct HydraS1Claim {
  uint256 groupId; // user claims to have an account in this group
  uint256 claimedValue; // user claims this value for its account in the group
  address destination; // user claims to own this destination[]
  HydraS1GroupProperties groupProperties; // user claims the group has the following properties
}

struct HydraS1GroupProperties {
  uint128 groupIndex;
  uint32 generationTimestamp;
  bool isScore;
}

struct HydraS1CircomSnarkProof {
  uint256[2] a;
  uint256[2][2] b;
  uint256[2] c;
}

struct HydraS1ProofData {
  HydraS1CircomSnarkProof proof;
  uint256[10] input;
  // destination
  // chainId
  // commitmentMapperPubKey.x
  // commitmentMapperPubKey.y
  // registryTreeRoot
  // externalNullifier
  // nullifier
  // claimedValue
  // accountsTreeValue
  // isStrict
}

struct HydraS1ProofInput {
  address destination;
  uint256 chainId;
  uint256 registryRoot;
  uint256 externalNullifier;
  uint256 nullifier;
  uint256 value;
  uint256 accountsTreeValue;
  bool isStrict;
  uint256[2] commitmentMapperPubKey;
}

library HydraS1Lib {
  uint256 constant SNARK_FIELD =
    21888242871839275222246405745257275088548364400416034343698204186575808495617;

  error GroupIdAndPropertiesMismatch(uint256 expectedGroupId, uint256 groupId);

  function _input(HydraS1ProofData memory self) internal pure returns (HydraS1ProofInput memory) {
    return
      HydraS1ProofInput(
        _getDestination(self),
        _getChainId(self),
        _getRegistryRoot(self),
        _getExpectedExternalNullifier(self),
        _getNullifier(self),
        _getValue(self),
        _getAccountsTreeValue(self),
        _getIsStrict(self),
        _getCommitmentMapperPubKey(self)
      );
  }

  function _claim(Request memory self) internal pure returns (HydraS1Claim memory) {
    Claim memory claim = self.claims[0];
    _validateClaim(claim);

    HydraS1GroupProperties memory groupProperties = abi.decode(
      claim.extraData,
      (HydraS1GroupProperties)
    );

    return (HydraS1Claim(claim.groupId, claim.claimedValue, self.destination, groupProperties));
  }

  function _toCircomFormat(HydraS1ProofData memory self)
    internal
    pure
    returns (
      uint256[2] memory,
      uint256[2][2] memory,
      uint256[2] memory,
      uint256[10] memory
    )
  {
    return (self.proof.a, self.proof.b, self.proof.c, self.input);
  }

  function _getDestination(HydraS1ProofData memory self) internal pure returns (address) {
    return address(uint160(self.input[0]));
  }

  function _getChainId(HydraS1ProofData memory self) internal pure returns (uint256) {
    return self.input[1];
  }

  function _getCommitmentMapperPubKey(HydraS1ProofData memory self)
    internal
    pure
    returns (uint256[2] memory)
  {
    return [self.input[2], self.input[3]];
  }

  function _getRegistryRoot(HydraS1ProofData memory self) internal pure returns (uint256) {
    return self.input[4];
  }

  function _getExpectedExternalNullifier(HydraS1ProofData memory self)
    internal
    pure
    returns (uint256)
  {
    return self.input[5];
  }

  function _getNullifier(HydraS1ProofData memory self) internal pure returns (uint256) {
    return self.input[6];
  }

  function _getValue(HydraS1ProofData memory self) internal pure returns (uint256) {
    return self.input[7];
  }

  function _getAccountsTreeValue(HydraS1ProofData memory self) internal pure returns (uint256) {
    return self.input[8];
  }

  function _getIsStrict(HydraS1ProofData memory self) internal pure returns (bool) {
    return self.input[9] == 1;
  }

  function _getNullifier(bytes calldata self) internal pure returns (uint256) {
    HydraS1ProofData memory snarkProofData = abi.decode(self, (HydraS1ProofData));
    uint256 nullifier = uint256(_getNullifier(snarkProofData));
    return nullifier;
  }

  function _generateGroupIdFromProperties(
    uint128 groupIndex,
    uint32 generationTimestamp,
    bool isScore
  ) internal pure returns (uint256) {
    return
      _generateGroupIdFromEncodedProperties(
        _encodeGroupProperties(groupIndex, generationTimestamp, isScore)
      );
  }

  function _generateGroupIdFromEncodedProperties(bytes memory encodedProperties)
    internal
    pure
    returns (uint256)
  {
    return uint256(keccak256(encodedProperties)) % HydraS1Lib.SNARK_FIELD;
  }

  function _encodeGroupProperties(
    uint128 groupIndex,
    uint32 generationTimestamp,
    bool isScore
  ) internal pure returns (bytes memory) {
    return abi.encode(groupIndex, generationTimestamp, isScore);
  }

  function _validateClaim(Claim memory claim) internal pure {
    uint256 expectedGroupId = _generateGroupIdFromEncodedProperties(claim.extraData);
    if (claim.groupId != expectedGroupId)
      revert GroupIdAndPropertiesMismatch(expectedGroupId, claim.groupId);
  }
}
