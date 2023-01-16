import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployOptions } from '../../utils';
import { deploymentsConfig } from '../../deployments-config';
import { ZKBadgeboundERC721 } from 'types';
import { DeployedZkBadgeboundERC721 } from 'tasks/deploy-tasks/tests/deploy-zk-badgebound-erc721.task';

export interface DeployedMergooorPass {
  zkBadgeboundERC721: ZKBadgeboundERC721;
}

async function deploymentAction(
  { options }: { options: DeployOptions },
  hre: HardhatRuntimeEnvironment
): Promise<DeployedMergooorPass> {
  const config = deploymentsConfig[process.env.FORK_NETWORK ?? hre.network.name];
  options = { ...config.deployOptions, ...options };

  if (options.manualConfirm || options.log) {
    console.log('deploy-mergooor-pass: ', hre.network.name);
  }

  // Deploy SismoAddressesProvider
  const { zkBadgeboundERC721 } = (await hre.run('deploy-zk-badgebound-erc721', {
    name: 'Mergooor Pass',
    symbol: 'MP',
    tokenURI: 'https://metadata.zkdrop.io/mergooor-pass/',
    gatingBadgeTokenId: '10000040',
    admin: '0x10f5d45854e038071485ac9e402308cf80d2d2fe', // timbeiko.eth
    deploymentName: 'MergooorPass',
    options,
  })) as DeployedZkBadgeboundERC721;

  return {
    zkBadgeboundERC721,
  };
}

task('deploy-mergooor-pass').setAction(deploymentAction);
