import { HydraS1SimpleAttester } from '../../../types/HydraS1SimpleAttester';
import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployOptions, getDeployer } from '../utils';
import {
  HydraS1AccountboundAttester,
  HydraS1Verifier,
  Pythia1SimpleAttester,
  Pythia1Verifier,
} from 'types';
import { DeployedPythia1SimpleAttester } from 'tasks/deploy-tasks/unit/attesters/pythia-1/deploy-pythia-1-simple-attester.task';
import { DeployedHydraS1AccountboundAttester } from 'tasks/deploy-tasks/unit/attesters/hydra-s1/deploy-hydra-s1-accountbound-attester.task';
import { DeployedHydraS1SimpleAttester } from 'tasks/deploy-tasks/unit/attesters/hydra-s1/deploy-hydra-s1-simple-attester.task';
import { deploymentsConfig } from '../deployments-config';

export interface Deployed3 {
  hydraS1Verifier: HydraS1Verifier;
  hydraS1AccountboundAttester: HydraS1AccountboundAttester;
}

async function deploymentAction(
  { options }: { options: DeployOptions },
  hre: HardhatRuntimeEnvironment
): Promise<Deployed3> {
  const deployer = await getDeployer(hre);
  const config = deploymentsConfig[process.env.FORK_NETWORK ?? hre.network.name];
  options = { ...config.deployOptions, ...options };

  if (options.manualConfirm || options.log) {
    console.log('3-new-hydra-s1-verifier-and-upgrade-accountbound-proxy: ', hre.network.name);
  }

  // The following proxies will be updated:
  // - HydraS1Verifier => rename ticket in nullifier
  // - HydraS1SimpleAttester implementation will be replaced by the HydraS1AccountboundAttester implementation => cooldown duration removed from groupProperties + inherits from HydraS1SimpleAttester

  // Upgrade HydraS1Verifier
  const { hydraS1Verifier: newHydraS1Verifier } = await hre.run('deploy-hydra-s1-verifier', {
    options,
  });

  // Upgrade HydraS1AccountboundAttester
  const { hydraS1AccountboundAttester: newHydraS1AccountboundAttester } = (await hre.run(
    'deploy-hydra-s1-accountbound-attester',
    {
      // the collectionIds referenced are the ones used by the previous HydraS1SImpleAttester
      collectionIdFirst: config.hydraS1AccountboundAttester.collectionIdFirst,
      collectionIdLast: config.hydraS1AccountboundAttester.collectionIdLast,
      commitmentMapperRegistryAddress: config.commitmentMapper.address,
      availableRootsRegistryAddress: config.availableRootsRegistry.address,
      attestationsRegistryAddress: config.attestationsRegistry.address,
      hydraS1VerifierAddress: newHydraS1Verifier.address, // reference the new hydraS1Verifier address
      owner: config.hydraS1AccountboundAttester.owner, // set the owner referenced in the config
      options: {
        ...options,
        implementationVersion: 4,
        proxyAddress: config.hydraS1AccountboundAttester.address, // the address referenced here is the old address of the hydraS1SimpleAttester
      },
    }
  )) as DeployedHydraS1AccountboundAttester;

  return {
    hydraS1Verifier: newHydraS1Verifier,
    hydraS1AccountboundAttester: newHydraS1AccountboundAttester,
  };
}

task('3-new-hydra-s1-verifier-and-upgrade-accountbound-proxy').setAction(deploymentAction);
