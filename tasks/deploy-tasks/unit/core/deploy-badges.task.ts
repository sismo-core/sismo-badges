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
import { Badges, Badges__factory } from '../../../../types';

export interface DeployBadgesArgs {
  // owner of the contract
  uri?: string;
  owner?: string;
  // attester register role
  options?: DeployOptions;
}

export interface DeployedBadges {
  badges: Badges;
}

const CONTRACT_NAME = 'Badges';

async function deploymentAction(
  { uri = '', owner, options }: DeployBadgesArgs,
  hre: HardhatRuntimeEnvironment
): Promise<DeployedBadges> {
  const deployer = await getDeployer(hre);
  const deploymentName = buildDeploymentName(CONTRACT_NAME, options?.deploymentNamePrefix);
  const deploymentArgs = [uri, owner || deployer.address];

  await beforeDeployment(hre, deployer, CONTRACT_NAME, deploymentArgs, options);

  const initData = new Badges__factory(deployer).interface.encodeFunctionData('initialize', [
    uri,
    owner || deployer.address,
  ]);

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

  const badges = Badges__factory.connect(deployed.address, deployer);
  return { badges };
}

task('deploy-badges')
  .addOptionalParam('uri', 'uri')
  .addOptionalParam('owner', 'owner')
  .setAction(wrapCommonDeployOptions(deploymentAction));
