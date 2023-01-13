import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { AddressesProvider__factory } from '../../types';
import { CommonTaskOptions, wrapCommonOptions } from '../utils';
import { confirm } from '../utils/confirm';
import { deploymentsConfig } from '../../tasks/deploy-tasks/deployments-config';

export type SetBatchArgs = {
  contractAddressesAsString: string;
  contractNamesAsString: string;
  options?: CommonTaskOptions;
};

async function action(
  { contractAddressesAsString, contractNamesAsString, options }: SetBatchArgs,
  hre: HardhatRuntimeEnvironment
): Promise<void> {
  const [signer] = await hre.ethers.getSigners();

  const config = deploymentsConfig[process.env.FORK_NETWORK ?? hre.network.name];

  const contractAddresses = contractAddressesAsString.split(',');
  const contractNames = contractNamesAsString.split(',');

  const sismoAddressesProvider = AddressesProvider__factory.connect(
    config.sismoAddressesProvider.address,
    signer
  );

  if (process.env.SET_BATCH_MANUAL_OPERATION === 'true') {
    console.log(`
    ************************************
    *             SET BATCH            *
    ************************************`);

    if (options?.manualConfirm) {
      await confirm();
    }

    // we can't connect as signer, we need manual operation
    const iface = new hre.ethers.utils.Interface(AddressesProvider__factory.abi);
    const data = iface.encodeFunctionData('setBatch', [contractAddresses, contractNames]);

    console.log({
      from: await sismoAddressesProvider.owner(),
      to: sismoAddressesProvider.address,
      data: data,
    });

    console.log('Send the transaction using etherscan !');
  } else {
    console.log(`
    Aborting setBatch...`);
  }
}

task('set-batch')
  .addParam('contractAddressesAsString', 'Addresses of the contracts we want to set')
  .addParam('contractNamesAsString', 'Names of the contracts we want to set')
  .setAction(wrapCommonOptions(action));
