import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { wrapCommonDeployOptions } from '../../utils/deployment';
import { deploymentsConfig } from '../../../deploy-tasks/deployments-config';
import { DeployOptions } from '../../utils';
import { DeployCoreArgs, DeployedCore } from 'tasks/deploy-tasks/batch/deploy-core.task';
import {
  DeployHydraS1SimpleAttesterArgs,
  DeployedHydraS1SimpleAttester,
} from 'tasks/deploy-tasks/unit/attesters/hydra-s1/deploy-hydra-s1-simple-attester.task';

import {
  DeployHydraS1SoulboundAttesterArgs,
  DeployedHydraS1SoulboundAttester,
} from 'tasks/deploy-tasks/unit/attesters/hydra-s1/variants/deploy-hydra-s1-soulbound-attester.task';
import { EVENT_TRIGGERER_ROLE } from '../../../../utils';
import {
  DeployAvailableRootsRegistry,
  DeployedAvailableRootsRegistry,
} from 'tasks/deploy-tasks/unit/periphery/deploy-available-roots-registry.task';
import {
  DeployCommitmentMapperArgs,
  DeployedCommitmentMapper,
} from 'tasks/deploy-tasks/unit/periphery/deploy-commitment-mapper-registry.task';

async function deploymentAction(
  { options }: { options: DeployOptions },
  hre: HardhatRuntimeEnvironment
): Promise<void> {
  if (hre.network.name != 'local' && hre.network.name != 'hardhat') {
    throw new Error('SCRIPT TO BE USED ON LOCAL NETWORK ONLY');
  }
  const [owner, , , , , , proxyAdmin] = await hre.ethers.getSigners();
  options.proxyAdmin = proxyAdmin.address;

  const config = deploymentsConfig[hre.network.name];

  const { attestationsRegistry, badges, front } = (await hre.run('deploy-core', {
    uri: config.badges.uri,
    badgeOwner: config.badges.owner,
    registryOwner: config.attestationsRegistry.owner,
    frontFirstCollectionId: config.front.collectionIdFirst,
    frontLastCollectionId: config.front.collectionIdLast,
    options,
  } as DeployCoreArgs)) as DeployedCore;

  await (await badges.grantRole(EVENT_TRIGGERER_ROLE, attestationsRegistry.address)).wait();
  // no prefix here
  const { availableRootsRegistry } = (await hre.run('deploy-available-roots-registry', {
    options,
  })) as DeployAvailableRootsRegistry as DeployedAvailableRootsRegistry;
  const { commitmentMapperRegistry } = (await hre.run('deploy-commitment-mapper-registry', {
    commitmentMapperPubKeyX: config.commitmentMapper.EdDSAPubKeyX,
    commitmentMapperPubKeyY: config.commitmentMapper.EdDSAPubKeyY,
    options,
  } as DeployCommitmentMapperArgs)) as DeployedCommitmentMapper;

  const { hydraS1SimpleAttester } = (await hre.run('deploy-hydra-s1-simple-attester', {
    collectionIdFirst: config.hydraS1SimpleAttester.collectionIdFirst,
    collectionIdLast: config.hydraS1SimpleAttester.collectionIdLast,
    commitmentMapperRegistryAddress: commitmentMapperRegistry.address,
    availableRootsRegistryAddress: availableRootsRegistry.address,
    attestationsRegistryAddress: attestationsRegistry.address,
    options,
  } as DeployHydraS1SimpleAttesterArgs)) as DeployedHydraS1SimpleAttester;

  const { hydraS1SoulboundAttester } = (await hre.run('deploy-hydra-s1-soulbound-attester', {
    collectionIdFirst: config.hydraS1SoulboundAttester.collectionIdFirst,
    collectionIdLast: config.hydraS1SoulboundAttester.collectionIdLast,
    commitmentMapperRegistryAddress: commitmentMapperRegistry.address,
    availableRootsRegistryAddress: availableRootsRegistry.address,
    attestationsRegistryAddress: attestationsRegistry.address,
    cooldownDuration: config.hydraS1SoulboundAttester.soulboundCooldownDuration,
    options,
  } as DeployHydraS1SoulboundAttesterArgs)) as DeployedHydraS1SoulboundAttester;

  await hre.run('register-for-attester', {
    availableRootsRegistryAddress: availableRootsRegistry.address,
    attester: hydraS1SimpleAttester.address,
    root: config.hydraS1SimpleAttester.initialRoot,
  });
  await hre.run('register-for-attester', {
    availableRootsRegistryAddress: availableRootsRegistry.address,
    attester: hydraS1SoulboundAttester.address,
    root: config.hydraS1SoulboundAttester.initialRoot,
  });
  options?.log && console.log('Contracts deployed on local');

  await (
    await attestationsRegistry.authorizeRange(
      hydraS1SoulboundAttester.address,
      config.hydraS1SoulboundAttester.collectionIdFirst,
      config.hydraS1SoulboundAttester.collectionIdLast
    )
  ).wait();

  await (
    await attestationsRegistry.authorizeRange(
      hydraS1SimpleAttester.address,
      config.hydraS1SimpleAttester.collectionIdFirst,
      config.hydraS1SimpleAttester.collectionIdLast
    )
  ).wait();
}

task('deploy-full-local').setAction(wrapCommonDeployOptions(deploymentAction));
