import { getImplementation } from './../../../utils/proxy';
import { HydraS1AccountboundAttester } from '../../../types/HydraS1AccountboundAttester';
import { HydraS1SimpleAttester } from '../../../types/HydraS1SimpleAttester';
import { AttestationsRegistry } from '../../../types/AttestationsRegistry';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import hre, { ethers } from 'hardhat';
import { impersonateAddress } from '../../../test/utils';
import { deploymentsConfig } from '../deployments-config';
import { Badges, Pythia1SimpleAttester } from '../../../types';

// Launch with command
// FORK=true FORK_NETWORK=goerli npx hardhat test ./tasks/deploy-tasks/full/2-upgrade-proxies.test-fork.ts

describe('Test Badges contract', () => {
  let deployer: SignerWithAddress;

  let badges: Badges;
  let attestationsRegistry: AttestationsRegistry;
  let hydraS1SimpleAttester: HydraS1SimpleAttester;
  let pythia1SimpleAttester: Pythia1SimpleAttester;
  let hydraS1AccountboundAttester: HydraS1AccountboundAttester;

  const config = deploymentsConfig[process.env.FORK_NETWORK ?? hre.network.name];

  before(async () => {
    [deployer] = await ethers.getSigners();

    // impersonate address for the fork test
    await impersonateAddress(hre, config.deployOptions.proxyAdmin!, true);
  });

  /*************************************************************************************/
  /********************************** DEPLOYMENTS **************************************/
  /*************************************************************************************/
  describe('Run upgrade script', () => {
    it('Should run the upgrade script', async () => {
      ({
        attestationsRegistry,
        badges,
        hydraS1SimpleAttester,
        pythia1SimpleAttester,
        hydraS1AccountboundAttester,
      } = await hre.run('2-upgrade-proxies', { options: { manualConfirm: false } }));
    });

    it('should test the badge contract', async () => {
      // leosayous21.sismo.eth
      console.log(await badges.balanceOf('0xF61CabBa1e6FC166A66bcA0fcaa83762EdB6D4Bd', 15151111));
    });
  });
});
