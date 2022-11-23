import { DeployedBadges } from '../unit/core/deploy-badges.task';
import { HydraS1AccountboundAttester } from '../../../types/HydraS1AccountboundAttester';
import { HydraS1SimpleAttester } from '../../../types/HydraS1SimpleAttester';
import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployOptions, getDeployer } from '../utils';
import { Badges, Pythia1SimpleAttester, AttestationsRegistry } from 'types';
import { DeployedPythia1SimpleAttester } from 'tasks/deploy-tasks/unit/attesters/pythia-1/deploy-pythia-1-simple-attester.task';
import { DeployedHydraS1AccountboundAttester } from 'tasks/deploy-tasks/unit/attesters/hydra-s1/deploy-hydra-s1-accountbound-attester.task';
import { DeployedHydraS1SimpleAttester } from 'tasks/deploy-tasks/unit/attesters/hydra-s1/deploy-hydra-s1-simple-attester.task';
import { DeployedAttestationsRegistry } from 'tasks/deploy-tasks/unit/core/deploy-attestations-registry.task';
import { deploymentsConfig } from '../deployments-config';

export interface Deployed2 {
  attestationsRegistry: AttestationsRegistry;
  hydraS1SimpleAttester: HydraS1SimpleAttester;
  pythia1SimpleAttester: Pythia1SimpleAttester;
  badges: Badges;
  hydraS1AccountboundAttester: HydraS1AccountboundAttester;
}

async function deploymentAction(
  { options }: { options: DeployOptions },
  hre: HardhatRuntimeEnvironment
): Promise<Deployed2> {
  const deployer = await getDeployer(hre);
  const config = deploymentsConfig[process.env.FORK_NETWORK ?? hre.network.name];
  options = { ...config.deployOptions, ...options };

  if (options.manualConfirm || options.log) {
    console.log('2-upgrade-proxies: ', hre.network.name);
  }

  // The following proxies will be updated:
  // - AttestationRegistry => update of the deleteAttestations interface
  // - Badges => override of the setApprovalForAll function
  // - HydraS1SimpleAttester  => update of the Attester.sol deleteAttestations function
  // - Pythia1SimpleAttester  => update of the Attester.sol deleteAttestations function
  // - HydraS1AccountboundAttester => cooldown duration in groupProperties + burnCount in attestations extraData

  // Upgrade attestations registry
  const { attestationsRegistry: newAttestationsRegistry } = (await hre.run(
    'deploy-attestations-registry',
    {
      badges: config.badges.address,
      owner: config.attestationsRegistry.owner,
      options: {
        ...options,
        implementationVersion: 2,
        proxyAddress: config.attestationsRegistry.address,
      },
    }
  )) as DeployedAttestationsRegistry;

  // Upgrade Badges
  const { badges: newBadges } = (await hre.run('deploy-badges', {
    uri: config.badges.uri,
    owner: config.badges.owner,
    options: { ...options, implementationVersion: 2, proxyAddress: config.badges.address },
  })) as DeployedBadges;

  // Upgrade HydraS1SimpleAttester
  const { hydraS1SimpleAttester: newHydraS1SimpleAttester } = (await hre.run(
    'deploy-hydra-s1-simple-attester',
    {
      collectionIdFirst: config.hydraS1SimpleAttester.collectionIdFirst,
      collectionIdLast: config.hydraS1SimpleAttester.collectionIdLast,
      commitmentMapperRegistryAddress: config.commitmentMapper.address,
      availableRootsRegistryAddress: config.availableRootsRegistry.address,
      attestationsRegistryAddress: config.attestationsRegistry.address,
      hydraS1VerifierAddress: config.hydraS1Verifier.address,
      options: {
        ...options,
        implementationVersion: 3,
        proxyAddress: config.hydraS1SimpleAttester.address,
      },
    }
  )) as DeployedHydraS1SimpleAttester;

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
        implementationVersion: 2,
        proxyAddress: config.synapsPythia1SimpleAttester.address,
      },
    }
  )) as DeployedPythia1SimpleAttester;

  // Upgrade HydraS1AccountboundAttester
  // ! need to rename HydraS1SoulboundAttesterProxy and HydraS1SoulboundAttester to
  //  HydraS1AccountboundAttesterProxy and HydraS1AccountboundAttester

  const { hydraS1AccountboundAttester: newHydraS1AccountboundAttester } = (await hre.run(
    'deploy-hydra-s1-accountbound-attester',
    {
      collectionIdFirst: config.hydraS1AccountboundAttester.collectionIdFirst,
      collectionIdLast: config.hydraS1AccountboundAttester.collectionIdLast,
      commitmentMapperRegistryAddress: config.commitmentMapper.address,
      availableRootsRegistryAddress: config.availableRootsRegistry.address,
      attestationsRegistryAddress: config.attestationsRegistry.address,
      hydraS1VerifierAddress: config.hydraS1Verifier.address,
      options: {
        ...options,
        implementationVersion: 3,
        proxyAddress: config.hydraS1AccountboundAttester.address,
      },
    }
  )) as DeployedHydraS1AccountboundAttester;

  return {
    attestationsRegistry: newAttestationsRegistry,
    badges: newBadges,
    hydraS1SimpleAttester: newHydraS1SimpleAttester,
    pythia1SimpleAttester: newPythia1SimpleAttester,
    hydraS1AccountboundAttester: newHydraS1AccountboundAttester,
  };
}

task('2-upgrade-proxies').setAction(deploymentAction);
