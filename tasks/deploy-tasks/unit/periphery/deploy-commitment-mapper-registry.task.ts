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

import { CommitmentMapperRegistry, CommitmentMapperRegistry__factory } from '../../../../types';

export interface DeployCommitmentMapperArgs {
  // owner of the contract
  owner?: string;
  commitmentMapperPubKeyX?: string;
  commitmentMapperPubKeyY?: string;
  commitmentMapperAddress?: string;
  options?: DeployOptions;
}

export interface DeployedCommitmentMapper {
  commitmentMapperRegistry: CommitmentMapperRegistry;
}

const CONTRACT_NAME = 'CommitmentMapperRegistry';

async function deploymentAction(
  {
    owner,
    commitmentMapperPubKeyX,
    commitmentMapperPubKeyY,
    commitmentMapperAddress,
    options,
  }: DeployCommitmentMapperArgs,
  hre: HardhatRuntimeEnvironment
): Promise<DeployedCommitmentMapper> {
  const deployer = await getDeployer(hre);
  const deploymentName = buildDeploymentName(CONTRACT_NAME, options?.deploymentNamePrefix);
  const deploymentArgs = [
    owner || deployer.address,
    [commitmentMapperPubKeyX, commitmentMapperPubKeyY],
    commitmentMapperAddress || hre.ethers.constants.AddressZero,
  ];

  await beforeDeployment(hre, deployer, CONTRACT_NAME, deploymentArgs, options);

  const initData = new CommitmentMapperRegistry__factory().interface.encodeFunctionData(
    'initialize',
    [
      owner || deployer.address,
      [commitmentMapperPubKeyX, commitmentMapperPubKeyY],
      commitmentMapperAddress || hre.ethers.constants.AddressZero,
    ]
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

  const commitmentMapperRegistry = CommitmentMapperRegistry__factory.connect(
    deployed.address,
    deployer
  );
  return { commitmentMapperRegistry };
}

task('deploy-commitment-mapper-registry')
  .addOptionalParam('commitmentMapperPubKeyX', 'Eddsa public key coordinate x')
  .addOptionalParam('commitmentMapperPubKeyY', 'Eddsa public key coordinate y')
  .addOptionalParam('commitmentMapperAddress', 'ethereum address of commitment mapper')
  .addOptionalParam('owner', 'Admin of the commitment mapper updater role. default to deployer')
  .setAction(wrapCommonDeployOptions(deploymentAction));
