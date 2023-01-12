import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getImplementation } from './../../../utils';
import { ZKBadgeboundERC721, ZKBadgeboundERC721__factory } from '../../../types';
import {
  afterDeployment,
  beforeDeployment,
  customDeployContract,
  DeployOptions,
  getDeployer,
  wrapCommonDeployOptions,
} from '../utils';

export interface DeployZKBadgeboundERC721Args {
  deploymentName?: string;
  name: string;
  symbol: string;
  tokenURI: string;
  gatingBadgeTokenId: number;
  admin: string;
  options?: DeployOptions;
}

export interface DeployedZkBadgeboundERC721 {
  zkBadgeboundERC721: ZKBadgeboundERC721;
}

const CONTRACT_NAME = 'ZKBadgeboundERC721';

async function deploymentAction(
  {
    deploymentName,
    name,
    symbol,
    tokenURI,
    gatingBadgeTokenId,
    admin,
    options,
  }: DeployZKBadgeboundERC721Args,
  hre: HardhatRuntimeEnvironment
) {
  const deployer = await getDeployer(hre);
  const deploymentArgs = [name, symbol, tokenURI, gatingBadgeTokenId, admin];

  await beforeDeployment(hre, deployer, CONTRACT_NAME, deploymentArgs, options);

  const initData = new ZKBadgeboundERC721__factory().interface.encodeFunctionData('initialize', [
    name,
    symbol,
    tokenURI,
    admin,
  ]);

  const deployed = await customDeployContract(
    hre,
    deployer,
    deploymentName ? deploymentName : `${options?.deploymentNamePrefix}_${CONTRACT_NAME}`,
    CONTRACT_NAME,
    deploymentArgs,
    { ...options, proxyData: initData }
  );

  await afterDeployment(hre, deployer, CONTRACT_NAME, deploymentArgs, deployed, options);
  const zkBadgeboundERC721 = ZKBadgeboundERC721__factory.connect(deployed.address, deployer);

  if (options?.manualConfirm || options?.log) {
    console.log(`
  ************************************************************
  *                           RECAP                          *
  ************************************************************

  date: ${new Date().toISOString()}

  * ZKBadgeboundERC721:
  -> proxy: ${zkBadgeboundERC721.address}
  -> implem: ${await getImplementation(zkBadgeboundERC721)}
  `);
  }

  return { zkBadgeboundERC721 };
}

task('deploy-zk-badgebound-erc721')
  .addOptionalParam('deploymentName', 'Name of the deployment')
  .addParam('name', 'Name of the token')
  .addParam('symbol', 'Symbol of the token')
  .addParam('tokenURI', 'Token URI')
  .addParam('gatingBadgeTokenId', 'gatingBadgeTokenId')
  .setAction(wrapCommonDeployOptions(deploymentAction));
