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
} from '../../../../../../tasks/deploy-tasks/utils';
import {
  HydraS1SoulboundAttester,
  HydraS1SoulboundAttester__factory,
  HydraS1Verifier,
  HydraS1Verifier__factory,
} from '../../../../../../types';
import { BigNumber, BigNumberish } from 'ethers';

export interface DeployHydraS1SoulboundAttesterArgs {
  // address of the proving scheme verifier contract
  hydraS1VerifierAddress?: string;
  // address of the registry MerkleRoot contract
  availableRootsRegistryAddress: string;
  // address of the commitment mapper registry
  commitmentMapperRegistryAddress: string;
  // address of the attestations contract,
  // which is part of the SAS
  // Sismo Attestation State
  attestationsRegistryAddress: string;
  collectionIdFirst: BigNumberish;
  collectionIdLast: BigNumberish;
  cooldownDuration: BigNumberish;
  options?: DeployOptions;
}

export interface DeployedHydraS1SoulboundAttester {
  hydraS1SoulboundAttester: HydraS1SoulboundAttester;
  hydraS1Verifier: HydraS1Verifier;
}

const CONTRACT_NAME = 'HydraS1SoulboundAttester';

async function deploymentAction(
  {
    hydraS1VerifierAddress,
    availableRootsRegistryAddress,
    commitmentMapperRegistryAddress,
    attestationsRegistryAddress,
    collectionIdFirst,
    collectionIdLast,
    cooldownDuration,
    options,
  }: DeployHydraS1SoulboundAttesterArgs,
  hre: HardhatRuntimeEnvironment
): Promise<DeployedHydraS1SoulboundAttester> {
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
    availableRootsRegistryAddress,
    commitmentMapperRegistryAddress,
    BigNumber.from(collectionIdFirst),
    BigNumber.from(collectionIdLast),
    BigNumber.from(cooldownDuration),
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

  const hydraS1SoulboundAttester = HydraS1SoulboundAttester__factory.connect(
    deployed.address,
    deployer
  );
  return { hydraS1SoulboundAttester, hydraS1Verifier };
}

task('deploy-hydra-s1-soulbound-attester')
  .addParam('collectionIdFirst', '')
  .addParam('collectionIdLast', '')
  .addParam('cooldownDuration', '')
  .addOptionalParam(
    'hydraS1Verifier',
    'address of the proving scheme verifier. Deploy verifier if not defined.'
  )
  .addParam('availableRootsRegistryAddress', 'address of the registryMerkleRoot contract')
  .addParam(
    'commitmentMapperRegistryAddress',
    'address of the commitmentMapperRegistryAddress contract'
  )
  .addParam('attestationsRegistryAddress', 'Address of the attestations contract')
  .setAction(wrapCommonDeployOptions(deploymentAction));
