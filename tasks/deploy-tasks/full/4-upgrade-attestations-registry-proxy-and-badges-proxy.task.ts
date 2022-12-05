import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployOptions, getDeployer } from '../utils';
import { AttestationsRegistry, Badges } from 'types';
import { DeployedAttestationsRegistry } from 'tasks/deploy-tasks/unit/core/deploy-attestations-registry.task';
import { deploymentsConfig } from '../deployments-config';
import { DeployedBadges } from 'tasks/deploy-tasks/unit/core/deploy-badges.task';

export interface Deployed4 {
  attestationsRegistry: AttestationsRegistry;
  badges: Badges;
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
  //                          values go from 0 to 15, if the value is 0 the attribute is disabled, else it is enabled with the value set
  //                          + reinitializer modifier added and version as constant
  // - Badges => add getters for attestations issuer, timestamp and extradata
  //          => add getters for attribute values and names
  //          => + reinitializer modifier added and version as constant

  // Upgrade attestations registry
  const { attestationsRegistry: newAttestationsRegistry } = (await hre.run(
    'deploy-attestations-registry',
    {
      badges: config.badges.address,
      owner: config.attestationsRegistry.owner,
      options: {
        ...options,
        isImplementationUpgrade: true, // implementation version has been bumped from v2 to v3
        proxyAddress: config.attestationsRegistry.address,
      },
    }
  )) as DeployedAttestationsRegistry;

  // Upgrade Badges
  const { badges: newBadges } = (await hre.run('deploy-badges', {
    uri: config.badges.uri,
    owner: config.badges.owner,
    options: {
      ...options,
      isImplementationUpgrade: true, // implementation version has been bumped from v2 to v3
      proxyAddress: config.badges.address,
    },
  })) as DeployedBadges;

  return {
    attestationsRegistry: newAttestationsRegistry,
    badges: newBadges,
  };
}

task('4-upgrade-attestations-registry-proxy-and-badges-proxy').setAction(deploymentAction);
