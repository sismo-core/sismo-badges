import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { deploymentsConfig } from '../../deploy-tasks/deployments-config';
import { OwnableTransferOwnershipArgs } from './ownable-transfer-ownership.task';
import { CommonTaskOptions, getCommonOptions } from '../../utils';

export type AuthorizeRangeArgs = {
  options?: CommonTaskOptions;
};

async function authorizeRange(
  { options }: AuthorizeRangeArgs,
  hre: HardhatRuntimeEnvironment
): Promise<void> {
  const config = deploymentsConfig[hre.network.name];
  options = { ...config.deployOptions, ...options };

  if (options.manualConfirm || options.log) {
    console.log(`
      ----------------------------------------------------------------
      * Transfer AttestationsRegistry ownership`);
  }
  await hre.run('ownable-transfer-ownership', {
    contractAddress: (await hre.deployments.all()).AttestationsRegistry.address,
    newOwner: config.attestationsRegistry.owner,
    options: getCommonOptions(options),
  } as OwnableTransferOwnershipArgs);
}

task('transfer-attestations-registry-ownership').setAction(authorizeRange);
