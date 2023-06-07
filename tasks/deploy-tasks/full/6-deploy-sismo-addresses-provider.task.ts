import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployOptions } from '../utils';
import { SISMO_ADDRESSES_PROVIDER_CONTRACT_ADDRESS } from '../deployments-config';
import { DeployedSismoAddressesProvider } from 'tasks/deploy-tasks/unit/core/deploy-sismo-addresses-provider.task';
import { AddressesProvider } from 'types';

export interface Deployed6 {
  sismoAddressesProvider: AddressesProvider;
}

export const addressesProviderConfiguration = {
  deployOptions: {
    manualConfirm: process.env.MANUAL_CONFIRM === 'true',
    log: true,
    behindProxy: true,
    proxyAdmin: process.env.PROXY_ADMIN,
  },
  sismoAddressesProvider: {
    address: SISMO_ADDRESSES_PROVIDER_CONTRACT_ADDRESS,
    owner: process.env.SISMO_ADDRESSES_PROVIDER_OWNER,
  },
};

async function deploymentAction(
  { options }: { options: DeployOptions },
  hre: HardhatRuntimeEnvironment
): Promise<Deployed6> {
  // ZK Badges are deprecated, we only use SismoAddressesProvider for Sismo Connect
  const config = addressesProviderConfiguration;

  options = { ...config.deployOptions, ...options };

  if (options.manualConfirm || options.log) {
    console.log('6-deploy-sismo-addresses-provider: ', hre.network.name);
  }

  // Deploy SismoAddressesProvider
  const { sismoAddressesProvider } = (await hre.run('deploy-sismo-addresses-provider', {
    owner: config.sismoAddressesProvider.owner,
    badges: '0x0000000000000000000000000000000000000000',
    attestationsRegistry: '0x0000000000000000000000000000000000000000',
    front: '0x0000000000000000000000000000000000000000',
    hydraS1AccountboundAttester: '0x0000000000000000000000000000000000000000',
    commitmentMapperRegistry: '0x0000000000000000000000000000000000000000',
    availableRootsRegistry: '0x0000000000000000000000000000000000000000',
    hydraS1Verifier: '0x0000000000000000000000000000000000000000',
    options: { ...options, proxyAdmin: config.deployOptions.proxyAdmin },
  })) as DeployedSismoAddressesProvider;

  return {
    sismoAddressesProvider,
  };
}

task('6-deploy-sismo-addresses-provider').setAction(deploymentAction);
