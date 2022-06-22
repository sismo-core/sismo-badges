import { BigNumberish } from 'ethers';
import { Badges } from 'types';
import { expect } from 'chai';

export async function getBadgeBalancesAndAssert(
  badges: Badges,
  collectionsIds: BigNumberish[],
  addresses: string[],
  expectedValue: BigNumberish[]
): Promise<BigNumberish[]> {
  const values: BigNumberish[] = [];
  for (const [index, collectionId] of collectionsIds.entries()) {
    const value = await badges.balanceOf(addresses[index], collectionId);
    expect(value).to.be.equal(expectedValue[index]);
  }
  return values;
}
