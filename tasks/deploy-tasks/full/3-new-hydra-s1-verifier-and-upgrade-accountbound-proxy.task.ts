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
import { DeployedHydraS1AccountboundAttester } from 'tasks/deploy-tasks/unit/attesters/hydra-s1/variants/deploy-hydra-s1-accountbound-attester.task';
import { DeployedHydraS1SimpleAttester } from 'tasks/deploy-tasks/unit/attesters/hydra-s1/deploy-hydra-s1-simple-attester.task';
import { deploymentsConfig } from '../deployments-config';

export interface Deployed3 {
  hydraS1SimpleAttester: HydraS1SimpleAttester;
  hydraS1Verifier: HydraS1Verifier;
  pythia1SimpleAttester: Pythia1SimpleAttester;
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
    console.log('2-upgrade-proxies: ', hre.network.name);
  }

  // The following proxies will be updated:
  // - HydraS1Verifier => rename ticket in nullifier
  // - HydraS1SimpleAttester  => rename ticket in nullifier
  // - Pyhtia1Verifier => rename ticket in nullifier
  // - Pythia1SimpleAttester  => rename ticket in nullifier
  // - HydraS1AccountboundAttester => cooldown duration removed from groupProperties + inherits from HydraS1SimpleAttester

  // Upgrade HydraS1Verifier and HydraS1SimpleAttester
  const { hydraS1SimpleAttester: newHydraS1SimpleAttester, hydraS1Verifier: newHydraS1Verifier } =
    (await hre.run('deploy-hydra-s1-simple-attester', {
      collectionIdFirst: config.hydraS1SimpleAttester.collectionIdFirst,
      collectionIdLast: config.hydraS1SimpleAttester.collectionIdLast,
      commitmentMapperRegistryAddress: config.commitmentMapper.address,
      availableRootsRegistryAddress: config.availableRootsRegistry.address,
      attestationsRegistryAddress: config.attestationsRegistry.address,
      options: {
        ...options,
        implementationVersion: 3,
        proxyAddress: config.hydraS1SimpleAttester.address,
      },
    })) as DeployedHydraS1SimpleAttester;

  // Upgrade Pythia1Verifier and Pythia1SimpleAttester
  const { pythia1SimpleAttester: newPythia1SimpleAttester } = (await hre.run(
    'deploy-pythia-1-simple-attester',
    {
      collectionIdFirst: config.synapsPythia1SimpleAttester.collectionIdFirst,
      collectionIdLast: config.synapsPythia1SimpleAttester.collectionIdLast,
      attestationsRegistryAddress: config.attestationsRegistry.address,
      commitmentSignerPubKeyX: config.synapsPythia1SimpleAttester.commitmentSignerPubKeyX,
      commitmentSignerPubKeyY: config.synapsPythia1SimpleAttester.commitmentSignerPubKeyY,
      owner: config.synapsPythia1SimpleAttester.owner,
      pythia1Verifier: config.pythia1Verifier.address,
      options: {
        ...options,
        implementationVersion: 2,
        proxyAddress: config.synapsPythia1SimpleAttester.address,
      },
    }
  )) as DeployedPythia1SimpleAttester;

  // Upgrade HydraS1AccountboundAttester
  const { hydraS1AccountboundAttester: newHydraS1AccountboundAttester } = (await hre.run(
    'deploy-hydra-s1-accountbound-attester',
    {
      collectionIdFirst: config.hydraS1AccountboundAttester.collectionIdFirst,
      collectionIdLast: config.hydraS1AccountboundAttester.collectionIdLast,
      commitmentMapperRegistryAddress: config.commitmentMapper.address,
      availableRootsRegistryAddress: config.availableRootsRegistry.address,
      attestationsRegistryAddress: config.attestationsRegistry.address,
      hydraS1VerifierAddress: newHydraS1Verifier.address,
      options: {
        ...options,
        implementationVersion: 3,
        proxyAddress: config.hydraS1AccountboundAttester.address,
      },
    }
  )) as DeployedHydraS1AccountboundAttester;

  return {
    hydraS1Verifier: newHydraS1Verifier,
    hydraS1SimpleAttester: newHydraS1SimpleAttester,
    pythia1SimpleAttester: newPythia1SimpleAttester,
    hydraS1AccountboundAttester: newHydraS1AccountboundAttester,
  };
}

task('3-new-hydra-s1-verifier-and-upgrade-accountbound-proxy').setAction(deploymentAction);
