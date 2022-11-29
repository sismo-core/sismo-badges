import { BigNumberish } from 'ethers';
import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import {
  MockAttestationsRegistry,
  MockAttestationsRegistry__factory,
  MockGatedERC721,
  MockGatedERC721__factory,
} from '../../../types';
import {
  afterDeployment,
  beforeDeployment,
  buildDeploymentName,
  customDeployContract,
  DeployOptions,
  getDeployer,
  wrapCommonDeployOptions,
} from '../utils';

export interface DeployMockGatedERC721Args {
  badgesAddress: BigNumberish;
  attesterAddress: BigNumberish;
  gatedBadges: BigNumberish[];
  options?: DeployOptions;
}

export interface DeployedMockGatedERC721 {
  mockGatedERC721: MockGatedERC721;
}

const CONTRACT_NAME = 'MockGatedERC721';

async function deploymentAction(
  { badgesAddress, attesterAddress, gatedBadges, options }: DeployMockGatedERC721Args,
  hre: HardhatRuntimeEnvironment
) {
  const deployer = await getDeployer(hre);
  const deploymentName = buildDeploymentName(CONTRACT_NAME, options?.deploymentNamePrefix);
  const deploymentArgs = [badgesAddress, attesterAddress, gatedBadges];

  await beforeDeployment(hre, deployer, CONTRACT_NAME, deploymentArgs, options);

  console.log(deployer, deploymentName, CONTRACT_NAME, deploymentArgs, options);

  const deployed = await customDeployContract(
    hre,
    deployer,
    deploymentName,
    CONTRACT_NAME,
    deploymentArgs,
    (options = {
      behindProxy: false,
    })
  );

  console.log('deployed', deployed);

  await afterDeployment(hre, deployer, CONTRACT_NAME, deploymentArgs, deployed, options);
  const mockGatedERC721 = MockGatedERC721__factory.connect(deployed.address, deployer);
  return { mockGatedERC721 };
}

task('deploy-mock-gated-erc-721').setAction(wrapCommonDeployOptions(deploymentAction));
