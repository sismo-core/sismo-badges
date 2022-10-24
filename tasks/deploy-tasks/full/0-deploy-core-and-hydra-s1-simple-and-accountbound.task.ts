import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import {
  DeployHydraS1SimpleAttesterArgs,
  DeployedHydraS1SimpleAttester,
} from '../unit/attesters/hydra-s1/deploy-hydra-s1-simple-attester.task';
import {
  DeployCommitmentMapperArgs,
  DeployedCommitmentMapper,
} from '../unit/periphery/deploy-commitment-mapper-registry.task';
import {
  DeployedAvailableRootsRegistry,
  DeployAvailableRootsRegistry,
} from '../unit/periphery/deploy-available-roots-registry.task';
import {
  DeployHydraS1AccountboundAttesterArgs,
  DeployedHydraS1AccountboundAttester,
} from 'tasks/deploy-tasks/unit/attesters/hydra-s1/variants/deploy-hydra-s1-accountbound-attester.task';
import { DeployOptions, getDeployer } from '../utils';
import { DeployCoreArgs, DeployedCore } from '../batch/deploy-core.task';
import { deploymentsConfig } from '../deployments-config';
import { getCommonOptions } from '../../utils/common-options';
import { OwnableTransferOwnershipArgs } from '../../helpers/authorizations/ownable-transfer-ownership.task';
import { AuthorizeRangeArgs } from '../../helpers/authorizations/attestations-registry-authorize-range.task';
import { AccessControlGrantRoleArgs } from '../../helpers/authorizations/access-control-grant-role.task';
import {
  AttestationsRegistry,
  AvailableRootsRegistry,
  Badges,
  CommitmentMapperRegistry,
  Front,
  HydraS1SimpleAttester,
  HydraS1AccountboundAttester,
  HydraS1Verifier,
} from 'types';

export interface Deployed0 {
  attestationsRegistry: AttestationsRegistry;
  badges: Badges;
  front: Front;
  commitmentMapperRegistry: CommitmentMapperRegistry;
  availableRootsRegistry: AvailableRootsRegistry;
  hydraS1SimpleAttester: HydraS1SimpleAttester;
  hydraS1AccountboundAttester: HydraS1AccountboundAttester;
  hydraS1Verifier: HydraS1Verifier;
}

