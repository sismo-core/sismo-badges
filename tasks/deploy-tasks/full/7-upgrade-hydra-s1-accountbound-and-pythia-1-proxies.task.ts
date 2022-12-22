import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployOptions } from '../utils';
import { deploymentsConfig } from '../deployments-config';
import { DeployedHydraS1AccountboundAttester } from 'tasks/deploy-tasks/unit/attesters/hydra-s1/deploy-hydra-s1-accountbound-attester.task';
import { DeployedPythia1SimpleAttester } from 'tasks/deploy-tasks/unit/attesters/pythia-1/deploy-pythia-1-simple-attester.task';
import { HydraS1AccountboundAttester, Pythia1SimpleAttester } from 'types';

export interface Deployed7 {
  hydraS1AccountboundAttester: HydraS1AccountboundAttester;
  pythia1SimpleAttester: Pythia1SimpleAttester;
}

async function deploymentAction(
  { options }: { options: DeployOptions },
  hre: HardhatRuntimeEnvironment
): Promise<Deployed7> {
  const config = deploymentsConfig[process.env.FORK_NETWORK ?? hre.network.name];
  options = { ...config.deployOptions, ...options };

  if (options.manualConfirm || options.log) {
    console.log('7-upgrade-hydra-s1-accountbound-and-pythia-1-proxies: ', hre.network.name);
  }

  // Upgrade HydraS1AccountboundAttester
  const { hydraS1AccountboundAttester: newHydraS1AccountboundAttester } = (await hre.run(
    'deploy-hydra-s1-accountbound-attester',
    {
      // the collectionIds referenced are the ones used by the previous HydraS1SimpleAttester
      collectionIdFirst: config.hydraS1AccountboundAttester.collectionIdFirst,
      collectionIdLast: config.hydraS1AccountboundAttester.collectionIdLast,
      commitmentMapperRegistryAddress: config.commitmentMapper.address,
      availableRootsRegistryAddress: config.availableRootsRegistry.address,
      attestationsRegistryAddress: config.attestationsRegistry.address,
      hydraS1VerifierAddress: config.hydraS1Verifier.address,
      owner: config.hydraS1AccountboundAttester.owner,
      options: {
        ...options,
        isImplementationUpgrade: true,
        proxyAddress: config.hydraS1AccountboundAttester.address,
      },
    }
  )) as DeployedHydraS1AccountboundAttester;

  // Upgrade Pythia1SimpleAttester
  const { pythia1SimpleAttester: newPythia1SimpleAttester } = (await hre.run(
    'deploy-pythia-1-simple-attester',
    {
      collectionIdFirst: config.synapsPythia1SimpleAttester.collectionIdFirst,
      collectionIdLast: config.synapsPythia1SimpleAttester.collectionIdLast,
      attestationsRegistryAddress: config.attestationsRegistry.address,
      commitmentSignerPubKeyX: config.synapsPythia1SimpleAttester.commitmentSignerPubKeyX,
      commitmentSignerPubKeyY: config.synapsPythia1SimpleAttester.commitmentSignerPubKeyY,
      pythia1VerifierAddress: config.pythia1Verifier.address,
      owner: config.synapsPythia1SimpleAttester.owner,
      options: {
        ...options,
        isImplementationUpgrade: true,
        proxyAddress: config.synapsPythia1SimpleAttester.address,
      },
    }
  )) as DeployedPythia1SimpleAttester;

  return {
    hydraS1AccountboundAttester: newHydraS1AccountboundAttester,
    pythia1SimpleAttester: newPythia1SimpleAttester,
  };
}

task('7-upgrade-hydra-s1-accountbound-and-pythia-1-proxies').setAction(deploymentAction);
