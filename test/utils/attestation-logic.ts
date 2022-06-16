import { BigNumber } from 'ethers';

export const computeId = (shardId: number, id: number): BigNumber => {
  return BigNumber.from(shardId).mul(BigNumber.from(2).pow(224)).add(id);
};
