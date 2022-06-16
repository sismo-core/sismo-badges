import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import {
  DeployOptions,
  getDeployer,
  wrapCommonDeployOptions,
} from '../../../tasks/deploy-tasks/utils';
import { DeployedMockAttester, DeployMockAttesterArgs } from './deploy-mock-attester.task';
import { DeployCoreArgs, DeployedCore } from '../batch/deploy-core.task';
import { deploymentsConfig } from '../../../tasks/deploy-tasks/deployments-config';

async function deploymentAction(
  options: DeployOptions,
  hre: HardhatRuntimeEnvironment
): Promise<void> {
  console.log('Deploying ALL on network: ', hre.network.name);

  const deployer = await getDeployer(hre);
  const config = deploymentsConfig[hre.network.name];

  const { attestationsRegistry, badges, front } = (await hre.run('deploy-core', {
    uri: config.badges.uri,
    badgeOwner: config.badges.owner,
    registryOwner: config.attestationsRegistry.owner,
    frontFirstCollectionId: config.front.collectionIdFirst,
    frontLastCollectionId: config.front.collectionIdLast,
    options,
  } as DeployCoreArgs)) as DeployedCore;

  const { mockAttester } = (await hre.run('deploy-mock-attester', {
    attestationsRegistryAddress: attestationsRegistry.address,
    collectionIdFirst: config.hydraS1SoulboundAttester.collectionIdFirst,
    collectionIdLast: config.hydraS1SoulboundAttester.collectionIdLast,
    options,
  } as DeployMockAttesterArgs)) as DeployedMockAttester;

  // Authorize Mock attester to record attestation on the attestationsRegistry
  // for its corresponding min and max
  if (options?.log) {
    console.log('Authorize Mock on the attestationsRegistry');
  }
  await attestationsRegistry
    .connect(deployer)
    .authorizeRange(
      mockAttester.address,
      await mockAttester.ATTESTATION_ID_MIN(),
      await mockAttester.ATTESTATION_ID_MAX()
    );
}

task('deploy-mock-attester-and-core').setAction(wrapCommonDeployOptions(deploymentAction));
