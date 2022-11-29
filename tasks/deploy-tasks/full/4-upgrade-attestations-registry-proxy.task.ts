import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployOptions, getDeployer } from '../utils';
import { AttestationsRegistry } from 'types';
import { DeployedAttestationsRegistry } from 'tasks/deploy-tasks/unit/core/deploy-attestations-registry.task';
import { deploymentsConfig } from '../deployments-config';

export interface Deployed4 {
  attestationsRegistry: AttestationsRegistry;
}

async function deploymentAction(
  { options }: { options: DeployOptions },
  hre: HardhatRuntimeEnvironment
): Promise<Deployed4> {
  const config = deploymentsConfig[process.env.FORK_NETWORK ?? hre.network.name];
  options = { ...config.deployOptions, ...options };

  if (options.manualConfirm || options.log) {
    console.log('4-upgrade-attestations-registry-proxy: ', hre.network.name);
  }

  // The following proxy will be updated:
  // - AttestationRegistry => introduce attributes names and values for attestationsCollection
  //  tagPowers go from 0 to 15, if the tagPower is 0 the tag is disabled, else it is enabled with the power set

  // Upgrade attestations registry
  const { attestationsRegistry: newAttestationsRegistry } = (await hre.run(
    'deploy-attestations-registry',
    {
      badges: config.badges.address,
      owner: config.attestationsRegistry.owner,
      options: {
        ...options,
        implementationVersion: 3, // implementation version has been bumped from v2 to v3
        proxyAddress: config.attestationsRegistry.address,
      },
    }
  )) as DeployedAttestationsRegistry;

  return {
    attestationsRegistry: newAttestationsRegistry,
  };
}

task('4-upgrade-attestations-registry-proxy').setAction(deploymentAction);
