import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import {
  afterDeployment,
  beforeDeployment,
  buildDeploymentName,
  customDeployContract,
  DeployOptions,
  getDeployer,
  wrapCommonDeployOptions,
} from '../../../tasks/deploy-tasks/utils';
import { MockContractUsingSismoLib, MockContractUsingSismoLib__factory } from '../../../types';

export interface DeployMockContractUsingSismoLibArgs {
  options?: DeployOptions;
}

export interface DeployedMockContractUsingSismoLib {
  mockContractUsingSismoLib: MockContractUsingSismoLib;
}

const CONTRACT_NAME = 'MockContractUsingSismoLib';

async function deploymentAction(
  { options }: DeployMockContractUsingSismoLibArgs,
  hre: HardhatRuntimeEnvironment
): Promise<DeployedMockContractUsingSismoLib> {
  const deployer = await getDeployer(hre);

  const deploymentName = buildDeploymentName(CONTRACT_NAME, options?.deploymentNamePrefix);

  const deploymentArgs = [];

  await beforeDeployment(hre, deployer, CONTRACT_NAME, deploymentArgs, options);

  const deployed = await customDeployContract(
    hre,
    deployer,
    deploymentName,
    CONTRACT_NAME,
    deploymentArgs,
    options
  );

  await afterDeployment(hre, deployer, CONTRACT_NAME, deploymentArgs, deployed, options);
  const mockContractUsingSismoLib = MockContractUsingSismoLib__factory.connect(
    deployed.address,
    deployer
  );

  return { mockContractUsingSismoLib };
}

task('deploy-mock-contract-using-sismo-lib').setAction(wrapCommonDeployOptions(deploymentAction));
