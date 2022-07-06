import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { CommitmentMapperTester } from '@sismo-core/commitment-mapper-tester-js';
import { EddsaPublicKey } from '@sismo-core/hydra-s1';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import hre, { ethers } from 'hardhat';
import { DeployedCommitmentMapper } from 'tasks/deploy-tasks/unit/periphery/deploy-commitment-mapper-registry.task';
import { CommitmentMapperRegistry } from 'types';

describe('Test CommitmentMapperRegistry contract', () => {
  let deployer: SignerWithAddress;
  let secondDeployer: SignerWithAddress;
  let attacker: SignerWithAddress;
  let randomCommitmentMapper: SignerWithAddress;

  let commitmentMapperPubKey: EddsaPublicKey;

  let commitmentMapperRegistry: CommitmentMapperRegistry;
  let secondCommitmentMapperRegistry: CommitmentMapperRegistry;

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
      ({ commitmentMapperRegistry } = (await hre.run('deploy-commitment-mapper-registry', {
        commitmentMapperPubKeyX: BigNumber.from(0).toHexString(),
        commitmentMapperPubKeyY: BigNumber.from(0).toHexString(),
      })) as DeployedCommitmentMapper);

      ({ commitmentMapperRegistry: secondCommitmentMapperRegistry } = (await hre.run(
        'deploy-commitment-mapper-registry',
        {
          commitmentMapperPubKeyX: BigNumber.from(0).toHexString(),
          commitmentMapperPubKeyY: BigNumber.from(0).toHexString(),
          commitmentMapperAddress: randomCommitmentMapper.address,
          owner: secondDeployer.address,
        }
      )) as DeployedCommitmentMapper);

      // 0 - Checks that the owner is set to the deployer address
      expect(await commitmentMapperRegistry.owner()).to.equal(deployer.address);
      expect(await secondCommitmentMapperRegistry.owner()).to.equal(secondDeployer.address);

      // 1 - Checks that the commitment mapper address is registered on the address zero (default value)
      expect(await commitmentMapperRegistry.getAddress()).to.be.equal(ethers.constants.AddressZero);
      expect(await secondCommitmentMapperRegistry.getAddress()).to.be.equal(
        randomCommitmentMapper.address
      );

      // 2 - Checks that the eddsa public key is initialized on [0x0, 0x0]
      expect(await commitmentMapperRegistry.getEdDSAPubKey()).to.be.eql([
        BigNumber.from(0),
        BigNumber.from(0),
      ]);
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
      const updateCommitmentMapperEdDsaPubKeyTransaction =
        await commitmentMapperRegistry.updateCommitmentMapperEdDSAPubKey(commitmentMapperPubKey);

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
      const updateCommitmentMapperAddressTransaction =
        await commitmentMapperRegistry.updateCommitmentMapperAddress(
          randomCommitmentMapper.address
        );

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
        commitmentMapperRegistry.transferOwnership(ethers.constants.AddressZero)
      ).to.be.revertedWith('Ownable: new owner is the zero address');
    });

    it('Should transfer the ownership', async () => {
      await expect(commitmentMapperRegistry.transferOwnership(secondDeployer.address))
        .to.emit(commitmentMapperRegistry, 'OwnershipTransferred')
        .withArgs(deployer.address, secondDeployer.address);
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
