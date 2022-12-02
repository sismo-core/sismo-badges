import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import hre, { ethers } from 'hardhat';
import { evmSnapshot, impersonateAddress } from '../../../../test/utils';
import { deploymentsConfig } from '../../../../tasks/deploy-tasks/deployments-config';
import {
  AvailableRootsRegistry,
  AvailableRootsRegistry__factory,
  TransparentUpgradeableProxy__factory,
} from '../../../../types';
import { getImplementation } from '../../../../utils';
import { Deployed5 } from 'tasks/deploy-tasks/full/5-upgrade-proxies-with-reinitializer.task';

describe('FORK Test AvailableRootsRegistry contract', () => {
  let deployer: SignerWithAddress;
  let secondDeployer: SignerWithAddress;
  let attacker: SignerWithAddress;
  let attester1: SignerWithAddress;
  let attester2: SignerWithAddress;
  let randomSigner: SignerWithAddress;
  let availableRootsRegistryOwner: SignerWithAddress;

  let availableRootsRegistry: AvailableRootsRegistry;

  let snapshotId: string;

  const config = deploymentsConfig[process.env.FORK_NETWORK ?? hre.network.name];

  before(async () => {
    const signers = await hre.ethers.getSigners();
    [deployer, secondDeployer, attacker, attester1, attester2, , , , , , randomSigner] = signers;
  });

  /*************************************************************************************/
  /********************************** DEPLOYMENTS **************************************/
  /*************************************************************************************/
  describe('Deployments', () => {
    it('Should deploy, setup and test the constructed values of the contract', async () => {
      availableRootsRegistry = AvailableRootsRegistry__factory.connect(
        config.availableRootsRegistry.address,
        await impersonateAddress(hre, config.availableRootsRegistry.owner)
      ) as AvailableRootsRegistry;

      // 0 - Checks that the owner is set to the deployer address
      expect((await availableRootsRegistry.owner()).toLowerCase()).to.be.eql(
        config.availableRootsRegistry.owner
      );
    });
  });

  describe('Update Implementation', () => {
    it('Should run the upgrade script', async () => {
      await impersonateAddress(
        hre,
        config.deployOptions.proxyAdmin ?? config.synapsPythia1SimpleAttester.owner
      );

      ({ availableRootsRegistry } = await hre.run('5-upgrade-proxies-with-reinitializer', {
        options: { manualConfirm: false, log: false },
      })) as Deployed5;

      availableRootsRegistryOwner = await impersonateAddress(
        hre,
        await availableRootsRegistry.owner()
      );

      snapshotId = await evmSnapshot(hre);
    });
  });

  describe('Configuration checks', () => {
    it('Should check the address of the proxy', async () => {
      expect(availableRootsRegistry.address).to.be.eql(config.availableRootsRegistry.address);
    });

    it('Should have setup the owner correctly', async () => {
      expect(availableRootsRegistryOwner.address.toLowerCase()).to.be.eql(
        config.availableRootsRegistry.owner
      );
    });

    it('Should get the version correctly', async () => {
      expect(await availableRootsRegistry.VERSION()).to.be.eql(2);
    });

    it('Should revert when trying to call initialize again', async () => {
      await expect(
        availableRootsRegistry
          .connect(availableRootsRegistryOwner)
          .initialize(randomSigner.address, { gasLimit: 600000 })
      ).to.be.revertedWith('Initializable: contract is already initialized');
    });
  });

  /*************************************************************************************/
  /***************************** REGISTER ROOT FOR ATTESTER ****************************/
  /*************************************************************************************/
  describe('Register root for attester', () => {
    it('Should revert when the sender is not the owner of the contract', async () => {
      await expect(
        availableRootsRegistry.connect(attacker).registerRootForAttester(attester1.address, 1)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('Should revert when the attester address is a zero address', async () => {
      await expect(
        availableRootsRegistry
          .connect(availableRootsRegistryOwner)
          .registerRootForAttester('0x0000000000000000000000000000000000000000', 1, {
            gasLimit: 600000,
          })
      ).to.be.revertedWith('CannotRegisterForZeroAddress()');
    });

    it('Should register the root for the attester', async () => {
      const registerRootForAttesterTransaction = await availableRootsRegistry
        .connect(availableRootsRegistryOwner)
        .registerRootForAttester(attester1.address, 1, {
          gasLimit: 100000,
        });

      // 1 - Checks that the transaction emitted the event
      await expect(registerRootForAttesterTransaction)
        .to.emit(availableRootsRegistry, 'RegisteredRootForAttester')
        .withArgs(attester1.address, 1);

      // 2 - Checks that the root is registered for the attester
      expect(await availableRootsRegistry._roots(attester1.address, 1)).to.be.true;

      // 3 - Checks that the root is not registered for the second attester
      expect(await availableRootsRegistry._roots(attester2.address, 1)).to.be.false;
    });
  });

  /*************************************************************************************/
  /**************************** UNREGISTER ROOT FOR ATTESTER ***************************/
  /*************************************************************************************/
  describe('Unregister root for attester', () => {
    it('Should revert when the sender is not the owner of the contract', async () => {
      await expect(
        availableRootsRegistry.connect(attacker).unregisterRootForAttester(attester1.address, 1)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('Should revert when the attester address is a zero address', async () => {
      await expect(
        availableRootsRegistry
          .connect(availableRootsRegistryOwner)
          .unregisterRootForAttester(ethers.constants.AddressZero, 1)
      ).to.be.revertedWith('CannotUnregisterForZeroAddress()');
    });

    it('Should unregister the root for the attester', async () => {
      const unregisterRootForAttesterTransaction = await availableRootsRegistry
        .connect(availableRootsRegistryOwner)
        .unregisterRootForAttester(attester1.address, 1);

      // 1 - Checks that the transaction emitted the event
      await expect(unregisterRootForAttesterTransaction)
        .to.emit(availableRootsRegistry, 'UnregisteredRootForAttester')
        .withArgs(attester1.address, 1);

      // 2 - Checks that the root is unregistered for the attester
      expect(await availableRootsRegistry._roots(attester1.address, 1)).to.be.false;
    });
  });

  /*************************************************************************************/
  /******************************* REGISTER ROOT FOR ALL *******************************/
  /*************************************************************************************/
  describe('Register root for all', () => {
    it('Should revert when the sender is not the owner of the contract', async () => {
      await expect(
        availableRootsRegistry.connect(attacker).registerRootForAll(1)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('Should register the root for the all attesters', async () => {
      const registerRootForAllTransaction = await availableRootsRegistry
        .connect(availableRootsRegistryOwner)
        .registerRootForAll(1);

      // 1 - Checks that the transaction emitted the event
      await expect(registerRootForAllTransaction)
        .to.emit(availableRootsRegistry, 'RegisteredRootForAll')
        .withArgs(1);

      // 2 - Checks that the root is registered globally (on address 0x0)
      expect(await availableRootsRegistry._roots(ethers.constants.AddressZero, 1)).to.be.true;

      // 3 - Checks that the root is available for the first & second attesters
      expect(await availableRootsRegistry.isRootAvailableForAttester(attester1.address, 1)).to.be
        .true;
      expect(await availableRootsRegistry.isRootAvailableForAttester(attester2.address, 1)).to.be
        .true;
    });
  });

  /*************************************************************************************/
  /****************************** UNREGISTER ROOT FOR ALL ******************************/
  /*************************************************************************************/
  describe('Unregister root for all', () => {
    it('Should revert when the sender is not the owner of the contract', async () => {
      await expect(
        availableRootsRegistry.connect(attacker).unregisterRootForAll(1)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('Should unregister the root for all the attesters', async () => {
      const unregisterRootForAllTransaction = await availableRootsRegistry
        .connect(availableRootsRegistryOwner)
        .unregisterRootForAll(1);

      // 1 - Checks that the transaction emitted the event
      await expect(unregisterRootForAllTransaction)
        .to.emit(availableRootsRegistry, 'UnregisteredRootForAll')
        .withArgs(1);

      // 2 - Checks that the root is unregistered globally (on address 0x0)
      expect(await availableRootsRegistry._roots(ethers.constants.AddressZero, 1)).to.be.false;

      // 3 - Checks that the root is not available for the first & second attesters
      expect(await availableRootsRegistry.isRootAvailableForAttester(attester1.address, 1)).to.be
        .false;
      expect(await availableRootsRegistry.isRootAvailableForAttester(attester2.address, 1)).to.be
        .false;
    });
  });

  /*************************************************************************************/
  /*************************** IS ROOT AVAILABLE FOR ATTESTER **************************/
  /*************************************************************************************/
  describe('Is root available for attester', () => {
    describe('When the root is not available for the attester or globally', () => {
      it('Should return false', async () => {
        expect(
          await availableRootsRegistry
            .connect(availableRootsRegistryOwner)
            .isRootAvailableForAttester(attester1.address, 1)
        ).to.be.false;
      });
    });

    describe('When the root is available for the attester', () => {
      before(async () => {
        await availableRootsRegistry
          .connect(availableRootsRegistryOwner)
          .registerRootForAttester(attester1.address, 1);
      });

      it('Should return true', async () => {
        expect(
          await availableRootsRegistry
            .connect(availableRootsRegistryOwner)
            .isRootAvailableForAttester(attester1.address, 1)
        ).to.be.true;
      });

      it("Should return false when it's the wrong attester", async () => {
        expect(
          await availableRootsRegistry
            .connect(availableRootsRegistryOwner)
            .isRootAvailableForAttester(attester2.address, 1)
        ).to.be.false;
      });
    });

    describe('When the root is available globally', () => {
      before(async () => {
        await availableRootsRegistry
          .connect(availableRootsRegistryOwner)
          .unregisterRootForAttester(attester1.address, 1);

        await availableRootsRegistry.connect(availableRootsRegistryOwner).registerRootForAll(1);
      });

      it('Should return true', async () => {
        expect(await availableRootsRegistry.isRootAvailableForAttester(attester1.address, 1)).to.be
          .true;

        expect(await availableRootsRegistry.isRootAvailableForAttester(attester2.address, 1)).to.be
          .true;
      });
    });
  });

  /*************************************************************************************/
  /****************************** IS ROOT AVAILABLE FOR ME *****************************/
  /*************************************************************************************/
  describe('Is root available for me', () => {
    before(async () => {
      await availableRootsRegistry
        .connect(availableRootsRegistryOwner)
        .unregisterRootForAttester(attester1.address, 1);
      await availableRootsRegistry.connect(availableRootsRegistryOwner).unregisterRootForAll(1);
    });

    describe('When the root is not available for the attester or globally', async () => {
      it('Should return false', async () => {
        expect(await availableRootsRegistry.isRootAvailableForMe(1)).to.be.false;
      });
    });

    describe('When the root is available for the attester', () => {
      before(async () => {
        await availableRootsRegistry
          .connect(availableRootsRegistryOwner)
          .registerRootForAttester(attester1.address, 1);
      });

      it('Should return true', async () => {
        expect(await availableRootsRegistry.connect(attester1).isRootAvailableForMe(1)).to.be.true;
      });

      it("Should return false when it's the wrong attester", async () => {
        expect(await availableRootsRegistry.connect(attester2).isRootAvailableForMe(1)).to.be.false;
      });
    });

    describe('When the root is available globally', () => {
      before(async () => {
        await availableRootsRegistry
          .connect(availableRootsRegistryOwner)
          .unregisterRootForAttester(attester1.address, 1);

        await availableRootsRegistry.connect(availableRootsRegistryOwner).registerRootForAll(1);
      });

      it('Should return true', async () => {
        expect(await availableRootsRegistry.connect(attester1).isRootAvailableForMe(1)).to.be.true;

        expect(await availableRootsRegistry.connect(attester2).isRootAvailableForMe(1)).to.be.true;
      });
    });
  });

  /*************************************************************************************/
  /******************************** TRANSFER OWNERSHIP *********************************/
  /*************************************************************************************/
  describe('Transfer ownership', () => {
    it('Should revert when the sender is not the current owner of the contract', async () => {
      await expect(
        availableRootsRegistry.connect(attacker).transferOwnership(attacker.address)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('Should revert when the newOwner is a zero address', async () => {
      await expect(
        availableRootsRegistry
          .connect(availableRootsRegistryOwner)
          .transferOwnership(ethers.constants.AddressZero)
      ).to.be.revertedWith('Ownable: new owner is the zero address');
    });

    it('Should transfer the ownership', async () => {
      await availableRootsRegistry
        .connect(availableRootsRegistryOwner)
        .transferOwnership(secondDeployer.address);

      expect(await await availableRootsRegistry.owner()).to.equal(secondDeployer.address);
    });
  });

  /*************************************************************************************/
  /******************************** RENOUNCE OWNERSHIP *********************************/
  /*************************************************************************************/
  describe('Renounce ownership', () => {
    before(async () => {
      await availableRootsRegistry.connect(secondDeployer).transferOwnership(deployer.address);
    });

    it('Should revert when the sender is not the current owner of the contract', async () => {
      await expect(availableRootsRegistry.connect(attacker).renounceOwnership()).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });

    it('Should renounce the ownership', async () => {
      await expect(
        availableRootsRegistry
          .connect(await impersonateAddress(hre, await availableRootsRegistry.owner()))
          .renounceOwnership()
      )
        .to.emit(availableRootsRegistry, 'OwnershipTransferred')
        .withArgs(deployer.address, ethers.constants.AddressZero);
    });
  });
});
