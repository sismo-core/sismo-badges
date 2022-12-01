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
import { AttestationsRegistry, AttestationsRegistry__factory } from '../../../../types';

export interface DeployAttestationsRegistryArgs {
  // owner of the contract
  owner?: string;
  badges: string;
  // attester register role
  attesterRegister?: string;
  options?: DeployOptions;
}

export interface DeployedAttestationsRegistry {
  attestationsRegistry: AttestationsRegistry;
}

const CONTRACT_NAME = 'AttestationsRegistry';

async function deploymentAction(
  { owner, badges, options }: DeployAttestationsRegistryArgs,
  hre: HardhatRuntimeEnvironment
): Promise<DeployedAttestationsRegistry> {
  const deployer = await getDeployer(hre);
  const deploymentName = buildDeploymentName(CONTRACT_NAME, options?.deploymentNamePrefix);
  const deploymentArgs = [
    owner || deployer.address,
    options?.implementationVersion || 1,
    badges || deployer.address,
  ];

  await beforeDeployment(hre, deployer, CONTRACT_NAME, deploymentArgs, options);

  const initData = new AttestationsRegistry__factory(deployer).interface.encodeFunctionData(
    'initialize',
    [owner || deployer.address]
  );

  const deployed = await customDeployContract(
    hre,
    deployer,
    deploymentName,
    CONTRACT_NAME,
    deploymentArgs,
    { ...options, proxyData: initData }
  );

  await afterDeployment(hre, deployer, CONTRACT_NAME, deploymentArgs, deployed, options);

  const attestationsRegistry = AttestationsRegistry__factory.connect(deployed.address, deployer);
  return { attestationsRegistry };
}

task('deploy-attestations-registry')
  .addOptionalParam('owner', 'Admin of the attester register role. default to deployer')
  .addOptionalParam('badges', 'Address of the badges contract')
  .setAction(wrapCommonDeployOptions(deploymentAction));
