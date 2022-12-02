import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { CommitmentMapperTester } from '@sismo-core/commitment-mapper-tester-js';
import { EddsaPublicKey } from '@sismo-core/hydra-s1';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import hre, { ethers } from 'hardhat';
import { Deployed5 } from 'tasks/deploy-tasks/full/5-upgrade-proxies-with-reinitializer.task';
import { evmSnapshot, impersonateAddress } from '../../../../test/utils';
import { deploymentsConfig } from '../../../../tasks/deploy-tasks/deployments-config';
import { DeployedCommitmentMapper } from '../../../../tasks/deploy-tasks/unit/periphery/deploy-commitment-mapper-registry.task';
import {
  CommitmentMapperRegistry,
  CommitmentMapperRegistry__factory,
  TransparentUpgradeableProxy__factory,
} from '../../../../types';
import { getImplementation } from '../../../../utils';

describe('Test CommitmentMapperRegistry contract', () => {
  let deployer: SignerWithAddress;
  let secondDeployer: SignerWithAddress;
  let attacker: SignerWithAddress;
  let randomCommitmentMapper: SignerWithAddress;
  let commitmentMapperRegistryOwner: SignerWithAddress;

  let commitmentMapperPubKey: EddsaPublicKey;

  let commitmentMapperRegistry: CommitmentMapperRegistry;
  let secondCommitmentMapperRegistry: CommitmentMapperRegistry;

  let snapshotId: string;

  const config = deploymentsConfig[process.env.FORK_NETWORK ?? hre.network.name];

  before(async () => {
    const signers = await hre.ethers.getSigners();
    [deployer, secondDeployer, attacker, randomCommitmentMapper] = signers;

    // 1 - Init the commitment mapper
    const commitmentMapper = await CommitmentMapperTester.generate();
    commitmentMapperPubKey = await commitmentMapper.getPubKey();
  });

  /*************************************************************************************/
  /********************************** DEPLOYMENTS **************************************/
  /*************************************************************************************/
  describe('Deployments', () => {
    it('Should deploy, setup and test the constructed values of the contract', async () => {
      commitmentMapperRegistry = (await CommitmentMapperRegistry__factory.connect(
        config.commitmentMapper.address,
        await impersonateAddress(hre, config.commitmentMapper.owner)
      )) as CommitmentMapperRegistry;
    });
  });

  describe('Update Implementation', () => {
    it('Should run the upgrade script', async () => {
      await impersonateAddress(
        hre,
        config.deployOptions.proxyAdmin ?? config.synapsPythia1SimpleAttester.owner
      );

      ({ commitmentMapperRegistry } = await hre.run('5-upgrade-proxies-with-reinitializer', {
        options: { manualConfirm: false, log: false },
      })) as Deployed5;

      commitmentMapperRegistryOwner = await impersonateAddress(
        hre,
        await commitmentMapperRegistry.owner(),
        true
      );

      snapshotId = await evmSnapshot(hre);
    });
  });

  describe('Configuration checks', () => {
    it('should check the proxy address is unchanged', async () => {
      expect(commitmentMapperRegistry.address).to.be.equal(config.commitmentMapper.address);
    });

    it("should check that the contract's owner is the deployer", async () => {
      expect(await commitmentMapperRegistry.owner()).to.equal(config.commitmentMapper.owner);
    });

    it('should check that the commitment mapper address is registered on the correct address (0x0)', async () => {
      // 1 - Checks that the commitment mapper address is registered on the address zero (default value)
      expect(await commitmentMapperRegistry.getAddress()).to.be.equal(ethers.constants.AddressZero);
    });

    it('should check that the eddsa public key is correct', async () => {
      expect(await commitmentMapperRegistry.getEdDSAPubKey()).to.be.eql([
        BigNumber.from(config.commitmentMapper.EdDSAPubKeyX),
        BigNumber.from(config.commitmentMapper.EdDSAPubKeyY),
      ]);
    });

    it('Should revert when trying to call initialize again', async () => {
      await expect(
        commitmentMapperRegistry
          .connect(deployer)
          .initialize(deployer.address, commitmentMapperPubKey, randomCommitmentMapper.address)
      ).to.be.revertedWith('Initializable: contract is already initialized');
    });
  });

  /*************************************************************************************/
  /********************** UPDATE COMMITMENT MAPPER EDDSA PUB KEY ***********************/
  /*************************************************************************************/
  describe('Update commitment mapper EdDSA pub key', () => {
    it('Should revert when the sender is not the owner of the contract', async () => {
      await expect(
        commitmentMapperRegistry
          .connect(attacker)
          .updateCommitmentMapperEdDSAPubKey(commitmentMapperPubKey)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('Should update the EdDSA pub key', async () => {
      const updateCommitmentMapperEdDsaPubKeyTransaction = await commitmentMapperRegistry
        .connect(commitmentMapperRegistryOwner)
        .updateCommitmentMapperEdDSAPubKey(commitmentMapperPubKey);

      // 1 - Checks that the transaction emitted the event
      await expect(updateCommitmentMapperEdDsaPubKeyTransaction)
        .to.emit(commitmentMapperRegistry, 'UpdatedCommitmentMapperEdDSAPubKey')
        .withArgs(commitmentMapperPubKey);

      // 2 - Checks that the eddsa public key matches the one provided
      expect(await commitmentMapperRegistry.getEdDSAPubKey()).to.eql(commitmentMapperPubKey);
    });
  });

  /*************************************************************************************/
  /************************* UPDATE COMMITMENT MAPPER ADDRESS **************************/
  /*************************************************************************************/
  describe('Update commitment mapper address', () => {
    it('Should revert when the sender is not the owner of the contract', async () => {
      await expect(
        commitmentMapperRegistry
          .connect(attacker)
          .updateCommitmentMapperAddress(randomCommitmentMapper.address)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('Should update the mapper address', async () => {
      const updateCommitmentMapperAddressTransaction = await commitmentMapperRegistry
        .connect(commitmentMapperRegistryOwner)
        .updateCommitmentMapperAddress(randomCommitmentMapper.address);

      // 1 - Checks that the transaction emitted the event
      await expect(updateCommitmentMapperAddressTransaction)
        .to.emit(commitmentMapperRegistry, 'UpdatedCommitmentMapperAddress')
        .withArgs(randomCommitmentMapper.address);

      // 2 - Checks that the commitment mapper address matches the random commitment mapper address
      expect(await commitmentMapperRegistry.getAddress()).to.be.equal(
        randomCommitmentMapper.address
      );
    });
  });

  /*************************************************************************************/
  /******************************** TRANSFER OWNERSHIP *********************************/
  /*************************************************************************************/
  describe('Transfer ownership', () => {
    it('Should revert when the sender is not the current owner of the contract', async () => {
      await expect(
        commitmentMapperRegistry.connect(attacker).transferOwnership(attacker.address)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('Should revert when the newOwner is a zero address', async () => {
      await expect(
        commitmentMapperRegistry
          .connect(commitmentMapperRegistryOwner)
          .transferOwnership(ethers.constants.AddressZero)
      ).to.be.revertedWith('Ownable: new owner is the zero address');
    });

    it('Should transfer the ownership', async () => {
      await expect(
        commitmentMapperRegistry
          .connect(commitmentMapperRegistryOwner)
          .transferOwnership(secondDeployer.address)
      )
        .to.emit(commitmentMapperRegistry, 'OwnershipTransferred')
        .withArgs(config.commitmentMapper.owner, secondDeployer.address);
    });
  });

  /*************************************************************************************/
  /******************************** RENOUNCE OWNERSHIP *********************************/
  /*************************************************************************************/
  describe('Renounce ownership', () => {
    before(async () => {
      await commitmentMapperRegistry.connect(secondDeployer).transferOwnership(deployer.address);
    });

    it('Should revert when the sender is not the current owner of the contract', async () => {
      await expect(
        commitmentMapperRegistry.connect(attacker).renounceOwnership()
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('Should renounce the ownership', async () => {
      await expect(commitmentMapperRegistry.renounceOwnership())
        .to.emit(commitmentMapperRegistry, 'OwnershipTransferred')
        .withArgs(deployer.address, ethers.constants.AddressZero);
    });
  });
});
