import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

import { AddressesProvider__factory, AvailableRootsRegistry__factory } from '../../types';
import { manualConfirmValidity } from '../utils/confirm';
import { CommonTaskOptions, wrapCommonOptions } from '../utils';

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

export type SetBatchArgs = {
  signer: SignerWithAddress;
  contractAddressesAsString: string;
  contractNamesAsString: string;
  options?: CommonTaskOptions;
};

async function action(
  { signer, contractAddressesAsString, contractNamesAsString, options }: SetBatchArgs,
  hre: HardhatRuntimeEnvironment
): Promise<void> {
  const sismoAddressesProvider = AddressesProvider__factory.connect(
    (await hre.deployments.get(`AddressesProvider`)).address,
    signer
  );

  const contractAddresses = contractAddressesAsString.split(',');
  const contractNames = contractNamesAsString.split(',');

  const actionSetBatchArgs = {
    contractAddresses,
  };

  await manualConfirmValidity(actionSetBatchArgs, options);

  const tx = await sismoAddressesProvider.setBatch(contractAddresses, contractNames);
  await tx.wait();

  if (options?.log) {
    console.log(`

    Batch set for ${contractNames} at ${sismoAddressesProvider.address}

    `);
  }
}

task('set-batch')
  .addParam('contractAddressesAsString', 'Addresses of the contracts we want to set')
  .addParam('contractNamesAsString', 'Names of the contracts we want to set')
  .setAction(wrapCommonOptions(action));
