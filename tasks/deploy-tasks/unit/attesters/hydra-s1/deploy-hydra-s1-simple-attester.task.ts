import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import {
  getDeployer,
  beforeDeployment,
  afterDeployment,
  buildDeploymentName,
  customDeployContract,
  wrapCommonDeployOptions,
  DeployOptions,
} from '../../../../../tasks/deploy-tasks/utils';

import {
  HydraS1SimpleAttester,
  HydraS1SimpleAttester__factory,
  HydraS1Verifier,
  HydraS1Verifier__factory,
} from '../../../../../types';
import { BigNumber, BigNumberish } from 'ethers';

export interface DeployHydraS1SimpleAttesterArgs {
  // mandatory parameter that indicates if we want to deploy the hydra S1 simple attester
  enableDeployment: boolean;
  // address of the proving scheme verifier contract
  hydraS1VerifierAddress?: string;
  // address of the registryMerkleRoot contract
  availableRootsRegistryAddress: string;
  // address of the commitment mapper registry
  commitmentMapperRegistryAddress: string;
  // address of the attestations contract,
  // which is part of the SAS
  // Sismo Attestation State
  attestationsRegistryAddress: string;
  collectionIdFirst: BigNumberish;
  collectionIdLast: BigNumberish;
  options?: DeployOptions;
}

export interface DeployedHydraS1SimpleAttester {
  hydraS1SimpleAttester?: HydraS1SimpleAttester;
  hydraS1Verifier: HydraS1Verifier;
}

const CONTRACT_NAME = 'HydraS1SimpleAttester';

async function deploymentAction(
  {
    enableDeployment,
    hydraS1VerifierAddress,
    availableRootsRegistryAddress,
    commitmentMapperRegistryAddress,
    attestationsRegistryAddress,
    collectionIdFirst = 100,
    collectionIdLast = 0,
    options,
  }: DeployHydraS1SimpleAttesterArgs,
  hre: HardhatRuntimeEnvironment
): Promise<DeployedHydraS1SimpleAttester> {
  const deployer = await getDeployer(hre);
  const deploymentName = buildDeploymentName(CONTRACT_NAME, options?.deploymentNamePrefix);

  let hydraS1Verifier: HydraS1Verifier;

  if (!hydraS1VerifierAddress) {
    ({ hydraS1Verifier } = await hre.run('deploy-hydra-s1-verifier', {
      options,
    }));
    hydraS1VerifierAddress = hydraS1Verifier.address;
  } else {
    hydraS1Verifier = HydraS1Verifier__factory.connect(hydraS1VerifierAddress, deployer);
  }

  // if enableDeployment is false, we just return the verifier
  if (!enableDeployment) {
    return { hydraS1Verifier };
  }

  const deploymentArgs = [
    attestationsRegistryAddress,
    hydraS1VerifierAddress,
    availableRootsRegistryAddress,
    commitmentMapperRegistryAddress,
    BigNumber.from(collectionIdFirst),
    BigNumber.from(collectionIdLast),
  ];

  await beforeDeployment(hre, deployer, CONTRACT_NAME, deploymentArgs, options);

  const initData = '0x';

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

  const hydraS1SimpleAttester = HydraS1SimpleAttester__factory.connect(deployed.address, deployer);
  return { hydraS1SimpleAttester, hydraS1Verifier };
}

task('deploy-hydra-s1-simple-attester')
  .addParam('collectionIdFirst', '')
  .addParam('collectionIdLast', '')
  .addOptionalParam(
    'hydraS1VerifierAddress',
    'address of the proving scheme verifier. Deploy verifier if not defined.'
  )
  .addParam('availableRootsRegistryAddress', 'address of the registryMerkleRoot contract')
  .addParam(
    'commitmentMapperRegistryAddress',
    'address of the commitmentMapperRegistryAddress contract'
  )
  .addParam('attestationsRegistryAddress', 'Address of the attestations contract')
  .setAction(wrapCommonDeployOptions(deploymentAction));
