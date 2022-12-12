import { getDeployer } from './../utils/deployment';
import { AddressesProvider } from './../../../types/AddressesProvider';
import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployOptions } from '../utils';
import { deploymentsConfig } from '../deployments-config';
import { DeployedSismoAddressesProvider } from 'tasks/deploy-tasks/unit/core/deploy-sismo-addresses-provider.task';

export interface Deployed6 {
  sismoAddressesProvider: AddressesProvider;
}

async function deploymentAction(
  { options }: { options: DeployOptions },
  hre: HardhatRuntimeEnvironment
): Promise<Deployed6> {
  const config = deploymentsConfig[process.env.FORK_NETWORK ?? hre.network.name];
  options = { ...config.deployOptions, ...options };

  if (options.manualConfirm || options.log) {
    console.log('6-deploy-sismo-contracts-registry: ', hre.network.name);
  }

  const { sismoAddressesProvider } = (await hre.run('deploy-sismo-addresses-provider', {
    badges: config.badges.address,
    attestationsRegistry: config.attestationsRegistry.address,
    front: config.front.address,
    hydraS1AccountboundAttester: config.hydraS1AccountboundAttester.address,
    owner: config.sismoContractsRegistry.owner,
    options: { ...options, proxyAdmin: config.deployOptions.proxyAdmin },
  })) as DeployedSismoAddressesProvider;

  return {
    sismoAddressesProvider,
  };
}

task('6-deploy-sismo-addresses-provider').setAction(deploymentAction);
