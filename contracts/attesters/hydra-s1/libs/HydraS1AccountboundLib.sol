// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Claim, Request} from '../../../core/libs/Structs.sol';
import {HydraS1Lib, HydraS1Claim, HydraS1GroupProperties} from './HydraS1Lib.sol';

// user Hydra-S1 claim retrieved form his request
struct HydraS1AccountboundClaim {
  uint256 groupId; // user claims to have an account in this group
  uint256 claimedValue; // user claims this value for its account in the group
  address destination; // user claims to own this destination[]
  HydraS1AccountboundGroupProperties groupProperties; // user claims the group has the following properties
}

struct HydraS1AccountboundGroupProperties {
  uint128 groupIndex;
  uint32 generationTimestamp;
  uint32 cooldownDuration;
  bool isScore;
}

library HydraS1AccountboundLib {
  error GroupIdAndPropertiesMismatch(uint256 expectedGroupId, uint256 groupId);

  function _hydraS1claim(Request memory self) internal pure returns (HydraS1Claim memory) {
    Claim memory claim = self.claims[0];
    _validateClaim(claim);

    HydraS1AccountboundGroupProperties memory groupProperties = abi.decode(
      claim.extraData,
      (HydraS1AccountboundGroupProperties)
    );

    HydraS1GroupProperties memory hydraS1GroupProperties = HydraS1GroupProperties(
      groupProperties.groupIndex,
      groupProperties.generationTimestamp,
      groupProperties.isScore
    );

    return (
      HydraS1Claim(claim.groupId, claim.claimedValue, self.destination, hydraS1GroupProperties)
    );
  }

  function _hydraS1Accountboundclaim(Request memory self)
    internal
    pure
    returns (HydraS1AccountboundClaim memory)
  {
    Claim memory claim = self.claims[0];
    _validateClaim(claim);

    HydraS1AccountboundGroupProperties memory hydraS1AccountboundGroupProperties = abi.decode(
      claim.extraData,
      (HydraS1AccountboundGroupProperties)
    );

    return (
      HydraS1AccountboundClaim(
        claim.groupId,
        claim.claimedValue,
        self.destination,
        hydraS1AccountboundGroupProperties
      )
    );
  }

  function _generateGroupIdFromEncodedProperties(bytes memory encodedProperties)
    internal
    pure
    returns (uint256)
  {
    return uint256(keccak256(encodedProperties)) % HydraS1Lib.SNARK_FIELD;
  }

  function _validateClaim(Claim memory claim) internal pure {
    uint256 expectedGroupId = _generateGroupIdFromEncodedProperties(claim.extraData);
    if (claim.groupId != expectedGroupId)
      revert GroupIdAndPropertiesMismatch(expectedGroupId, claim.groupId);
  }
}
