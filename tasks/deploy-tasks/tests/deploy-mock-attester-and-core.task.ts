import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import {
  DeployOptions,
  getDeployer,
  wrapCommonDeployOptions,
} from '../../../tasks/deploy-tasks/utils';
import { DeployCoreArgs, DeployedCore } from '../batch/deploy-core.task';
import { DeployedMockAttester, DeployMockAttesterArgs } from './deploy-mock-attester.task';

export type DeployMockAttesterAndCoreArgs = Omit<
  DeployMockAttesterArgs & DeployCoreArgs & DeployOptions,
  'attestationsRegistryAddress' | ''
>;

export interface DeployedMockAttesterAndCore extends DeployedMockAttester, DeployedCore {}

async function deploymentAction(
  options: DeployMockAttesterAndCoreArgs,
  hre: HardhatRuntimeEnvironment
): Promise<DeployedMockAttesterAndCore> {
  if (options?.log) {
    console.log('Deploying ALL on network: ', hre.network.name);
  }

  const deployer = await getDeployer(hre);

  const deployedCore = (await hre.run('deploy-core', {
    uri: options.uri,
    badgeOwner: options.badgeOwner,
    registryOwner: options.registryOwner,
    frontFirstCollectionId: options.frontLastCollectionId,
    frontLastCollectionId: options.frontLastCollectionId,
    options: options.options,
  } as DeployCoreArgs)) as DeployedCore;

  const deployedMockAttester = (await hre.run('deploy-mock-attester', {
    attestationsRegistryAddress: deployedCore.attestationsRegistry.address,
    collectionIdFirst: options.collectionIdFirst,
    collectionIdLast: options.collectionIdLast,
    options: options.options,
  } as DeployMockAttesterArgs)) as DeployedMockAttester;

  // Authorize Mock attester to record attestation on the attestationsRegistry
  // for its corresponding min and max
  if (options?.log) {
    console.log('Authorize Mock on the attestationsRegistry');
  }

  await deployedCore.attestationsRegistry
    .connect(deployer)
    .authorizeRange(
      deployedCore.front.address,
      await deployedCore.front.EARLY_USER_COLLECTION(),
      await deployedCore.front.EARLY_USER_COLLECTION()
    );

  await deployedCore.attestationsRegistry
    .connect(deployer)
    .authorizeRange(
      deployedMockAttester.mockAttester.address,
      await deployedMockAttester.mockAttester.ATTESTATION_ID_MIN(),
      await deployedMockAttester.mockAttester.ATTESTATION_ID_MAX()
    );

  return { ...deployedCore, ...deployedMockAttester };
}

task('deploy-mock-attester-and-core').setAction(wrapCommonDeployOptions(deploymentAction));
