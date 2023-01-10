import { FrontendLib } from '../../../../types/FrontendLib';
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
} from '../../utils';

import { FrontendLib__factory } from '../../../../types';
import { deploymentsConfig } from '../../../../tasks/deploy-tasks/deployments-config';

export interface DeployFrontendLib {
  hydraS1AccountboundAttester?: string;
  options?: DeployOptions;
}

export interface DeployedFrontendLib {
  frontendLib: FrontendLib;
}

const CONTRACT_NAME = 'FrontendLib';

async function deploymentAction(
  { hydraS1AccountboundAttester, options }: DeployFrontendLib,
  hre: HardhatRuntimeEnvironment
): Promise<DeployedFrontendLib> {
  const deployer = await getDeployer(hre);
  const deploymentName = buildDeploymentName(CONTRACT_NAME, options?.deploymentNamePrefix);
  const config = deploymentsConfig[hre.network.name];

  const deploymentArgs = [
    hydraS1AccountboundAttester || config.hydraS1AccountboundAttester.address,
  ];

  await beforeDeployment(hre, deployer, CONTRACT_NAME, deploymentArgs, options);

  const deployed = await customDeployContract(
    hre,
    deployer,
    deploymentName,
    CONTRACT_NAME,
    deploymentArgs,
    {
      ...options,
      behindProxy: false,
    }
  );

  await afterDeployment(hre, deployer, CONTRACT_NAME, deploymentArgs, deployed, options);

  const frontLib = FrontendLib__factory.connect(deployed.address, deployer);
  return { frontendLib: frontLib };
}

task('deploy-frontend-lib')
  .addOptionalParam(
    'hydraS1AccountboundAttester',
    'address of the hydraS1AccountboundAttester contract'
  )
  .setAction(wrapCommonDeployOptions(deploymentAction));
