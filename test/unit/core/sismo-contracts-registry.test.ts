import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import hre from 'hardhat';
import { Deployed0 } from 'tasks/deploy-tasks/full/0-deploy-core-and-hydra-s1-simple-and-accountbound-and-pythia1.task';
import { evmRevert, evmSnapshot } from '../../../test/utils';
import {
  AttestationsRegistry,
  Badges,
  Front,
  HydraS1AccountboundAttester,
  SismoContractsRegistry,
} from 'types';

const SismoContractsAddress = '0x0C567Ef02C88c1737B6819C2b03b12f5693Cc748';

describe('Test Sismo Contracts Registry', () => {
  let deployer: SignerWithAddress;
  let proxyAdminSigner: SignerWithAddress;

  let attestationsRegistry: AttestationsRegistry;
  let badges: Badges;
  let front: Front;
  let hydraS1AccountboundAttester: HydraS1AccountboundAttester;

  let sismoContractsRegistry: SismoContractsRegistry;

  before(async () => {
    const signers = await hre.ethers.getSigners();
    [deployer, , proxyAdminSigner] = signers;
    ({ attestationsRegistry, badges, hydraS1AccountboundAttester, front } = (await hre.run(
      '0-deploy-core-and-hydra-s1-simple-and-accountbound-and-pythia1',
      {
        options: {
          proxyAdmin: proxyAdminSigner.address,
        },
      }
    )) as Deployed0);
    await deployer.sendTransaction({ to: proxyAdminSigner.address, value: 1 });
  });

  /*************************************************************************************/
  /********************************** DEPLOYMENTS **************************************/
  /*************************************************************************************/
  describe('Deployments', () => {
    let firstDeploumentStartingNonce: number;

    it('Should deploy the Sismo Contract Registry', async () => {
      firstDeploumentStartingNonce = await deployer.getTransactionCount();

      const snapshotId = await evmSnapshot(hre);
      const { sismoContractsRegistry } = await hre.run('deploy-sismo-contracts-registry', {
        badges: badges.address,
        attestationsRegistry: attestationsRegistry.address,
        front: front.address,
        hydraS1AccountboundAttester: hydraS1AccountboundAttester.address,
        owner: deployer.address,
        options: {
          deploymentNamePrefix: 'firstDeployment',
        },
      });
      expect(sismoContractsRegistry.address).to.be.eql(SismoContractsAddress);

      await evmRevert(hre, snapshotId);
    });

    it('Should increase the nonce by 1', async () => {
      await deployer.sendTransaction({ to: proxyAdminSigner.address, value: 1 });
      expect(await deployer.getTransactionCount()).to.be.eql(firstDeploumentStartingNonce + 1);
    });

    it('Should deploy again with an increased nonce and have the same address', async () => {
      ({ sismoContractsRegistry } = await hre.run('deploy-sismo-contracts-registry', {
        badges: badges.address,
        attestationsRegistry: attestationsRegistry.address,
        front: front.address,
        hydraS1AccountboundAttester: hydraS1AccountboundAttester.address,
        owner: deployer.address,
        options: {
          deploymentNamePrefix: 'secondDeployment',
        },
      }));

      expect(sismoContractsRegistry.address).to.be.eql(SismoContractsAddress);
    });
  });

  describe('Getters', () => {
    it('Should get the sismo contracts addresses', async () => {
      // expect(await sismoContractsRegistry.getBadges()).to.be.eql(badges.address);
      // expect(await sismoContractsRegistry.getAttestationsRegistry()).to.be.eql(
      //   attestationsRegistry.address
      // );
      // expect(await sismoContractsRegistry.getFront()).to.be.eql(front.address);
      // expect(await sismoContractsRegistry.getHydraS1AccountboundAttester()).to.be.eql(
      //   hydraS1AccountboundAttester.address
      // );
    });
  });
});
