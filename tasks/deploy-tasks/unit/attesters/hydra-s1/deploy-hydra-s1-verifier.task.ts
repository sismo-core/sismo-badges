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
} from '../../../../../tasks/deploy-tasks/utils';
import { HydraS1Verifier, HydraS1Verifier__factory } from '../../../../../types';

export interface DeployHydraS1Verifier {
  options?: DeployOptions;
}

export interface DeployedHydraS1Verifier {
  hydraS1Verifier: HydraS1Verifier;
}

const CONTRACT_NAME = 'HydraS1Verifier';

async function deploymentAction(
  { options }: DeployHydraS1Verifier,
  hre: HardhatRuntimeEnvironment
): Promise<DeployedHydraS1Verifier> {
  const deployer = await getDeployer(hre);
  const deploymentName = buildDeploymentName(CONTRACT_NAME, options?.deploymentNamePrefix);
  const deploymentArgs = [];

  await beforeDeployment(hre, deployer, CONTRACT_NAME, deploymentArgs, options);

  const deployed = await hre.deployments.deploy(deploymentName, {
    contract: CONTRACT_NAME,
    from: deployer.address,
    args: deploymentArgs,
    skipIfAlreadyDeployed: false,
  });

  await afterDeployment(hre, deployer, CONTRACT_NAME, deploymentArgs, deployed, options);

  const hydraS1Verifier = HydraS1Verifier__factory.connect(deployed.address, deployer);
  return { hydraS1Verifier };
}

task('deploy-hydra-s1-verifier').setAction(wrapCommonDeployOptions(deploymentAction));
