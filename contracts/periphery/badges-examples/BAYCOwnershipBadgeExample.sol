// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {ERC721} from '@openzeppelin/contracts/token/ERC721/ERC721.sol';
import {IAttestationsRegistry} from '../../core/interfaces/IAttestationsRegistry.sol';

contract BAYCOwnershipBadge is ERC721 {
  IAttestationsRegistry immutable ATTESTATIONS_REGISTRY;
  uint256 constant HydraS1_BAYC_ATTESTATION_COLLECTION_ID = 100000001;
  uint256 constant SMPS_BAYC_ATTESTATION_COLLECTION_ID = 30000000000003;

  constructor(
    address attestationsRegistryAddress,
    string memory name,
    string memory symbol
  ) ERC721(name, symbol) {
    ATTESTATIONS_REGISTRY = IAttestationsRegistry(attestationsRegistryAddress);
  }

  function balanceOf(address account) public view virtual override returns (uint256) {
    bool hasZKAttestation = ATTESTATIONS_REGISTRY.getAttestationValue(
      HydraS1_BAYC_ATTESTATION_COLLECTION_ID,
      account
    ) > 0;
    bool hasDoxingAttestation = ATTESTATIONS_REGISTRY.getAttestationValue(
      SMPS_BAYC_ATTESTATION_COLLECTION_ID,
      account
    ) > 0;
    return hasZKAttestation || hasDoxingAttestation ? 1 : 0;
  }
}
