import { BigNumberish } from 'ethers';
import { AttestationsRegistry } from 'types';
import { expect } from 'chai';

export async function getAttestationValuesAndAssert(
  attestationsRegistry: AttestationsRegistry,
  collectionsIds: BigNumberish[],
  addresses: string[],
  expectedValue: BigNumberish[]
): Promise<BigNumberish[]> {
  const values: BigNumberish[] = [];
  for (const [index, collectionId] of collectionsIds.entries()) {
    const value = await attestationsRegistry.getAttestationValue(collectionId, addresses[index]);
    expect(value).to.be.equal(expectedValue[index]);
  }
  return values;
}
