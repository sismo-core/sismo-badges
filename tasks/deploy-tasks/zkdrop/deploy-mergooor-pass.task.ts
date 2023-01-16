import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployOptions } from '../utils';
import { deploymentsConfig } from '../deployments-config';
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
    tokenURI: 'ipfs://QmPR9q3Q5fByxzfMfRp32azvH2UPXhPoDFhHWAsiGNHBwS/',
    gatingBadgeTokenId: '10000040',
    admin: '0xaee4acd5c4Bf516330ca8fe11B07206fC6709294', // Sismo owner
    deploymentName: 'MergooorPass',
    options,
  })) as DeployedZkBadgeboundERC721;

  return {
    zkBadgeboundERC721,
  };
}

task('deploy-mergooor-pass').setAction(deploymentAction);
