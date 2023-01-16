import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployOptions } from '../../utils';
import { deploymentsConfig } from '../../deployments-config';
import { ZKBadgeboundERC721 } from 'types';
import { DeployedZkBadgeboundERC721 } from 'tasks/deploy-tasks/tests/deploy-zk-badgebound-erc721.task';

export interface DeployedZikiPass {
  zkBadgeboundERC721: ZKBadgeboundERC721;
}

async function deploymentAction(
  { options }: { options: DeployOptions },
  hre: HardhatRuntimeEnvironment
): Promise<DeployedZikiPass> {
  const config = deploymentsConfig[process.env.FORK_NETWORK ?? hre.network.name];
  options = { ...config.deployOptions, ...options };

  if (options.manualConfirm || options.log) {
    console.log('deploy-ziki-pass-staging: ', hre.network.name);
  }

  // Deploy SismoAddressesProvider
  const { zkBadgeboundERC721 } = (await hre.run('deploy-zk-badgebound-erc721', {
    name: 'Ziki Pass',
    symbol: 'ZKP',
    tokenURI: 'ipfs://Qme1WfqhZ4dUVSKHE9NqH1z7MXFtviPY6QEPwu8TcgAyjc/',
    gatingBadgeTokenId: '10000515',
    admin: '0xf61cabba1e6fc166a66bca0fcaa83762edb6d4bd', // leo21.eth
    deploymentName: 'ZikiPass',
    options,
  })) as DeployedZkBadgeboundERC721;

  return {
    zkBadgeboundERC721,
  };
}

task('deploy-ziki-pass-staging').setAction(deploymentAction);
