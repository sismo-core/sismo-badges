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

import { Front, Front__factory } from '../../../../types';

export interface DeployFrontArgs {
  attestationsRegistryAddress: string;
  // owner of the contract
  // attester register role
  options: DeployOptions;
}

export interface DeployedFront {
  front: Front;
}

const CONTRACT_NAME = 'Front';

async function deploymentAction(
  { attestationsRegistryAddress, options }: DeployFrontArgs,
  hre: HardhatRuntimeEnvironment
): Promise<DeployedFront> {
  const deployer = await getDeployer(hre);
  const deploymentName = buildDeploymentName(CONTRACT_NAME, options?.deploymentNamePrefix);
  const deploymentArgs = [attestationsRegistryAddress];

  await beforeDeployment(hre, deployer, CONTRACT_NAME, deploymentArgs, options);

  const initData = '0x';

  const deployed = await customDeployContract(
    hre,
    deployer,
    deploymentName,
    CONTRACT_NAME,
    deploymentArgs,
    {
      ...options,
      proxyData: initData,
    }
  );

  await afterDeployment(hre, deployer, CONTRACT_NAME, deploymentArgs, deployed, options);

  const front = Front__factory.connect(deployed.address, deployer);
  return { front };
}

task('deploy-front')
  .addParam('attestationsRegistryAddress', 'Attestation Registry on which to read')
  .setAction(wrapCommonDeployOptions(deploymentAction));
