import { getDeployer } from './../utils/deployment';
import { SismoContractsRegistry } from './../../../types/SismoContractsRegistry';
import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployOptions } from '../utils';
import { deploymentsConfig } from '../deployments-config';
import { DeployedSismoContractsRegistry } from 'tasks/deploy-tasks/unit/core/deploy-sismo-contracts-registry.task';

export interface Deployed6 {
  sismoContractsRegistry: SismoContractsRegistry;
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

  const { sismoContractsRegistry } = (await hre.run('deploy-sismo-contracts-registry', {
    options,
    badges: config.badges.address,
    attestationsRegistry: config.attestationsRegistry.address,
    front: config.front.address,
    hydraS1AccountboundAttester: config.hydraS1AccountboundAttester.address,
  })) as DeployedSismoContractsRegistry;

  return {
    sismoContractsRegistry,
  };
}

task('6-deploy-sismo-contracts-registry').setAction(deploymentAction);
