import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployOptions, getDeployer } from '../utils';
import { deploymentsConfig } from '../deployments-config';
import { getCommonOptions } from '../../utils/common-options';
import { AuthorizeRangeArgs } from '../../helpers/authorizations/attestations-registry-authorize-range.task';
import {
  HydraS1IncrementalMerkleAttester,
  IncrementalMerkleTree,
  Pythia1SimpleAttester,
} from 'types';
import {
  DeployedPythia1SimpleAttester,
  DeployPythia1SimpleAttesterArgs,
} from 'tasks/deploy-tasks/unit/attesters/pythia-1/deploy-pythia-1-simple-attester.task';
import { Pythia1Verifier } from '@sismo-core/pythia-1';
import {
  DeployedIncrementalMerkleTree,
  DeployIncrementalMerkleTree,
} from '../unit/periphery/deploy-incremental-merkle-tree.task';
import {
  DeployedHydraS1IncrementalMerkleAttester,
  DeployHydraS1IncrementalMerkleAttesterArgs,
} from '../unit/attesters/hydra-s1/variants/deploy-hydra-s1-incremental-merkle-attester.task';

export interface Deployed2 {
  hydraS1IncrementalMerkleAttester: HydraS1IncrementalMerkleAttester;
  incrementalMerkleTree: IncrementalMerkleTree;
}

export interface DeployHydraS1MerkleArgs {
  hasherAddress: string;
  levels: number;
  rootHistorySize: number;
  options?: DeployOptions;
}

async function deploymentAction(
  { hasherAddress, levels, rootHistorySize, options }: DeployHydraS1MerkleArgs,
  hre: HardhatRuntimeEnvironment
): Promise<Deployed2> {
  const deployer = await getDeployer(hre);
  const config = deploymentsConfig[hre.network.name];
  options = { ...config.deployOptions, ...options };
  if (options.manualConfirm || options.log) {
    console.log('1-deploy-hydra-s1-merkle-attester: ', hre.network.name);
  }

  const { incrementalMerkleTree } = (await hre.run('deploy-incremental-merkle-tree', {
    hasherAddress,
    levels,
    rootHistorySize,
    options,
  })) as DeployIncrementalMerkleTree as DeployedIncrementalMerkleTree;

  const attestationsRegistry = await hre.deployments.get('AttestationsRegistry');
  const commitmentMapperRegistry = await hre.deployments.get('CommitmentMapperRegistry');

  const merkleArgs: DeployHydraS1IncrementalMerkleAttesterArgs = {
    collectionIdFirst: config.hydraS1SoulboundAttester.collectionIdFirst,
    collectionIdLast: config.hydraS1SoulboundAttester.collectionIdLast,
    commitmentMapperRegistryAddress: commitmentMapperRegistry.address,
    incrementalMerkleTreeAddress: incrementalMerkleTree.address,
    attestationsRegistryAddress: attestationsRegistry.address,
    options,
  };

  const { hydraS1IncrementalMerkleAttester } = (await hre.run(
    'deploy-hydra-s1-incremental-merkle-attester',
    merkleArgs
  )) as DeployedHydraS1IncrementalMerkleAttester;

  return {
    incrementalMerkleTree,
    hydraS1IncrementalMerkleAttester,
  };
}

task('2-deploy-hydra-s1-merkle-attester')
  .addParam('hasherAddress', '')
  .addParam('levels', '')
  .addParam('rootHistorySize', '')
  .setAction(deploymentAction);
