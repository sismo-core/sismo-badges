import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BaseContract, utils } from 'ethers';

export const IMPLEMENTATION_SLOT: string =
  '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';

export const getImplementation = async (proxyContract: BaseContract): Promise<string> => {
  return utils.defaultAbiCoder.decode(
    ['address'],
    (await proxyContract.provider?.getStorageAt(proxyContract.address, IMPLEMENTATION_SLOT)) || ''
  )[0];
};
