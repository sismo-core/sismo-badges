import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployOptions, getDeployer } from '../utils';
import {
  AvailableRootsRegistry,
  Badges,
  CommitmentMapperRegistry,
  Pythia1SimpleAttester,
} from 'types';
import { deploymentsConfig } from '../deployments-config';
import { DeployedPythia1SimpleAttester } from 'tasks/deploy-tasks/unit/attesters/pythia-1/deploy-pythia-1-simple-attester.task';
import { DeployedAvailableRootsRegistry } from 'tasks/deploy-tasks/unit/periphery/deploy-available-roots-registry.task';
import { DeployedCommitmentMapper } from 'tasks/deploy-tasks/unit/periphery/deploy-commitment-mapper-registry.task';

export interface Deployed5 {
  pythia1SimpleAttester: Pythia1SimpleAttester;
  availableRootsRegistry: AvailableRootsRegistry;
  commitmentMapperRegistry: CommitmentMapperRegistry;
}

async function deploymentAction(
  { options }: { options: DeployOptions },
  hre: HardhatRuntimeEnvironment
): Promise<Deployed5> {
  const config = deploymentsConfig[process.env.FORK_NETWORK ?? hre.network.name];
  options = { ...config.deployOptions, ...options };

  if (options.manualConfirm || options.log) {
    console.log('4-upgrade-attestations-registry-proxy: ', hre.network.name);
  }

  // The following proxies will be updated:
  // - Pythia1SimpleAttester => reinitializer modifier added and version as constant
  // - AvailableRootsRegistry => reinitializer modifier added and version as constant
  // - CommitmentMapperRegistry => reinitializer modifier added and version as constant

  // Upgrade pythia1SimpleAttester
  const { pythia1SimpleAttester: newPythia1SimpleAttester } = (await hre.run(
    'deploy-pythia-1-simple-attester',
    {
      collectionIdFirst: config.synapsPythia1SimpleAttester.collectionIdFirst,
      collectionIdLast: config.synapsPythia1SimpleAttester.collectionIdLast,
      attestationsRegistryAddress: config.attestationsRegistry.address,
      commitmentSignerPubKeyX: config.synapsPythia1SimpleAttester.commitmentSignerPubKeyX,
      commitmentSignerPubKeyY: config.synapsPythia1SimpleAttester.commitmentSignerPubKeyY,
      owner: config.synapsPythia1SimpleAttester.owner,
      options: {
        ...options,
        implementationVersion: 3, // implementation version has been bumped from v2 to v3
        proxyAddress: config.synapsPythia1SimpleAttester.address,
      },
    }
  )) as DeployedPythia1SimpleAttester;

  // Upgrade AvailableRootsRegistry
  const { availableRootsRegistry: newAvailableRootsRegistry } = (await hre.run(
    'deploy-available-roots-registry',
    {
      owner: config.availableRootsRegistry.owner,
      options: {
        ...options,
        implementationVersion: 2, // implementation version has been bumped from v1 to v2
        proxyAddress: config.availableRootsRegistry.address,
      },
    }
  )) as DeployedAvailableRootsRegistry;

  // Upgrade CommitmentMapperRegistry
  const { commitmentMapperRegistry: newCommitmentMapperRegistry } = (await hre.run(
    'deploy-commitment-mapper-registry',
    {
      commitmentMapperPubKeyX: config.commitmentMapper.EdDSAPubKeyX,
      commitmentMapperPubKeyY: config.commitmentMapper.EdDSAPubKeyY,
      owner: config.commitmentMapper.owner,
      options: {
        ...options,
        implementationVersion: 2, // implementation version has been bumped from v1 to v2
        proxyAddress: config.commitmentMapper.address,
      },
    }
  )) as DeployedCommitmentMapper;

  return {
    pythia1SimpleAttester: newPythia1SimpleAttester,
    availableRootsRegistry: newAvailableRootsRegistry,
    commitmentMapperRegistry: newCommitmentMapperRegistry,
  };
}

task('5-upgrade-proxies-with-reinitializer').setAction(deploymentAction);
