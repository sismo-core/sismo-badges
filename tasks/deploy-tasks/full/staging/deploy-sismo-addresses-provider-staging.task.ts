import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import {
  afterDeployment,
  beforeDeployment,
  buildDeploymentName,
  customDeployContract,
  DeployOptions,
  getDeployer,
} from '../../utils';
import { deploymentsConfig } from '../../deployments-config';
import { AddressesProvider__factory } from '../../../../types';

const CONTRACT_NAME = 'AddressesProvider';

async function deploymentAction(
  { options }: { options: DeployOptions },
  hre: HardhatRuntimeEnvironment
) {
  const config = deploymentsConfig[hre.network.name];
  options = { ...config.deployOptions, ...options };

  const deployer = await getDeployer(hre);
  const deploymentName = 'AddressesProviderStaging';

  // always start by giving the ownership of the deployer
  const deploymentArgs = [
    config.badges.address, // badges,
    config.attestationsRegistry.address, // attestationsRegistry,
    config.front.address, // front,
    config.hydraS1AccountboundAttester.address, // hydraS1AccountboundAttester,
    config.availableRootsRegistry.address, // availableRootsRegistry,
    config.commitmentMapper.address, // commitmentMapperRegistry,
    config.hydraS1Verifier.address, // hydraS1Verifier,
    config.sismoAddressesProvider.owner, // deployer.address,
  ];

  await beforeDeployment(hre, deployer, CONTRACT_NAME, deploymentArgs, options);

  const initData = new AddressesProvider__factory().interface.encodeFunctionData('initialize', [
    config.sismoAddressesProvider.owner,
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

  if (options.manualConfirm || options.log) {
    console.log(`
    ************************************************************
    *                           RECAP                          *
    ************************************************************

    date: ${new Date().toISOString()}

    ** Common **
      proxyAdmin: ${config.deployOptions.proxyAdmin}

    * AddressesProviderStaging:
      -> address: ${(await hre.deployments.all()).AddressesProviderStaging.address}
  `);
  }
}

task('deploy-sismo-addresses-provider-staging').setAction(deploymentAction);
