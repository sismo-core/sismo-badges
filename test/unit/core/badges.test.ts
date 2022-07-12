import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import hre, { ethers } from 'hardhat';
import { deploymentsConfig } from '../../../tasks/deploy-tasks/deployments-config';
import {
  AttestationsRegistry,
  Badges,
  MockAttestationsRegistry,
  TransparentUpgradeableProxy__factory,
} from '../../../types';
import { getImplementation } from '../../../utils';

describe('Test Badges contract', () => {
  let deployer: SignerWithAddress;
  let secondDeployer: SignerWithAddress;
  let admin: SignerWithAddress;
  let notAdmin: SignerWithAddress;
  let user: SignerWithAddress;
  let issuer: SignerWithAddress;
  let eoaAttestationsRegistry: SignerWithAddress;
  let roles: { admin: string; event_trigger: string };

  let attestationsRegistry: AttestationsRegistry;
  let mockAttestationsRegistry: MockAttestationsRegistry;
  let badges: Badges;
  let secondBadges: Badges;

  before(async () => {
    [deployer, secondDeployer, admin, notAdmin, user, issuer, eoaAttestationsRegistry] =
      await ethers.getSigners();
  });

  /*************************************************************************************/
  /********************************** DEPLOYMENTS **************************************/
  /*************************************************************************************/
  describe('Deployments', () => {
    it('Should deploy, setup and test the constructed values of the contract', async () => {
      ({ attestationsRegistry, badges } = await hre.run('deploy-core', {
        uri: 'https://token_cdn.domain/',
        frontFirstCollectionId: '1',
        frontLastCollectionId: '2',
      }));

      ({ badges: secondBadges } = await hre.run('deploy-badges', {
        uri: 'https://token_cdn.domain/',
        owner: secondDeployer.address,
      }));

      ({ mockAttestationsRegistry } = await hre.run('deploy-mock-attestations-registry', {
        attestationValue: 1,
        options: {
          behindProxy: false,
        },
      }));

      roles = {
        admin: await badges.DEFAULT_ADMIN_ROLE(),
        event_trigger: await badges.EVENT_TRIGGERER_ROLE(),
      };

      // 0 - Checks that the role owner is set to the deployer address
      expect(await badges.hasRole(roles.admin, deployer.address)).to.be.true;
      expect(await secondBadges.hasRole(roles.admin, secondDeployer.address)).to.be.true;
    });
  });

  /*************************************************************************************/
  /***************************** SET ATTESTATIONS REGISTRY *****************************/
  /*************************************************************************************/
  describe('Set Attestations Registry', () => {
    it('Should revert when the sender has not the admin role', async () => {
      await expect(
        badges.connect(notAdmin).setAttestationsRegistry(attestationsRegistry.address)
      ).to.be.revertedWith(
        `AccessControl: account ${notAdmin.address.toLowerCase()} is missing role ${roles.admin}`
      );
    });

    it('Should set the attestations registry', async () => {
      await badges.setAttestationsRegistry(attestationsRegistry.address);

      expect(await badges.getAttestationsRegistry()).to.equal(attestationsRegistry.address);
    });

    it('Should set the mock attestations registry', async () => {
      await badges.setAttestationsRegistry(mockAttestationsRegistry.address);

      expect(await badges.getAttestationsRegistry()).to.equal(mockAttestationsRegistry.address);
    });
  });

  /*************************************************************************************/
  /************************************** SET URI **************************************/
  /*************************************************************************************/
  describe('Set URI', () => {
    it('Should revert when the sender has not the admin role', async () => {
      await expect(badges.connect(notAdmin).setUri('https://token_cdn.domain/')).to.be.revertedWith(
        `AccessControl: account ${notAdmin.address.toLowerCase()} is missing role ${roles.admin}`
      );
    });

    it('Should set the URI', async () => {
      await badges.setUri('https://token_cdn.domain/{id}.json');

      expect(await badges.uri(0)).to.equal('https://token_cdn.domain/{id}.json');
    });
  });

  /*************************************************************************************/
  /************************************* GRANT ROLE ************************************/
  /*************************************************************************************/
  describe('Grant Role', async () => {
    it('Should revert when the sender has not the admin role', async () => {
      await expect(
        badges.connect(notAdmin).grantRole(roles.admin, deployer.address)
      ).to.be.revertedWith(
        `AccessControl: account ${notAdmin.address.toLowerCase()} is missing role ${roles.admin}`
      );
    });

    it('Should grant the default admin role to the address', async () => {
      await badges.grantRole(roles.admin, admin.address);

      expect(await badges.hasRole(roles.admin, admin.address)).to.be.true;
    });

    it('Should grant the custom defined event trigger role to the attestations registry and the eoa attestations registry', async () => {
      await badges.grantRole(roles.event_trigger, attestationsRegistry.address);
      await badges.grantRole(roles.event_trigger, eoaAttestationsRegistry.address);

      expect(await badges.hasRole(roles.event_trigger, attestationsRegistry.address)).to.be.true;
      expect(await badges.hasRole(roles.event_trigger, eoaAttestationsRegistry.address)).to.be.true;
    });
  });

  /*************************************************************************************/
  /******************************* TRIGGER TRANSFER EVENT ******************************/
  /*************************************************************************************/
  describe('Trigger transfer event', async () => {
    const badgeId = 3;
    const transferredAmount = 1;

    it('Should revert when the sender has not the event trigger role', async () => {
      await expect(
        badges.triggerTransferEvent(
          attestationsRegistry.address,
          ethers.constants.AddressZero,
          user.address,
          badgeId,
          transferredAmount
        )
      ).to.be.revertedWith(
        `AccessControl: account ${deployer.address.toLowerCase()} is missing role ${roles.event_trigger.toLowerCase()}`
      );
    });

    it('Should revert when the sender is an admin', async () => {
      await expect(
        badges
          .connect(admin)
          .triggerTransferEvent(
            attestationsRegistry.address,
            ethers.constants.AddressZero,
            user.address,
            badgeId,
            transferredAmount
          )
      ).to.be.revertedWith(
        `AccessControl: account ${admin.address.toLowerCase()} is missing role ${
          roles.event_trigger
        }`
      );
    });

    it('Should execute and emit a TransferSingle event', async () => {
      const mockTriggerTransferEventTransaction = await badges
        .connect(eoaAttestationsRegistry)
        .triggerTransferEvent(
          eoaAttestationsRegistry.address,
          ethers.constants.AddressZero,
          user.address,
          badgeId,
          transferredAmount
        );

      await expect(mockTriggerTransferEventTransaction)
        .to.emit(badges, 'TransferSingle')
        .withArgs(
          eoaAttestationsRegistry.address,
          ethers.constants.AddressZero,
          user.address,
          badgeId,
          transferredAmount
        );
    });
  });

  /*************************************************************************************/
  /************************************** TRANSFERS ************************************/
  /*************************************************************************************/
  describe('Transfers', () => {
    describe('Safe Transfer Single', async () => {
      it('Should revert because the operation is not allowed', async () => {
        await expect(
          badges.connect(user).safeTransferFrom(user.address, admin.address, 3, 1, [])
        ).to.be.revertedWith('BadgesNonTransferrable()');
      });
    });

    describe('Safe Transfer Batch', () => {
      it('Should revert because the operation is not allowed', async () => {
        await expect(
          badges
            .connect(user)
            .safeBatchTransferFrom(user.address, admin.address, [3, 4], [1, 1], [])
        ).to.be.revertedWith('BadgesNonTransferrable()');
      });
    });
  });

  describe('Approvals', () => {
    describe('isApprovedForAll', () => {
      it('Should revert because the operation is not allowed', async () => {
        await expect(
          badges.connect(user).isApprovedForAll(user.address, admin.address)
        ).to.be.revertedWith('BadgesNonTransferrable()');
      });
    });

    describe('setApprovalForAll', () => {
      it('Should revert because the operation is not allowed', async () => {
        await expect(badges.connect(user).setApprovalForAll(user.address, true)).to.be.revertedWith(
          'BadgesNonTransferrable()'
        );
      });
    });
  });

  /*************************************************************************************/
  /************************************ REVOKE ROLE ************************************/
  /*************************************************************************************/
  describe('Revoke role', async () => {
    it('Should revert when the sender has not the admin role', async () => {
      await expect(
        badges.connect(notAdmin).revokeRole(roles.admin, admin.address)
      ).to.be.revertedWith(
        `AccessControl: account ${notAdmin.address.toLowerCase()} is missing role ${roles.admin}`
      );
    });

    it('Should revoke the custom defined event trigger role from the attestations registry and the mock attestations registry', async () => {
      const revokeMockAttestationsRegistryRoleTransaction = await badges.revokeRole(
        roles.event_trigger,
        eoaAttestationsRegistry.address
      );
      const revokeAttestationsRegistryRoleTransaction = await badges.revokeRole(
        roles.event_trigger,
        attestationsRegistry.address
      );

      await expect(revokeMockAttestationsRegistryRoleTransaction)
        .to.emit(badges, 'RoleRevoked')
        .withArgs(roles.event_trigger, eoaAttestationsRegistry.address, deployer.address);
      await expect(revokeAttestationsRegistryRoleTransaction)
        .to.emit(badges, 'RoleRevoked')
        .withArgs(roles.event_trigger, attestationsRegistry.address, deployer.address);

      expect(await badges.hasRole(roles.event_trigger, eoaAttestationsRegistry.address)).to.be
        .false;
      expect(await badges.hasRole(roles.event_trigger, attestationsRegistry.address)).to.be.false;
    });

    it('Should revoke the admin role of the admin', async () => {
      const revokeRoleTransaction = await badges.revokeRole(roles.admin, admin.address);

      await expect(revokeRoleTransaction)
        .to.emit(badges, 'RoleRevoked')
        .withArgs(roles.admin, admin.address, deployer.address);

      await expect(await badges.hasRole(roles.admin, admin.address)).to.be.false;
    });
  });

  /*************************************************************************************/
  /********************************** RENOUNCE ROLE ************************************/
  /*************************************************************************************/
  describe('Renounce Role', async () => {
    before(async () => {
      await badges.grantRole(roles.admin, admin.address);
    });

    it('Should revert when the sender is not the one provided in parameters', async () => {
      await expect(
        badges.connect(notAdmin).renounceRole(roles.admin, admin.address)
      ).to.be.revertedWith(`AccessControl: can only renounce roles for self`);
    });

    it('Should revoke the admin role of the admin', async () => {
      const renounceRoleTransaction = await badges
        .connect(admin)
        .renounceRole(roles.admin, admin.address);

      await expect(renounceRoleTransaction)
        .to.emit(badges, 'RoleRevoked')
        .withArgs(roles.admin, admin.address, admin.address);

      await expect(await badges.hasRole(roles.admin, admin.address)).to.be.false;
    });
  });

  /*************************************************************************************/
  /******************************* UPDATE IMPLEMENTATION *******************************/
  /*************************************************************************************/
  describe('Update implementation', () => {
    it('Should update the implementation', async () => {
      const proxyAdminSigner = await ethers.getSigner(
        deploymentsConfig[hre.network.name].deployOptions.proxyAdmin as string
      );

      const { badges: newBadges } = await hre.run('deploy-badges', {
        uri: 'https://token_cdn.domain/',
        owner: secondDeployer.address,
        options: { behindProxy: false },
      });
      const badgesProxy = TransparentUpgradeableProxy__factory.connect(
        badges.address,
        proxyAdminSigner
      );

      await (await badgesProxy.upgradeTo(newBadges.address)).wait();

      const implementationAddress = await getImplementation(badgesProxy);
      expect(implementationAddress).to.eql(newBadges.address);
    });
  });
});
