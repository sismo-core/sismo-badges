import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { AttestationsRegistry, Badges, Front } from '../../../types';
import {
  DeployedAttestationsRegistry,
  DeployAttestationsRegistryArgs,
} from '../unit/core/deploy-attestations-registry.task';
import { DeployBadgesArgs, DeployedBadges } from '../unit/core/deploy-badges.task';
import { DeployOptions, wrapCommonDeployOptions } from '../utils';
import { DeployedFront, DeployFrontArgs } from '../unit/core/deploy-front.task';
import { AuthorizeRangeArgs } from 'tasks/helpers/authorizations/attestations-registry-authorize-range.task';
import { AccessControlGrantRoleArgs } from 'tasks/helpers/authorizations/access-control-grant-role.task';

export interface DeployedCore {
  attestationsRegistry: AttestationsRegistry;
  badges: Badges;
  front: Front;
}

export interface DeployCoreArgs {
  uri?: string;
  registryOwner?: string;
  badgeOwner?: string;
  frontFirstCollectionId: string;
  frontLastCollectionId: string;
  options?: DeployOptions;
}

async function deploymentAction(
  {
    uri,
    registryOwner,
    badgeOwner,
    frontFirstCollectionId,
    frontLastCollectionId,
    options,
  }: DeployCoreArgs,
  hre: HardhatRuntimeEnvironment
): Promise<DeployedCore> {
  if (options?.log) console.log('Deploying Core Contracts');

  // Deployed ERC1155 Default Badge
  const { badges } = (await hre.run('deploy-badges', {
    uri,
    owner: badgeOwner,
    options,
  } as DeployBadgesArgs)) as DeployedBadges;

  // Deploy main contract Attestation Registry
  const { attestationsRegistry } = (await hre.run('deploy-attestations-registry', {
    owner: registryOwner,
    badges: badges.address,
    options,
  } as DeployAttestationsRegistryArgs)) as DeployedAttestationsRegistry;

  const registeredAttestationsRegistryInBadges = await badges.getAttestationsRegistry();
  if (registeredAttestationsRegistryInBadges != attestationsRegistry.address) {
    await (await badges.setAttestationsRegistry(attestationsRegistry.address)).wait();
  }

  const { front } = (await hre.run('deploy-front', {
    attestationsRegistryAddress: attestationsRegistry.address,
    badges: badges.address,
    options,
  } as DeployFrontArgs)) as DeployedFront;

  await hre.run('attestations-registry-authorize-range', {
    attestationsRegistryAddress: attestationsRegistry.address,
    attesterAddress: front.address,
    collectionIdFirst: frontFirstCollectionId,
    collectionIdLast: frontLastCollectionId,
    options,
  } as AuthorizeRangeArgs);

  await hre.run('access-control-grant-role', {
    contractAddress: badges.address,
    role: await badges.EVENT_TRIGGERER_ROLE(),
    accountAddress: attestationsRegistry.address,
    options,
  } as AccessControlGrantRoleArgs);

  if (options?.log) {
    console.log(`
      Deployed core contracts of the sismo protocol: 
      attestationsRegistry: ${attestationsRegistry.address} 
      badges: ${badges.address} 
      front: ${front.address}
    `);
  }
  return { attestationsRegistry, badges, front };
}

task('deploy-core')
  .addOptionalParam('uri', 'uri for the badges')
  .addOptionalParam('registryOwner', 'owner of the contracts')
  .addOptionalParam('badgeOwner', 'owner of the contracts')
  .addOptionalParam('frontFirstCollectionId', 'owner of the contracts')
  .addOptionalParam('frontLastCollectionId', 'owner of the contracts')
  .setAction(wrapCommonDeployOptions(deploymentAction));
