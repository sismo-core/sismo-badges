import { BigNumberish } from 'ethers';
import { Badges } from 'types';
import { expect } from 'chai';

export async function getBadgeBalancesAndAssert(
  badges: Badges,
  collectionsIds: BigNumberish[],
  addresses: string[],
  expectedValue: BigNumberish[]
): Promise<BigNumberish[]> {
  const balances: BigNumberish[] = [];
  for (const [index, collectionId] of collectionsIds.entries()) {
    const balance = await badges.balanceOf(addresses[index], collectionId);
    expect(balance).to.be.equal(expectedValue[index]);
  }
  return balances;
}
