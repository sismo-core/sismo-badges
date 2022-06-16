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

import { AvailableRootsRegistry, AvailableRootsRegistry__factory } from '../../../../types';

export interface DeployAvailableRootsRegistry {
  // owner of the contract
  owner?: string;
  options?: DeployOptions;
}

export interface DeployedAvailableRootsRegistry {
  availableRootsRegistry: AvailableRootsRegistry;
}

const CONTRACT_NAME = 'AvailableRootsRegistry';

async function deploymentAction(
  { owner, options }: DeployAvailableRootsRegistry,
  hre: HardhatRuntimeEnvironment
): Promise<DeployedAvailableRootsRegistry> {
  const deployer = await getDeployer(hre);
  const deploymentName = buildDeploymentName(CONTRACT_NAME, options?.deploymentNamePrefix);
  const deploymentArgs = [owner || deployer.address];

  await beforeDeployment(hre, deployer, CONTRACT_NAME, deploymentArgs, options);

  const initData = new AvailableRootsRegistry__factory().interface.encodeFunctionData(
    'initialize',
    deploymentArgs
  );

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

  const availableRootsRegistry = AvailableRootsRegistry__factory.connect(
    deployed.address,
    deployer
  );
  return { availableRootsRegistry };
}

task('deploy-available-roots-registry')
  .addOptionalParam('owner', 'Admin of the attester register role. default to deployer')
  .setAction(wrapCommonDeployOptions(deploymentAction));
