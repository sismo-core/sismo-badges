import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import {
  afterDeployment,
  beforeDeployment,
  buildDeploymentName,
  customDeployContract,
  DeployOptions,
  getDeployer,
} from '../utils';
import { deploymentsConfig } from '../deployments-config';
import { AddressesProvider, AddressesProvider__factory } from '../../../types';

export interface Deployed9 {
  sismoAddressesProvider: AddressesProvider;
}

async function deploymentAction(
  { options }: { options: DeployOptions },
  hre: HardhatRuntimeEnvironment
): Promise<Deployed9> {
  const config = deploymentsConfig[process.env.FORK_NETWORK ?? hre.network.name];
  options = { ...config.deployOptions, ...options };

  if (options.manualConfirm || options.log) {
    console.log('9-upgrade-addresses-provider-on-testnets: ', hre.network.name);
  }
  const CONTRACT_NAME = 'AddressesProvider';

  // Deploy SismoAddressesProvider
  const deployer = await getDeployer(hre);
  const deploymentName = buildDeploymentName(CONTRACT_NAME, options?.deploymentNamePrefix);

  const deploymentArgs = [
    config.badges.address,
    config.attestationsRegistry.address,
    config.front.address,
    config.hydraS1AccountboundAttester.address,
    config.availableRootsRegistry.address,
    config.commitmentMapper.address,
    config.hydraS1Verifier.address,
    deployer.address,
  ];

  const initData = new AddressesProvider__factory().interface.encodeFunctionData('initialize', [
    deployer.address,
  ]);

  await beforeDeployment(hre, deployer, CONTRACT_NAME, deploymentArgs, options);
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

  const sismoAddressesProvider = AddressesProvider__factory.connect(deployed.address, deployer);

  return {
    sismoAddressesProvider,
  };
}

task('9-upgrade-addresses-provider-on-testnets').setAction(deploymentAction);
