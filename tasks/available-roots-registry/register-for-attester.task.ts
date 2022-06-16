import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getDeployer } from '../deploy-tasks/utils';
import { DefenderRelaySigner, DefenderRelayProvider } from 'defender-relay-client/lib/ethers';

import { AvailableRootsRegistry, AvailableRootsRegistry__factory } from '../../types';
import { BigNumber, Signer } from 'ethers';

let { RELAYER_API_KEY, RELAYER_API_SECRET } = process.env;

async function deploymentAction(
  { root, attester, relayed, log, availableRootsRegistryAddress, deploymentNamePrefix },
  hre: HardhatRuntimeEnvironment
): Promise<void> {
  let signer = (await getDeployer(hre)) as Signer;
  if (relayed) {
    if (RELAYER_API_KEY && RELAYER_API_SECRET) {
      const credentials = { apiKey: RELAYER_API_KEY, apiSecret: RELAYER_API_SECRET };
      const provider = new DefenderRelayProvider(credentials);
      signer = new DefenderRelaySigner(credentials, provider, { speed: 'fast' });
    } else throw new Error('RELAYER_API_KEY or RELAYER_API_SECRET env variables missing');
  }
  const availableRootsRegistry = AvailableRootsRegistry__factory.connect(
    availableRootsRegistryAddress ||
      (await hre.deployments.get(deploymentNamePrefix + 'AvailableRootsRegistry')).address,
    signer
  ) as AvailableRootsRegistry;
  await availableRootsRegistry.registerRootForAttester(attester, BigNumber.from(root));
  log &&
    console.log(`
  Added new root to registry: ${availableRootsRegistry.address}
  Root: ${root}
  `);
}

task('register-for-attester')
  .addOptionalParam('owner', 'Admin of the roots registry ')
  .addOptionalParam('attester', 'Register for this Attester')
  .addOptionalParam('availableRootsRegistryAddress', 'Root to update')
  .addOptionalParam('root', 'Root to update')
  .addFlag('relayer', 'to user with relayer?')
  .setAction(deploymentAction);