async function deploymentAction(
  { options }: { options: DeployOptions },
  hre: HardhatRuntimeEnvironment
): Promise<Deployed0> {
  const deployer = await getDeployer(hre);
  const config = deploymentsConfig[hre.network.name];
  options = { ...config.deployOptions, ...options };
  if (options.manualConfirm || options.log) {
    console.log('0-deploy-core-and-hydra-s1-simple-and-accountbound: ', hre.network.name);
  }
  // Only deploy contracts without giving final ownership.
  // Owners of the different contract are the deployer
  const { attestationsRegistry, badges, front } = (await hre.run('deploy-core', {
    uri: config.badges.uri,
    frontFirstCollectionId: config.front.collectionIdFirst,
    frontLastCollectionId: config.front.collectionIdLast,
    registryOwner: deployer.address,
    badgeOwner: deployer.address,
    options,
  } as DeployCoreArgs)) as DeployedCore;

  const { availableRootsRegistry } = (await hre.run('deploy-available-roots-registry', {
    options,
  })) as DeployAvailableRootsRegistry as DeployedAvailableRootsRegistry;

  const { commitmentMapperRegistry } = (await hre.run('deploy-commitment-mapper-registry', {
    commitmentMapperPubKeyX: config.commitmentMapper.EdDSAPubKeyX,
    commitmentMapperPubKeyY: config.commitmentMapper.EdDSAPubKeyY,
    options,
  } as DeployCommitmentMapperArgs)) as DeployedCommitmentMapper;

  const hydraS1SimpleArgs: DeployHydraS1SimpleAttesterArgs = {
    collectionIdFirst: config.hydraS1SimpleAttester.collectionIdFirst,
    collectionIdLast: config.hydraS1SimpleAttester.collectionIdLast,
    commitmentMapperRegistryAddress: commitmentMapperRegistry.address,
    availableRootsRegistryAddress: availableRootsRegistry.address,
    attestationsRegistryAddress: attestationsRegistry.address,
    options,
  };

  const { hydraS1SimpleAttester, hydraS1Verifier } = (await hre.run(
    'deploy-hydra-s1-simple-attester',
    hydraS1SimpleArgs
  )) as DeployedHydraS1SimpleAttester;

  const accountboundArgs: DeployHydraS1AccountboundAttesterArgs = {
    collectionIdFirst: config.hydraS1AccountboundAttester.collectionIdFirst,
    collectionIdLast: config.hydraS1AccountboundAttester.collectionIdLast,
    commitmentMapperRegistryAddress: commitmentMapperRegistry.address,
    availableRootsRegistryAddress: availableRootsRegistry.address,
    attestationsRegistryAddress: attestationsRegistry.address,
    options,
  };

  const { hydraS1AccountboundAttester } = (await hre.run(
    'deploy-hydra-s1-accountbound-attester',
    accountboundArgs
  )) as DeployedHydraS1AccountboundAttester;

  // Register an initial root for attester
  if (options.manualConfirm || options.log) {
    console.log(`
    ----------------------------------------------------------------
    * Register initial root for hydraS1SimpleAttester attester`);
  }
  await hre.run('register-for-attester', {
    availableRootsRegistryAddress: availableRootsRegistry.address,
    attester: hydraS1SimpleAttester.address,
    root: config.hydraS1SimpleAttester.initialRoot,
    options: getCommonOptions(options),
  });
  if (options.manualConfirm || options.log) {
    console.log(`
    ----------------------------------------------------------------
    * Register initial root for hydraS1AccountboundAttester attester`);
  }
  await hre.run('register-for-attester', {
    availableRootsRegistryAddress: availableRootsRegistry.address,
    attester: hydraS1AccountboundAttester.address,
    root: config.hydraS1AccountboundAttester.initialRoot,
    options: getCommonOptions(options),
  });

  // Give to the attester the authorization to write on the attestations Registry
  if (options.manualConfirm || options.log) {
    console.log(`
    ----------------------------------------------------------------
    * Authorize HydraS1SimpleAttester to record on the AttestationsRegistry`);
  }
  await hre.run('attestations-registry-authorize-range', {
    attestationsRegistryAddress: attestationsRegistry.address,
    attesterAddress: hydraS1SimpleAttester.address,
    collectionIdFirst: config.hydraS1SimpleAttester.collectionIdFirst,
    collectionIdLast: config.hydraS1SimpleAttester.collectionIdLast,
    options: getCommonOptions(options),
  } as AuthorizeRangeArgs);

  if (options.manualConfirm || options.log) {
    console.log(`
    ----------------------------------------------------------------
    * Authorize HydraS1AccountboundAttester to record on the AttestationsRegistry`);
  }
  await hre.run('attestations-registry-authorize-range', {
    attestationsRegistryAddress: attestationsRegistry.address,
    attesterAddress: hydraS1AccountboundAttester.address,
    collectionIdFirst: config.hydraS1AccountboundAttester.collectionIdFirst,
    collectionIdLast: config.hydraS1AccountboundAttester.collectionIdLast,
    options: getCommonOptions(options),
  } as AuthorizeRangeArgs);

  // ----------  SET FINAL OWNERSHIP -------------
  if (options.manualConfirm || options.log) {
    console.log(`
    ----------------------------------------------------------------
    * Transfer AttestationsRegistry ownership`);
  }
  await hre.run('ownable-transfer-ownership', {
    contractAddress: attestationsRegistry.address,
    newOwner: config.attestationsRegistry.owner,
    options: getCommonOptions(options),
  } as OwnableTransferOwnershipArgs);

  // Move commitmentMapper ownership
  if (options.manualConfirm || options.log) {
    console.log(`
    ----------------------------------------------------------------
    * Transfer CommitmentMapperRegistry ownership`);
  }
  await hre.run('ownable-transfer-ownership', {
    contractAddress: commitmentMapperRegistry.address,
    newOwner: config.commitmentMapper.owner,
    options: getCommonOptions(options),
  } as OwnableTransferOwnershipArgs);

  // Move AvailableRootsRegistry ownership
  if (options.manualConfirm || options.log) {
    console.log(`
    ----------------------------------------------------------------
    * Transfer AvailableRootsRegistry ownership`);
  }
  await hre.run('ownable-transfer-ownership', {
    contractAddress: availableRootsRegistry.address,
    newOwner: config.availableRootsRegistry.owner,
    options: getCommonOptions(options),
  } as OwnableTransferOwnershipArgs);

  // Move admin ownership of the access control contract to the "owner".
  if (options.manualConfirm || options.log) {
    console.log(`
    ----------------------------------------------------------------
    * Granting role DEFAULT_ADMIN_ROLE of Badges to the Badges contract owner`);
  }
  await hre.run('access-control-grant-role', {
    contractAddress: badges.address,
    role: await badges.DEFAULT_ADMIN_ROLE(),
    accountAddress: config.badges.owner,
    options: getCommonOptions(options),
  } as AccessControlGrantRoleArgs);
  if (options.manualConfirm || options.log) {
    console.log(`
    ----------------------------------------------------------------
    * Revoking role DEFAULT_ADMIN_ROLE of the deployer to the Badges contract`);
  }
  await hre.run('access-control-revoke-role', {
    contractAddress: badges.address,
    role: await badges.DEFAULT_ADMIN_ROLE(),
    accountAddress: deployer.address,
    options: getCommonOptions(options),
  } as AccessControlGrantRoleArgs);

  if (options.manualConfirm || options.log) {
    console.log(`
    ************************************************************
    *                           RECAP                          *
    ************************************************************

    date: ${new Date().toISOString()}

    ** Common **
      proxyAdmin: ${config.deployOptions.proxyAdmin}

    * Front
      -> proxy: ${(await hre.deployments.all()).Front.address}
      -> implem: ${(await hre.deployments.all()).FrontImplem.address}

    * AttestationsRegistry
      -> proxy: ${(await hre.deployments.all()).AttestationsRegistry.address}
      -> implem: ${(await hre.deployments.all()).AttestationsRegistryImplem.address}
      owner: ${config.attestationsRegistry.owner}
    
    * Badges
      -> proxy: ${(await hre.deployments.all()).Badges.address}
      -> implem: ${(await hre.deployments.all()).BadgesImplem.address}
      uri: ${config.badges.uri}

    * HydraS1SimpleAttester:
      -> proxy: ${(await hre.deployments.all()).HydraS1SimpleAttester.address}
      -> implem: ${(await hre.deployments.all()).HydraS1SimpleAttesterImplem.address}
      collectionIdFirst: ${config.hydraS1SimpleAttester.collectionIdFirst}
      collectionIdLast: ${config.hydraS1SimpleAttester.collectionIdLast}

    * HydraS1Verifier:
      -> address: ${(await hre.deployments.all()).HydraS1Verifier.address}

    * HydraS1AccountboundAttester:
      -> proxy: ${(await hre.deployments.all()).HydraS1AccountboundAttester.address}
      -> implem: ${(await hre.deployments.all()).HydraS1AccountboundAttesterImplem.address}
      collectionIdFirst: ${config.hydraS1AccountboundAttester.collectionIdFirst}
      collectionIdLast: ${config.hydraS1AccountboundAttester.collectionIdLast}
    
    * AvailableRootsRegistry: 
      -> proxy: ${(await hre.deployments.all()).AvailableRootsRegistry.address}
      -> implem: ${(await hre.deployments.all()).AvailableRootsRegistryImplem.address}
      owner: ${config.availableRootsRegistry.owner}
    
    * CommitmentMapperRegistry: 
      -> proxy: ${(await hre.deployments.all()).CommitmentMapperRegistry.address}
      -> implem: ${(await hre.deployments.all()).CommitmentMapperRegistryImplem.address}
      owner: ${config.commitmentMapper.owner}

  `);
  }

  return {
    hydraS1SimpleAttester,
    hydraS1AccountboundAttester,
    availableRootsRegistry,
    commitmentMapperRegistry,
    front,
    badges,
    attestationsRegistry,
    hydraS1Verifier,
  };
}

task('0-deploy-core-and-hydra-s1-simple-and-accountbound').setAction(deploymentAction);
