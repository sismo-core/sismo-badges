import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import hre from 'hardhat';
import { MockContractUsingSismoLib } from 'types';
import { deployCoreContracts } from '../../../../test/utils/test-helpers';

describe('Test UsingSismo Lib', async () => {
  let mockContractUsingSismoLib: MockContractUsingSismoLib;

  let deployer: SignerWithAddress;
  let account1Signer: SignerWithAddress;
  let account2Signer: SignerWithAddress;
  let account3Signer: SignerWithAddress;

  before(async () => {
    [deployer, account1Signer, account2Signer, account3Signer] = await hre.ethers.getSigners();
  });

  describe('Deployments', async () => {
    it('Should deploy, setup core and mock', async () => {
      await deployCoreContracts(deployer, {
        deploymentNamePrefix: 'mock-contract-using-sismo-lib',
      });

      // deploy mock contract
      ({ mockContractUsingSismoLib } = await hre.run('deploy-mock-contract-using-sismo-lib', {
        options: {
          deploymentNamePrefix: 'mock-contract-using-sismo-lib',
          behindProxy: false,
        },
      }));
    });

    it('Should check gated badges in mock contract', async () => {
      expect(await mockContractUsingSismoLib.FIRST_GATED_BADGE_ID()).to.be.eql(
        BigNumber.from(200002)
      );

      expect(await mockContractUsingSismoLib.SECOND_GATED_BADGE_ID()).to.be.eql(
        BigNumber.from(200003)
      );
    });
  });
});
