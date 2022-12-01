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
} from '../../../utils';

import {
  Pythia1SimpleAttester,
  Pythia1SimpleAttester__factory,
  Pythia1Verifier,
  Pythia1Verifier__factory,
} from '../../../../../types';
import { BigNumber, BigNumberish } from 'ethers';

export interface DeployPythia1SimpleAttesterArgs {
  // address of the proving scheme verifier contract
  pythia1VerifierAddress?: string;
  // Commitment Signer public key
  commitmentSignerPubKeyX?: string;
  commitmentSignerPubKeyY?: string;
  // address of the owner that can update the commitmentSignerPubKey
  owner?: string;
  // address of the attestations contract,
  // which is part of the Attestation Registry
  // Sismo Attestation State
  attestationsRegistryAddress: string;
  collectionIdFirst: BigNumberish;
  collectionIdLast: BigNumberish;
  options?: DeployOptions;
}

export interface DeployedPythia1SimpleAttester {
  pythia1SimpleAttester: Pythia1SimpleAttester;
  pythia1Verifier: Pythia1Verifier;
}

const CONTRACT_NAME = 'Pythia1SimpleAttester';

async function deploymentAction(
  {
    pythia1VerifierAddress,
    attestationsRegistryAddress,
    commitmentSignerPubKeyX,
    commitmentSignerPubKeyY,
    collectionIdFirst = 100,
    collectionIdLast = 0,
    owner,
    options,
  }: DeployPythia1SimpleAttesterArgs,
  hre: HardhatRuntimeEnvironment
): Promise<DeployedPythia1SimpleAttester> {
  const deployer = await getDeployer(hre);
  const deploymentName = buildDeploymentName(CONTRACT_NAME, options?.deploymentNamePrefix);

  let pythia1Verifier: Pythia1Verifier;

  if (!pythia1VerifierAddress) {
    ({ pythia1Verifier } = await hre.run('deploy-pythia-1-verifier', {
      options,
    }));
    pythia1VerifierAddress = pythia1Verifier.address;
  } else {
    pythia1Verifier = Pythia1Verifier__factory.connect(pythia1VerifierAddress, deployer);
  }

  const deploymentArgs = [
    attestationsRegistryAddress,
    BigNumber.from(collectionIdFirst),
    BigNumber.from(collectionIdLast),
    pythia1VerifierAddress,
    [commitmentSignerPubKeyX, commitmentSignerPubKeyY],
    owner || deployer.address,
    options?.implementationVersion || 1,
  ];

  await beforeDeployment(hre, deployer, CONTRACT_NAME, deploymentArgs, options);

  const initData = new Pythia1SimpleAttester__factory().interface.encodeFunctionData('initialize', [
    [commitmentSignerPubKeyX, commitmentSignerPubKeyY],
    owner || deployer.address,
  ]);

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

  const pythia1SimpleAttester = Pythia1SimpleAttester__factory.connect(deployed.address, deployer);
  return { pythia1SimpleAttester, pythia1Verifier };
}

task('deploy-pythia-1-simple-attester')
  .addParam('collectionIdFirst', '')
  .addParam('collectionIdLast', '')
  .addOptionalParam(
    'pythia1VerifierAddress',
    'address of the proving scheme verifier. Deploy verifier if not defined.'
  )
  .addParam('attestationsRegistryAddress', 'Address of the attestations contract')
  .addParam('commitmentSignerPubKeyX', 'Eddsa public key coordinate X')
  .addParam('commitmentSignerPubKeyY', 'Eddsa public key coordinate Y')
  .addOptionalParam(
    'owner',
    'Owner of the contract that can change the commitment signer pubKey. Default to deployer'
  )
  .setAction(wrapCommonDeployOptions(deploymentAction));
