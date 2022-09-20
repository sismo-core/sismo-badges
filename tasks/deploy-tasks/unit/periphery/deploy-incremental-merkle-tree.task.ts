import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import {
  getDeployer,
  beforeDeployment,
  afterDeployment,
  buildDeploymentName,
  customDeployContract,
  wrapCommonDeployOptions,
  DeployOptions,
} from '../../../../tasks/deploy-tasks/utils';

import { IncrementalMerkleTree, IncrementalMerkleTree__factory } from '../../../../types';

export interface DeployIncrementalMerkleTree {
  hasherAddress?: string;
  levels?: number;
  rootHistorySize?: number;
  options?: DeployOptions;
}

export interface DeployedIncrementalMerkleTree {
  incrementalMerkleTree: IncrementalMerkleTree;
}

const CONTRACT_NAME = 'IncrementalMerkleTree';

async function deploymentAction(
  { hasherAddress, levels, rootHistorySize, options }: DeployIncrementalMerkleTree,
  hre: HardhatRuntimeEnvironment
): Promise<DeployedIncrementalMerkleTree> {
  const deployer = await getDeployer(hre);
  const deploymentName = buildDeploymentName(CONTRACT_NAME, options?.deploymentNamePrefix);
  const deploymentArgs = [2, 3, hasherAddress];

  await beforeDeployment(hre, deployer, CONTRACT_NAME, deploymentArgs, options);

  const deployed = await customDeployContract(
    hre,
    deployer,
    deploymentName,
    CONTRACT_NAME,
    deploymentArgs,
    {
      ...options,
    }
  );

  await afterDeployment(hre, deployer, CONTRACT_NAME, deploymentArgs, deployed, options);

  const incrementalMerkleTree = IncrementalMerkleTree__factory.connect(deployed.address, deployer);

  return { incrementalMerkleTree };
}

task('deploy-incremental-merkle-tree')
  .addParam('hasherAddress', '')
  .addParam('levels', '')
  .addParam('rootHistorySize', '')
  .addOptionalParam('owner', 'Admin of the attester register role. default to deployer')
  .setAction(wrapCommonDeployOptions(deploymentAction));
