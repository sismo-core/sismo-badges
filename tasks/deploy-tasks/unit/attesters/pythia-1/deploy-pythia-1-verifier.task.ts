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
} from '../../../utils';
import { Pythia1Verifier, Pythia1Verifier__factory } from '../../../../../types';

export interface DeployPythia1Verifier {
  options?: DeployOptions;
}

export interface DeployedPythia1Verifier {
  pythia1Verifier: Pythia1Verifier;
}

const CONTRACT_NAME = 'Pythia1Verifier';

async function deploymentAction(
  { options }: DeployPythia1Verifier,
  hre: HardhatRuntimeEnvironment
): Promise<DeployedPythia1Verifier> {
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

  const pythia1Verifier = Pythia1Verifier__factory.connect(deployed.address, deployer);
  return { pythia1Verifier };
}

task('deploy-pythia-1-verifier').setAction(wrapCommonDeployOptions(deploymentAction));
