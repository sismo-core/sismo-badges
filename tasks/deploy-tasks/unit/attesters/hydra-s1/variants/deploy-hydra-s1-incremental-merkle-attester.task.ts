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
} from '../../../../utils';
import {
  HydraS1IncrementalMerkleAttester__factory,
  HydraS1IncrementalMerkleAttester,
  HydraS1Verifier,
  HydraS1Verifier__factory,
} from '../../../../../../types';
import { BigNumber, BigNumberish } from 'ethers';

export interface DeployHydraS1IncrementalMerkleAttesterArgs {
  // address of the proving scheme verifier contract
  hydraS1VerifierAddress?: string;
  // address of the incremental merkle tree contract
  incrementalMerkleTreeAddress: string;
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

export interface DeployedHydraS1IncrementalMerkleAttester {
  hydraS1IncrementalMerkleAttester: HydraS1IncrementalMerkleAttester;
  hydraS1Verifier: HydraS1Verifier;
}

const CONTRACT_NAME = 'HydraS1IncrementalMerkleAttester';

async function deploymentAction(
  {
    hydraS1VerifierAddress,
    incrementalMerkleTreeAddress,
    commitmentMapperRegistryAddress,
    attestationsRegistryAddress,
    collectionIdFirst,
    collectionIdLast,
    options,
  }: DeployHydraS1IncrementalMerkleAttesterArgs,
  hre: HardhatRuntimeEnvironment
): Promise<DeployedHydraS1IncrementalMerkleAttester> {
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
  const deploymentArgs = [
    attestationsRegistryAddress,
    hydraS1VerifierAddress,
    incrementalMerkleTreeAddress,
    commitmentMapperRegistryAddress,
    BigNumber.from(collectionIdFirst),
    BigNumber.from(collectionIdLast),
  ];

  await beforeDeployment(hre, deployer, CONTRACT_NAME, deploymentArgs, options);

  const deployed = await customDeployContract(
    hre,
    deployer,
    deploymentName,
    CONTRACT_NAME,
    deploymentArgs,
    {
      ...options,
    }
  );

  await afterDeployment(hre, deployer, CONTRACT_NAME, deploymentArgs, deployed, options);

  const hydraS1IncrementalMerkleAttester = HydraS1IncrementalMerkleAttester__factory.connect(
    deployed.address,
    deployer
  );
  return { hydraS1IncrementalMerkleAttester, hydraS1Verifier };
}

task('deploy-hydra-s1-incremental-merkle-attester')
  .addParam('collectionIdFirst', '')
  .addParam('collectionIdLast', '')
  .addOptionalParam(
    'hydraS1Verifier',
    'address of the proving scheme verifier. Deploy verifier if not defined.'
  )
  .addParam('incrementalMerkleTreeAddress', 'address of the incremental merkle tree contract')
  .addParam(
    'commitmentMapperRegistryAddress',
    'address of the commitmentMapperRegistryAddress contract'
  )
  .addParam('attestationsRegistryAddress', 'Address of the attestations contract')
  .setAction(wrapCommonDeployOptions(deploymentAction));
