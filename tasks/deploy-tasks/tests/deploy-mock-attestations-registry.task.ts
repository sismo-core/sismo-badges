import { BigNumberish } from 'ethers';
import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { MockAttestationsRegistry, MockAttestationsRegistry__factory } from '../../../types';
import {
  afterDeployment,
  beforeDeployment,
  buildDeploymentName,
  customDeployContract,
  DeployOptions,
  getDeployer,
  wrapCommonDeployOptions,
} from '../utils';

export interface DeployMockAttestationsRegistryArgs {
  attestationValue: BigNumberish;
  options?: DeployOptions;
}

export interface DeployedMockAttestationsRegistry {
  mockAttestationsRegistry: MockAttestationsRegistry;
}

const CONTRACT_NAME = 'MockAttestationsRegistry';

async function deploymentAction(
  { attestationValue, options }: DeployMockAttestationsRegistryArgs,
  hre: HardhatRuntimeEnvironment
) {
  const deployer = await getDeployer(hre);
  const deploymentName = buildDeploymentName(CONTRACT_NAME, options?.deploymentNamePrefix);
  const deploymentArgs = [attestationValue || 0];

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
  const mockAttestationsRegistry = MockAttestationsRegistry__factory.connect(
    deployed.address,
    deployer
  );
  return { mockAttestationsRegistry };
}

task('deploy-mock-attestations-registry').setAction(wrapCommonDeployOptions(deploymentAction));
