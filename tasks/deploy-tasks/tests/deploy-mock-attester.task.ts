import { BigNumber, BigNumberish } from 'ethers';
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
import { MockAttester, MockAttester__factory } from '../../../types';

export interface DeployMockAttesterArgs {
  // address of the attestations Registry contract
  attestationsRegistryAddress: string;
  collectionIdFirst: BigNumberish;
  collectionIdLast: BigNumberish;
  options?: DeployOptions;
}

export interface DeployedMockAttester {
  mockAttester: MockAttester;
}

const CONTRACT_NAME = 'MockAttester';

async function deploymentAction(
  {
    attestationsRegistryAddress,
    collectionIdFirst,
    collectionIdLast,
    options,
  }: DeployMockAttesterArgs,
  hre: HardhatRuntimeEnvironment
): Promise<DeployedMockAttester> {
  const deployer = await getDeployer(hre);

  const deploymentName = buildDeploymentName(CONTRACT_NAME, options?.deploymentNamePrefix);

  const deploymentArgs = [
    attestationsRegistryAddress,
    BigNumber.from(collectionIdFirst),
    BigNumber.from(collectionIdLast),
  ];

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
  const mockAttester = MockAttester__factory.connect(deployed.address, deployer);
  return { mockAttester };
}

task('deploy-mock-attester')
  .addParam('attestationsRegistryAddress', 'Address of the attestations contract')
  .addOptionalParam('collectionIdFirst', '')
  .addOptionalParam('collectionIdLast', '')
  .setAction(wrapCommonDeployOptions(deploymentAction));
