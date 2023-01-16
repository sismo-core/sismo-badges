import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { TransparentUpgradeableProxy__factory } from '../../../types';
import { CommonTaskOptions, wrapCommonOptions } from '../../utils';
import { confirm } from '../../utils/confirm';
import { deploymentsConfig } from '../../deploy-tasks/deployments-config';

export type ChangeProxyAdminArgs = {
  proxyAddress: string;
  newAdmin: string;
  options?: CommonTaskOptions;
};

async function action(
  { proxyAddress, newAdmin, options }: ChangeProxyAdminArgs,
  hre: HardhatRuntimeEnvironment
): Promise<void> {
  const [signer] = await hre.ethers.getSigners();

  const config = deploymentsConfig[process.env.FORK_NETWORK ?? hre.network.name];

  const proxy = TransparentUpgradeableProxy__factory.connect(proxyAddress, signer);

  if (process.env.CHANGE_PROXY_ADMIN_MANUAL_OPERATION === 'true') {
    console.log(`
    ************************************
    *       CHANGE PROXY ADMIN         *
    ************************************`);

    if (options?.manualConfirm) {
      await confirm();
    }

    // we can't connect as signer, we need manual operation
    const iface = new hre.ethers.utils.Interface(TransparentUpgradeableProxy__factory.abi);
    const data = iface.encodeFunctionData('changeAdmin', [newAdmin]);

    console.log({
      from: signer.address,
      to: proxy.address,
      data: data,
    });

    console.log('Send the transaction using etherscan !');
  } else {
    console.log(`
    Aborting changeProxyAdmin...`);
  }
}

task('change-proxy-admin')
  .addParam('proxyAddress', "Address of the proxy we want to change it's admin")
  .addParam('newAdmin', 'Address of the new admin')
  .setAction(wrapCommonOptions(action));
