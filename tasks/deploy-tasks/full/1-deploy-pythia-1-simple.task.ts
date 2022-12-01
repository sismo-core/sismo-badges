import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployOptions, getDeployer } from '../utils';
import { deploymentsConfig } from '../deployments-config';
import { getCommonOptions } from '../../utils/common-options';
import { AuthorizeRangeArgs } from '../../helpers/authorizations/attestations-registry-authorize-range.task';
import { Pythia1SimpleAttester } from 'types';
import {
  DeployedPythia1SimpleAttester,
  DeployPythia1SimpleAttesterArgs,
} from 'tasks/deploy-tasks/unit/attesters/pythia-1/deploy-pythia-1-simple-attester.task';
import { Pythia1Verifier } from '@sismo-core/pythia-1';

export interface Deployed1 {
  pythia1SimpleAttester: Pythia1SimpleAttester;
  pythia1Verifier: Pythia1Verifier;
}

async function deploymentAction(
  { options }: { options: DeployOptions },
  hre: HardhatRuntimeEnvironment
): Promise<Deployed1> {
  const deployer = await getDeployer(hre);
  const config = deploymentsConfig[hre.network.name];
  options = { ...config.deployOptions, ...options };
  if (options.manualConfirm || options.log) {
    console.log('1-deploy-pythia-1-simple: ', hre.network.name);
  }

  const attestationsRegistry = await hre.deployments.get('AttestationsRegistry');
  // Only deploy contracts without giving final ownership.
  // Owners of the different contract are the deployer
  const pythia1SimpleAttesterArgs: DeployPythia1SimpleAttesterArgs = {
    collectionIdFirst: config.synapsPythia1SimpleAttester.collectionIdFirst,
    collectionIdLast: config.synapsPythia1SimpleAttester.collectionIdLast,
    attestationsRegistryAddress: attestationsRegistry.address,
    commitmentSignerPubKeyX: config.synapsPythia1SimpleAttester.commitmentSignerPubKeyX,
    commitmentSignerPubKeyY: config.synapsPythia1SimpleAttester.commitmentSignerPubKeyY,
    owner: config.synapsPythia1SimpleAttester.owner,
    options,
  };

  const { pythia1SimpleAttester, pythia1Verifier } = (await hre.run(
    'deploy-pythia-1-simple-attester',
    pythia1SimpleAttesterArgs
  )) as DeployedPythia1SimpleAttester;

  // Give to the attester the authorization to write on the attestations Registry
  if (options.manualConfirm || options.log) {
    console.log(`
    ----------------------------------------------------------------
    * Authorize Pythia1SimpleAttester to record on the AttestationsRegistry`);
  }
  await hre.run('attestations-registry-authorize-range', {
    attestationsRegistryAddress: attestationsRegistry.address,
    attesterAddress: pythia1SimpleAttester.address,
    collectionIdFirst: config.synapsPythia1SimpleAttester.collectionIdFirst,
    collectionIdLast: config.synapsPythia1SimpleAttester.collectionIdLast,
    options: getCommonOptions(options),
  } as AuthorizeRangeArgs);

  if (options.manualConfirm || options.log) {
    console.log(`
    ************************************************************
    *                           RECAP                          *
    ************************************************************

    date: ${new Date().toISOString()}

    ** Common **
      proxyAdmin: ${config.deployOptions.proxyAdmin}

    * Pythia1SimpleAttester:
      -> proxy: ${(await hre.deployments.all()).Pythia1SimpleAttester.address}
      -> implem: ${(await hre.deployments.all()).Pythia1SimpleAttesterImplem.address}
      collectionIdFirst: ${config.synapsPythia1SimpleAttester.collectionIdFirst}
      collectionIdLast: ${config.synapsPythia1SimpleAttester.collectionIdLast}
      commitmentSignerPubKeyX: ${config.synapsPythia1SimpleAttester.commitmentSignerPubKeyX}
      commitmentSignerPubKeyY: ${config.synapsPythia1SimpleAttester.commitmentSignerPubKeyY}

    * Pythia1Verifier:
      -> address: ${(await hre.deployments.all()).Pythia1Verifier.address}
  `);
  }

  return {
    pythia1SimpleAttester,
    pythia1Verifier,
  };
}

task('1-deploy-pythia-1-simple').setAction(deploymentAction);
