import { ethers } from 'ethers';
import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { deploymentsConfig } from '../../deploy-tasks/deployments-config';
import { TransparentUpgradeableProxy__factory } from '../../../types';
import { CommonTaskOptions } from '../../utils';
import { confirm } from '../../utils/confirm';

export type UpgradeProxyArgs = {
  proxyAddress: string;
  proxyData: string;
  newImplementationAddress: string;
  options?: CommonTaskOptions;
};

async function upgradeProxy(
  { proxyAddress, proxyData, newImplementationAddress, options }: UpgradeProxyArgs,
  hre: HardhatRuntimeEnvironment
): Promise<void> {
  const config = deploymentsConfig[process.env.FORK_NETWORK ?? hre.network.name];

  if (options?.log || options?.manualConfirm) {
    console.log(`
    ************************************
    *          UPGRADE PROXY           *
    ************************************`);

    console.log(`
    * upgrading proxy ***********
    Proxy Address: ${proxyAddress}
    new Implementation Address: ${newImplementationAddress}
    `);
    if (options?.manualConfirm) {
      await confirm();
    }
  }

  if (process.env.MANUAL_UPGRADE_PROXY === 'true') {
    // we can't connect as signer, we need manual operation
    const iface = new ethers.utils.Interface(TransparentUpgradeableProxy__factory.abi);
    const data = iface.encodeFunctionData('upgradeToAndCall', [
      newImplementationAddress,
      proxyData,
    ]);
    console.log({
      proxyAddress,
      newImplementationAddress,
      data: data,
    });
    console.log('Send the transaction using etherscan !');
  } else {
    // We can connect as proxy admin because signer is unlock
    const proxyAdmin = config.deployOptions.proxyAdmin as string;
    const proxyAdminSigner = await hre.ethers.getSigner(proxyAdmin);
    const proxy = TransparentUpgradeableProxy__factory.connect(proxyAddress, proxyAdminSigner);

    await (await proxy.upgradeToAndCall(newImplementationAddress, proxyData)).wait();

    if (options?.log || options?.manualConfirm) {
      console.log(`
      * Proxy implementation well updated !
      `);
    }
  }

  if (options?.log) {
    console.log(`
    * proxy upgraded ***********
    Proxy Address: ${proxyAddress}
    new Implementation Address: ${newImplementationAddress}
    `);
  }
}

task('upgrade-proxy')
  .addParam('proxyAddress', 'Address of the proxy to upgrade')
  .addParam('newImplementationAddress', 'Address of the new implementation')
  .setAction(upgradeProxy);
