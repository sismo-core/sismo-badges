import { BigNumberish } from 'ethers';
import { AttestationsRegistry } from 'types';

export async function getAttestationsValues(
  attestationsRegistry: AttestationsRegistry,
  collectionsIds: BigNumberish[],
  addresses: string[]
): Promise<BigNumberish[]> {
  const values: BigNumberish[] = [];
  for (const [index, collectionId] of collectionsIds.entries()) {
    const value = await attestationsRegistry.getAttestationValue(collectionId, addresses[index]);
    values.push(value);
  }
  return values;
}
