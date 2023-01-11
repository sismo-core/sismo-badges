import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployOptions } from '../utils';
import { deploymentsConfig } from '../deployments-config';
import { ZKBadgeboundERC721 } from 'types';
import { DeployedZkBadgeboundERC721 } from 'tasks/deploy-tasks/tests/deploy-zk-badgebound-erc721.task';

export interface Deployed8 {
  zkBadgeboundERC721: ZKBadgeboundERC721;
}

async function deploymentAction(
  { options }: { options: DeployOptions },
  hre: HardhatRuntimeEnvironment
): Promise<Deployed8> {
  const config = deploymentsConfig[process.env.FORK_NETWORK ?? hre.network.name];
  options = { ...config.deployOptions, ...options };

  if (options.manualConfirm || options.log) {
    console.log('8-deploy-zk-badgebound-erc721: ', hre.network.name);
  }

  // Deploy SismoAddressesProvider
  const { zkBadgeboundERC721 } = (await hre.run('deploy-zk-badgebound-erc721', {
    name: 'Mergoor Pass',
    symbol: 'MPT',
    // tokenURI: 'https://test.com/mergerpass', -> add correct token URI
    options,
  })) as DeployedZkBadgeboundERC721;

  return {
    zkBadgeboundERC721,
  };
}

task('8-deploy-zk-badgebound-erc721').setAction(deploymentAction);
