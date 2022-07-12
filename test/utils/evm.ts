import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

export async function increaseTime(
  hre: HardhatRuntimeEnvironment,
  secondsToIncrease: number
): Promise<void> {
  await hre.ethers.provider.send('evm_increaseTime', [secondsToIncrease]);
  await hre.ethers.provider.send('evm_mine', []);
}

export async function setTime(hre: HardhatRuntimeEnvironment, timestamp: number): Promise<void> {
  await hre.ethers.provider.send('evm_setNextBlockTimestamp', [timestamp]);
}

export async function evmSnapshot(hre: HardhatRuntimeEnvironment): Promise<string> {
  const snapshotId = hre.ethers.provider.send('evm_snapshot', []);
  return snapshotId;
}

export async function evmRevert(hre: HardhatRuntimeEnvironment, snapshotId: string): Promise<void> {
  await hre.ethers.provider.send('evm_revert', [snapshotId]);
}

export async function impersonateAddress(
  hre: HardhatRuntimeEnvironment,
  address: string,
  overrideBalance?: boolean
): Promise<SignerWithAddress> {
  await (hre as HardhatRuntimeEnvironment).network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [address],
  });
  if (overrideBalance) {
    await (hre as HardhatRuntimeEnvironment).network.provider.request({
      method: 'hardhat_setBalance',
      params: [address, '0x10000000000000000000'],
    });
  }
  const signer = hre.ethers.provider.getSigner(address);
  return SignerWithAddress.create(signer);
}
