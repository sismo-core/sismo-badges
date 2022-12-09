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

import { SismoContractsRegistry, SismoContractsRegistry__factory } from '../../../../types';

export interface DeploySismoContractsRegistry {
  badges: string;
  attestationsRegistry: string;
  front: string;
  hydraS1AccountboundAttester: string;
  options?: DeployOptions;
}

export interface DeployedSismoContractsRegistry {
  sismoContractsRegistry: SismoContractsRegistry;
}

const CONTRACT_NAME = 'SismoContractsRegistry';

async function deploymentAction(
  {
    badges,
    attestationsRegistry,
    front,
    hydraS1AccountboundAttester,
    options,
  }: DeploySismoContractsRegistry,
  hre: HardhatRuntimeEnvironment
): Promise<DeployedSismoContractsRegistry> {
  const deployer = await getDeployer(hre);
  const deploymentName = buildDeploymentName(CONTRACT_NAME, options?.deploymentNamePrefix);
  const deploymentArgs = [badges, attestationsRegistry, front, hydraS1AccountboundAttester];

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
      // Always deploy this contract with deterministic deployment
      deterministicDeployment: true,
      proxyData: initData,
    }
  );

  await afterDeployment(hre, deployer, CONTRACT_NAME, deploymentArgs, deployed, options);

  const sismoContractsRegistry = SismoContractsRegistry__factory.connect(
    deployed.address,
    deployer
  );
  return { sismoContractsRegistry };
}

task('deploy-sismo-contracts-registry')
  .addParam('badges', 'Address of the badges contract')
  .addParam('attestationsRegistry', 'Address of the attestationsRegistry contract')
  .addParam('front', 'Address of the front contract')
  .addParam('hydraS1AccountboundAttester', 'Address of the hydraS1AccountboundAttester contract')
  .setAction(wrapCommonDeployOptions(deploymentAction));
