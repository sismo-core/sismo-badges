import { BigNumber, BigNumberish, ContractTransaction } from 'ethers';
import { AttestationsRegistry, HydraS1AccountboundAttester } from 'types';
import { expect } from 'chai';
import { HydraS1ProofRequest } from 'test/utils/hydra-s1';

export const testAttestationIsWellRegistered = async ({
  proofRequest,
  nullifier,
  badgeId,
  accountAddress,
  expectedCooldownStart,
  expectedBurnCount,
  tx,
  attestationsRegistry,
  attester,
}: {
  proofRequest: HydraS1ProofRequest;
  nullifier: BigNumberish;
  badgeId: BigNumberish;
  accountAddress: string;
  expectedCooldownStart: number;
  expectedBurnCount: number;
  tx: ContractTransaction;
  attestationsRegistry: AttestationsRegistry;
  attester: HydraS1AccountboundAttester;
}): Promise<boolean> => {
  const extraData = await attestationsRegistry.getAttestationExtraData(badgeId, accountAddress);

  // 0 - Checks that the transaction emitted the event
  await expect(tx)
    .to.emit(attester, 'AttestationGenerated')
    .withArgs([
      badgeId,
      accountAddress,
      attester.address,
      proofRequest.value,
      proofRequest.group.properties.generationTimestamp,
      extraData,
    ]);

  // 1 - Checks that the provided nullifier was successfully recorded in the attester
  expect(await attester.getDestinationOfNullifier(BigNumber.from(nullifier))).to.equal(
    accountAddress
  );

  expect(await attester.getNullifierCooldownStart(BigNumber.from(nullifier))).to.be.eql(
    expectedCooldownStart
  );

  expect(await attester.getNullifierBurnCount(BigNumber.from(nullifier))).to.be.eql(
    expectedBurnCount
  );

  // 2 - Checks that the attester recorded the attestation in the registry
  expect(await attestationsRegistry.hasAttestation(badgeId, accountAddress)).to.be.true;

  return true;
};
