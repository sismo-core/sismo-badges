import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { ZKBadgeboundERC721, ZKBadgeboundERC721__factory } from '../../../types';
import {
  afterDeployment,
  beforeDeployment,
  buildDeploymentName,
  customDeployContract,
  DeployOptions,
  getDeployer,
  wrapCommonDeployOptions,
} from '../utils';

export interface DeployZKBadgeboundERC721Args {
  name: string;
  symbol: string;
  tokenURI: string;
  passTokenId: number;
  options?: DeployOptions;
}

export interface DeployedZkBadgeboundERC721 {
  zkBadgeboundERC721: ZKBadgeboundERC721;
}

const CONTRACT_NAME = 'ZKBadgeboundERC721';

async function deploymentAction(
  { name, symbol, tokenURI, passTokenId, options }: DeployZKBadgeboundERC721Args,
  hre: HardhatRuntimeEnvironment
) {
  const deployer = await getDeployer(hre);
  const deploymentName = buildDeploymentName(CONTRACT_NAME, options?.deploymentNamePrefix);
  const deploymentArgs = [name, symbol, tokenURI, passTokenId];

  await beforeDeployment(hre, deployer, CONTRACT_NAME, deploymentArgs, options);

  const initData = new ZKBadgeboundERC721__factory().interface.encodeFunctionData('initialize', [
    name,
    symbol,
    tokenURI,
  ]);

  const deployed = await customDeployContract(
    hre,
    deployer,
    deploymentName,
    CONTRACT_NAME,
    deploymentArgs,
    { ...options, proxyData: initData }
  );

  await afterDeployment(hre, deployer, CONTRACT_NAME, deploymentArgs, deployed, options);
  const zkBadgeboundERC721 = ZKBadgeboundERC721__factory.connect(deployed.address, deployer);
  return { zkBadgeboundERC721 };
}

task('deploy-zk-badgebound-erc721')
  .addParam('name', 'Name of the token')
  .addParam('symbol', 'Symbol of the token')
  .addParam('tokenURI', 'Token URI')
  .addParam('passTokenId', 'Token ID of the pass token')
  .setAction(wrapCommonDeployOptions(deploymentAction));
