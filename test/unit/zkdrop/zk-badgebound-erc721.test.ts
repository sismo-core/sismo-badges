import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { EddsaPublicKey, HydraS1Account, KVMerkleTree } from '@sismo-core/hydra-s1';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import hre, { ethers } from 'hardhat';
import { deploymentsConfig } from '../../../tasks/deploy-tasks/deployments-config';
import { getImplementation } from '../../../utils';
import {
  checkAccountHoldsBadge,
  checkAttestationIsWellRegistered,
  deployCoreContracts,
  mintBadge,
  registerRootForAttester,
} from '../../utils/test-helpers';
import {
  AttestationsRegistry,
  AvailableRootsRegistry,
  Badges,
  HydraS1AccountboundAttester,
  TransparentUpgradeableProxy__factory,
  ZKBadgeboundERC721,
} from '../../../types';
import {
  evmRevert,
  evmSnapshot,
  HydraS1SimpleGroup,
  generateProvingData,
  HydraS1ZKPS,
  increaseTime,
} from '../../utils';

describe('Test ZK Badgebound ERC721 Contract', async () => {
  let attestationsRegistry: AttestationsRegistry;
  let hydraS1AccountboundAttester: HydraS1AccountboundAttester;
  let availableRootsRegistry: AvailableRootsRegistry;
  let badges: Badges;
  let zkBadgeboundERC721: ZKBadgeboundERC721;

  let accountsSigners: SignerWithAddress[];
  let deployer: SignerWithAddress;
  let account1Signer: SignerWithAddress;
  let account2Signer: SignerWithAddress;
  let account3Signer: SignerWithAddress;
  let account4Signer: SignerWithAddress;
  let account5Signer: SignerWithAddress;

  let accounts: HydraS1Account[];
  let account1: HydraS1Account;
  let account2: HydraS1Account;
  let account3: HydraS1Account;
  let account4: HydraS1Account;
  let account5: HydraS1Account;
  let zeroAddress: string;

  let accountsTreesWithData: { tree: KVMerkleTree; group: HydraS1SimpleGroup }[];
  let registryTree: KVMerkleTree;
  let groups: HydraS1SimpleGroup[];
  let commitmentMapperPubKey: EddsaPublicKey;

  let provingScheme: HydraS1ZKPS;

  let cooldownDuration: number;
  let evmSnapshotId: string;
  let resetStateSnapshotId: string;
  let chainId: number;

  let badgeId: BigNumber;
  let badgeId2: BigNumber;

  let roles: { admin: string };

  before(async () => {
    chainId = parseInt(await hre.getChainId());

    // create two groups in the merkle tree with respectively all values of 1 and 2
    ({ accountsTreesWithData, registryTree, groups, accounts, commitmentMapperPubKey } =
      await generateProvingData({
        nbOfGroups: 2,
      }));

    cooldownDuration = 60 * 60 * 24;

    // data to reuse everywhere

    accountsSigners = await ethers.getSigners();

    deployer = accountsSigners[0];
    account1Signer = accountsSigners[1];
    account2Signer = accountsSigners[2];
    account3Signer = accountsSigners[3];
    account4Signer = accountsSigners[4];
    account5Signer = accountsSigners[5];

    account1 = accounts[1];
    account2 = accounts[2];
    account3 = accounts[3];
    account4 = accounts[4];
    account5 = accounts[5];

    zeroAddress = '0x0000000000000000000000000000000000000000';
  });

  /*************************************************************************************/
  /********************************** DEPLOYMENTS **************************************/
  /*************************************************************************************/
  describe('Deployments', () => {
    it('Should deploy, setup contracts, the proving scheme and test the constructed values of the contract', async () => {
      ({ attestationsRegistry, hydraS1AccountboundAttester, badges, availableRootsRegistry } =
        await deployCoreContracts(deployer, {
          deploymentNamePrefix: 'zk-badgebound-erc721',
        }));

      badgeId = (await hydraS1AccountboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()).add(
        groups[0].properties.groupIndex
      );

      badgeId2 = (await hydraS1AccountboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()).add(
        groups[1].properties.groupIndex
      );

      ({ zkBadgeboundERC721 } = await hre.run('deploy-zk-badgebound-erc721', {
        name: 'Ziki Pass',
        symbol: 'ZKP',
        tokenURI: 'https://test.com/zikipass',
        gatingBadgeTokenId: badgeId.toString(),
        admin: deployer.address,
        options: { deploymentNamePrefix: 'zk-badgebound-erc721' },
      }));

      await registerRootForAttester(
        availableRootsRegistry,
        hydraS1AccountboundAttester,
        registryTree
      );

      await hydraS1AccountboundAttester.setCooldownDurationForGroupIndex(
        groups[0].properties.groupIndex,
        cooldownDuration
      );

      roles = {
        admin: await zkBadgeboundERC721.DEFAULT_ADMIN_ROLE(),
      };

      // set up the proving scheme
      provingScheme = new HydraS1ZKPS({
        accountsTreesWithData,
        registryTree,
        groups,
        defaultAttester: hydraS1AccountboundAttester,
        commitmentMapperPubKey,
        chainId,
      });
    });

    it('should check the contract configuration', async () => {
      expect(await zkBadgeboundERC721.name()).to.be.eql('Ziki Pass');
      expect(await zkBadgeboundERC721.symbol()).to.equal('ZKP');
      expect(await zkBadgeboundERC721.GATING_BADGE_TOKEN_ID()).to.be.eql(badgeId);
      expect(await zkBadgeboundERC721.tokenURI(0)).to.be.eql('https://test.com/zikipass');
    });
  });

  describe('Access Control', async () => {
    it('Should check roles', async () => {
      expect(await zkBadgeboundERC721.hasRole(roles.admin, deployer.address)).to.be.true;
    });

    it('Should revert when the sender has not the admin role', async () => {
      await expect(
        zkBadgeboundERC721.connect(account5Signer).setBaseTokenUri('https://other-test-domain.com/')
      ).to.be.revertedWith(
        `AccessControl: account ${account5Signer.address.toLowerCase()} is missing role ${
          roles.admin
        }`
      );
    });

    it('Should set the URI', async () => {
      const tx = await zkBadgeboundERC721
        .connect(deployer)
        .setBaseTokenUri('https://other-test-domain.com/');

      await expect(tx)
        .to.emit(zkBadgeboundERC721, 'BaseTokenUriChanged')
        .withArgs('https://other-test-domain.com/');
    });

    it('Should revert when pause() is triggered with no admin role', async () => {
      await expect(zkBadgeboundERC721.connect(account5Signer).pause()).to.be.revertedWith(
        `AccessControl: account ${account5Signer.address.toLowerCase()} is missing role ${
          roles.admin
        }`
      );
    });

    it('Should pause the contract and unpause', async () => {
      await zkBadgeboundERC721.connect(deployer).pause();

      expect(await zkBadgeboundERC721.paused()).to.be.true;
      await zkBadgeboundERC721.connect(deployer).unpause();
      expect(await zkBadgeboundERC721.paused()).to.be.false;
    });

    it('Should grant admin role', async () => {
      await zkBadgeboundERC721.connect(deployer).grantRole(roles.admin, account5Signer.address);
      expect(await zkBadgeboundERC721.hasRole(roles.admin, account5Signer.address)).to.be.true;
    });

    it('Should revoke admin role', async () => {
      await zkBadgeboundERC721.connect(account5Signer).revokeRole(roles.admin, deployer.address);
      expect(await zkBadgeboundERC721.hasRole(roles.admin, deployer.address)).to.be.false;
    });
  });

  describe('Scenario 1: mint badge, mint NFT, transfer badge and then transfer NFT. Prevent to mint again.', () => {
    it('source 0x1 mints the ZK Badge on dest 0x2 for the first time (same user controls 0x1 and 0x2)', async () => {
      resetStateSnapshotId = await evmSnapshot(hre);

      await mintBadge({
        sources: [account1],
        destination: account2,
        provingScheme,
      });
    });

    it('dest 0x2 should not be able to mint the ERC721 since the contract is paused', async () => {
      await zkBadgeboundERC721.connect(account5Signer).pause();
      expect(await zkBadgeboundERC721.paused()).to.be.true;
      await expect(zkBadgeboundERC721.connect(account2Signer).claim()).to.be.revertedWith(
        'NoTokenTransferWhilePaused()'
      );
      await zkBadgeboundERC721.connect(account5Signer).unpause();
    });

    it('dest 0x2 should NOT be able to mint the ERC721 on 0x3 without proof', async () => {
      await mintBadge({
        sources: [account1],
        destination: account2,
        provingScheme,
        isDestinationAlreadyHoldingTheBadge: true,
      });

      await checkAccountHoldsBadge(account2Signer.address, badgeId, true);

      await expect(
        zkBadgeboundERC721.connect(account2Signer).claimTo(account3Signer.address)
      ).to.be.revertedWith('UserDoesNotMeetRequirements()');
    });

    it('dest 0x2 should be able to mint the ERC721 on 0x2 (by calling `claim`)', async () => {
      evmSnapshotId = await evmSnapshot(hre);
      await checkAccountHoldsBadge(account2Signer.address, badgeId);

      expect(await zkBadgeboundERC721.balanceOf(account2Signer.address)).to.be.eql(
        BigNumber.from(0)
      );

      await zkBadgeboundERC721.connect(account2Signer).claim();

      expect(await zkBadgeboundERC721.balanceOf(account2Signer.address)).to.be.eql(
        BigNumber.from(1)
      );

      await evmRevert(hre, evmSnapshotId);
    });

    it('dest 0x2 should be able to mint the ERC721 on 0x2 (by calling `claimTo`)', async () => {
      await checkAccountHoldsBadge(account2Signer.address, badgeId);

      expect(await zkBadgeboundERC721.balanceOf(account2Signer.address)).to.be.eql(
        BigNumber.from(0)
      );

      await zkBadgeboundERC721.connect(account2Signer).claimTo(account2Signer.address);

      expect(await zkBadgeboundERC721.balanceOf(account2Signer.address)).to.be.eql(
        BigNumber.from(1)
      );
    });

    it('source 0x1 transfers the ZK Badge from dest 0x2 to dest 0x3 (same user controls source 0x1, dest 0x2 and dest 0x3)', async () => {
      // 1 - Transfers the badge from 0x2 to 0x3
      await mintBadge({
        sources: [account1],
        destination: account3,
        provingScheme,
        expectedBurnCount: 1,
      });

      // 2 - Checks that 0x2 does not have the badge anymore
      await checkAccountHoldsBadge(account2Signer.address, badgeId, false);
    });

    it('0x3 should NOT be able to mint the ERC721 (one ERC721 per source, using `claim`)', async () => {
      await expect(zkBadgeboundERC721.connect(account3Signer).claim()).to.be.revertedWith(
        'ERC721: token already minted'
      );
    });

    it('0x3 should NOT be able to mint the ERC721 (one ERC721 per source, using `claimTo`)', async () => {
      await expect(
        zkBadgeboundERC721.connect(account3Signer).claimTo(account3Signer.address)
      ).to.be.revertedWith('ERC721: token already minted');
    });

    it('0x2 should be able to transfer the ERC721 from 0x2 to 0x3 (using `safeTransferFrom`)', async () => {
      evmSnapshotId = await evmSnapshot(hre);

      const { nullifier: nullifierFrom0x1 } = await provingScheme.generateProof({
        sources: [account1],
        destination: account3,
      });

      expect(await zkBadgeboundERC721.ownerOf(nullifierFrom0x1)).to.be.eql(account2Signer.address);

      expect(await zkBadgeboundERC721.balanceOf(account3Signer.address)).to.be.eql(
        BigNumber.from(0)
      );

      await zkBadgeboundERC721
        .connect(account2Signer)
        ['safeTransferFrom(address,address,uint256)'](
          account2Signer.address,
          account3Signer.address,
          nullifierFrom0x1
        );

      expect(await zkBadgeboundERC721.ownerOf(nullifierFrom0x1)).to.be.eql(account3Signer.address);

      expect(await zkBadgeboundERC721.balanceOf(account2Signer.address)).to.be.eql(
        BigNumber.from(0)
      );

      expect(await zkBadgeboundERC721.balanceOf(account3Signer.address)).to.be.eql(
        BigNumber.from(1)
      );

      await evmRevert(hre, evmSnapshotId);
    });

    it('0x2 should be able to transfer the ERC721 from 0x2 to 0x3 (using `transferFrom`)', async () => {
      evmSnapshotId = await evmSnapshot(hre);

      const { nullifier: nullifierFrom0x1 } = await provingScheme.generateProof({
        sources: [account1],
        destination: account3,
      });

      expect(await zkBadgeboundERC721.ownerOf(nullifierFrom0x1)).to.be.eql(account2Signer.address);

      expect(await zkBadgeboundERC721.balanceOf(account3Signer.address)).to.be.eql(
        BigNumber.from(0)
      );

      await zkBadgeboundERC721
        .connect(account2Signer)
        .transferFrom(account2Signer.address, account3Signer.address, nullifierFrom0x1);

      expect(await zkBadgeboundERC721.ownerOf(nullifierFrom0x1)).to.be.eql(account3Signer.address);

      expect(await zkBadgeboundERC721.balanceOf(account2Signer.address)).to.be.eql(
        BigNumber.from(0)
      );

      expect(await zkBadgeboundERC721.balanceOf(account3Signer.address)).to.be.eql(
        BigNumber.from(1)
      );
    });

    it('0x3 should be able to transfer ERC721 from 0x3 to any destination with a valid proof of ownership of 0x1 and new destination (badge will be also transferred)', async () => {
      increaseTime(hre, cooldownDuration);

      const {
        request,
        proofData,
        nullifier: nullifierFrom0x1,
      } = await provingScheme.generateProof({
        sources: [account1],
        destination: account4,
      });

      expect(await zkBadgeboundERC721.ownerOf(nullifierFrom0x1)).to.be.eql(account3Signer.address);

      expect(await zkBadgeboundERC721.balanceOf(account4Signer.address)).to.be.eql(
        BigNumber.from(0)
      );

      const transferTx = await zkBadgeboundERC721
        .connect(account3Signer)
        .transferWithSismo(
          account3Signer.address,
          account4Signer.address,
          nullifierFrom0x1,
          request,
          proofData
        );

      // it should transfer the nft to the new destination
      expect(await zkBadgeboundERC721.ownerOf(nullifierFrom0x1)).to.be.eql(account4Signer.address);

      expect(await zkBadgeboundERC721.balanceOf(account3Signer.address)).to.be.eql(
        BigNumber.from(0)
      );

      await checkAttestationIsWellRegistered({
        request,
        nullifier: nullifierFrom0x1,
        expectedBurnCount: 2,
        tx: transferTx,
      });

      // 2 - Checks that 0x3 does NOT hold the badge anymore
      checkAccountHoldsBadge(account3Signer.address, badgeId, false);

      // 3 - Checks that 0x4 holds the badge
      checkAccountHoldsBadge(account4Signer.address, badgeId);

      await evmRevert(hre, resetStateSnapshotId);
    });
  });

  describe('Scenario 2: new badge minting on an address already owning a NFT (with a different nullifier), prevent new nft minting on this address, mint a new nft by transferring the badge first to a new address', async () => {
    it('source 0x1 mints the ZK Badge and the ERC721 on dest 0x2 for the first time with a valid proof of ownership of 0x1 and 0x2', async () => {
      resetStateSnapshotId = await evmSnapshot(hre);

      const {
        request,
        proofData,
        nullifier: nullifierFrom0x1,
      } = await provingScheme.generateProof({
        sources: [account1],
        destination: account2,
      });

      const mintNftTx = await zkBadgeboundERC721.claimWithSismo(request, proofData);

      await checkAttestationIsWellRegistered({
        request,
        nullifier: nullifierFrom0x1,
        tx: mintNftTx,
      });
    });

    it('dest 0x2 should NOT be able to mint the ERC721 again on 0x2', async () => {
      await expect(
        zkBadgeboundERC721.connect(account2Signer).claimTo(account2Signer.address)
      ).to.be.revertedWith('ERC721: token already minted');
    });

    it('source 0x3 should not be able to mint a NFT on dest 0x2 because 0x2 owns an ERC721', async () => {
      expect(await zkBadgeboundERC721.balanceOf(account2Signer.address)).to.be.eql(
        BigNumber.from(1)
      );

      await expect(zkBadgeboundERC721.claimTo(account2Signer.address)).to.be.revertedWith(
        `ERC721: token already minted`
      );
    });

    it('source 0x3 should NOT be able to mint a NFT on dest 0x2 (even with a valid proof) because 0x2 owns an ERC721', async () => {
      const { request, proofData } = await provingScheme.generateProof({
        sources: [account3],
        destination: account2,
      });

      await expect(zkBadgeboundERC721.claimWithSismo(request, proofData)).to.be.revertedWith(
        `ERC721AlreadyOwned("${account2Signer.address}", 1)`
      );
    });

    it('source 0x3 should be able to mint a badge on dest 0x2', async () => {
      const { nullifier: nullifierFrom0x3 } = await mintBadge({
        sources: [account3],
        destination: account2,
        provingScheme,
        isDestinationAlreadyHoldingTheBadge: true,
      });

      // We retrieve the old nullifier to see if it is still the one registered in the extraData of the attestation (should not be the case)
      const nullifierFrom0x1 = await provingScheme.getNullifier({
        sources: [account1], // account1 is the source that was used to mint the ERC721 hold on account2
        destination: account2,
      });

      // We check that the old nullifier is different from the new nullifier
      expect(nullifierFrom0x3).to.not.be.eql(nullifierFrom0x1);

      // We check that the new nullifier is the one registered in the extraData of the attestation
      const extraData = await attestationsRegistry.getAttestationExtraData(
        badgeId,
        account2Signer.address
      );

      expect(await hydraS1AccountboundAttester.getNullifierFromExtraData(extraData)).to.equal(
        nullifierFrom0x3
      );
    });

    it('source 0x3 should not be able to mint a ERC721 on dest 0x2 because 0x2 owns an ERC721 (Even with a new badge on 0x2 with a new nullifier)', async () => {
      expect(await zkBadgeboundERC721.balanceOf(account2Signer.address)).to.be.eql(
        BigNumber.from(1)
      );

      await expect(zkBadgeboundERC721.claimTo(account2Signer.address)).to.be.revertedWith(
        `ERC721AlreadyOwned("${account2Signer.address}", 1)`
      );
    });

    it('source 0x3 should not be able to mint a ERC721 on dest 0x2 because 0x2 owns an ERC721 (even with a valid proof and a new badge)', async () => {
      const { request, proofData } = await provingScheme.generateProof({
        sources: [account3],
        destination: account2,
      });

      await expect(zkBadgeboundERC721.claimWithSismo(request, proofData)).to.be.revertedWith(
        `ERC721AlreadyOwned("${account2Signer.address}", 1)`
      );
    });

    it('source 0x3 should be able to transfer badge3 from 0x2 to 0x3', async () => {
      await mintBadge({
        sources: [account3],
        destination: account3,
        provingScheme,
        expectedBurnCount: 1,
      });

      // 2 - Checks that the attester unrecorded the attestation in the registry
      await checkAccountHoldsBadge(account2Signer.address, badgeId, false);
    });

    it('dest 0x3 should be able to mint a ERC721 on 0x3', async () => {
      expect(await zkBadgeboundERC721.balanceOf(account3Signer.address)).to.be.eql(
        BigNumber.from(0)
      );

      expect(await zkBadgeboundERC721.connect(account3Signer).claim());

      expect(await zkBadgeboundERC721.balanceOf(account3Signer.address)).to.be.eql(
        BigNumber.from(1)
      );

      // we use the same proof request as in the previous test to check that the token Id is indeed the nullifier used for the badge
      const nullifierFrom0x3 = await provingScheme.getNullifier({
        sources: [account3],
        destination: account3,
      });

      expect(await zkBadgeboundERC721.ownerOf(nullifierFrom0x3)).to.be.eql(account3Signer.address);
    });

    it('dest0x2 should NOT be able to transfer the nft1 (minted with nullifier from 0x1) on 0x3', async () => {
      // this nullifier is the tokenId of the nft we want to transfer from 0x2 to 0x3
      const nullifierFrom0x1 = await provingScheme.getNullifier({
        sources: [account1],
        destination: account3,
      });

      // retrieve the nullifier of the badge (nullifier from 0x3) that is also the tokenId of the nft on 0x3
      const nullifierFrom0x3 = await provingScheme.getNullifier({
        sources: [account3],
        destination: account3,
      });

      await expect(
        zkBadgeboundERC721
          .connect(account2Signer)
          .transferFrom(
            account2Signer.address,
            account3Signer.address,
            BigNumber.from(nullifierFrom0x1)
          )
      ).to.be.revertedWith(
        `BadgeNullifierNotEqualToTokenId(${BigNumber.from(nullifierFrom0x3)}, ${BigNumber.from(
          nullifierFrom0x1
        )})'`
      );
    });

    it('dest0x2 should NOT be able to transfer the nft1 on 0x3 even with a valid proof (proof with 0x1 nullifier)', async () => {
      const {
        request,
        proofData,
        nullifier: nullifierFrom0x1,
      } = await provingScheme.generateProof({
        sources: [account1],
        destination: account3,
      });

      await expect(
        zkBadgeboundERC721.transferWithSismo(
          account2Signer.address,
          account3Signer.address,
          nullifierFrom0x1,
          request,
          proofData
        )
      ).to.be.revertedWith(`ERC721AlreadyOwned("${account3Signer.address}", 1)`);
    });

    it('source 0x1 should be able to mint a badge on dest 0x2', async () => {
      evmSnapshotId = await evmSnapshot(hre);

      const { request, proofData } = await provingScheme.generateProof({
        sources: [account1],
        destination: account2,
      });

      // 0x2 should not have the badge yet
      await checkAccountHoldsBadge(account2Signer.address, badgeId, false);

      await hydraS1AccountboundAttester.generateAttestations(request, proofData);

      // 0x2 should have the badge now
      await checkAccountHoldsBadge(account2Signer.address, badgeId);

      await evmRevert(hre, evmSnapshotId);
    });

    it('dest 0x2 should be able to transfer the ERC721 from 0x2 to 0x1 with a valid proof of ownership of 0x1 and 0x2', async () => {
      // 0x1 should not have the badge yet
      await checkAccountHoldsBadge(account1Signer.address, badgeId, false);

      // 0x1 should have no nft
      expect(await zkBadgeboundERC721.balanceOf(account1Signer.address)).to.be.eql(
        BigNumber.from(0)
      );

      const {
        request,
        proofData,
        nullifier: nullifierFrom0x1,
      } = await provingScheme.generateProof({
        sources: [account1],
        destination: account1,
      });

      // 0x2 should have no badge
      await checkAccountHoldsBadge(account2Signer.address, badgeId, false);

      // 0x2 should have the nft
      expect(await zkBadgeboundERC721.ownerOf(nullifierFrom0x1)).to.be.eql(account2Signer.address);

      const transferTx = await zkBadgeboundERC721.transferWithSismo(
        account2Signer.address,
        account1Signer.address,
        nullifierFrom0x1,
        request,
        proofData
      );

      await checkAttestationIsWellRegistered({
        request,
        nullifier: nullifierFrom0x1,
        expectedBurnCount: 1, // for the same reason, the burn count is incremented to 1
        tx: transferTx,
      });

      // 0x1 should have the badge now
      await checkAccountHoldsBadge(account1Signer.address, badgeId);

      // 0x1 should have the nft
      expect(await zkBadgeboundERC721.ownerOf(nullifierFrom0x1)).to.be.eql(account1Signer.address);

      // 0x2 should have no badge
      await checkAccountHoldsBadge(account2Signer.address, badgeId, false);

      // 0x2 should have no nft
      expect(await zkBadgeboundERC721.balanceOf(account2Signer.address)).to.be.eql(
        BigNumber.from(0)
      );

      await evmRevert(hre, resetStateSnapshotId);
    });
  });

  describe('Scenario 3: tests that badges can be minted by several sources on a destination but the nft can only be transferred to the account holding the valid badge (same nullifier) or with a valid proof (same nullifier) ', async () => {
    it('source 0x1 mints the ZK Badge on 0x2 for the first time', async () => {
      resetStateSnapshotId = await evmSnapshot(hre);

      // 0x2 should not have the badge yet
      await checkAccountHoldsBadge(account2Signer.address, badgeId, false);

      await mintBadge({
        sources: [account1],
        destination: account2,
        provingScheme,
      });

      // 0x2 should only have the badge
      expect(await zkBadgeboundERC721.balanceOf(account2Signer.address)).to.be.eql(
        BigNumber.from(0)
      );
    });

    it('dest 0x2 should be able to mint the ERC721', async () => {
      evmSnapshotId = await evmSnapshot(hre);

      const { nullifier: nullifierFrom0x1 } = await provingScheme.generateProof({
        sources: [account1],
        destination: account2,
      });

      await zkBadgeboundERC721.connect(account2Signer).claim();

      // 0x2 should have the nft
      expect(await zkBadgeboundERC721.ownerOf(nullifierFrom0x1)).to.be.eql(account2Signer.address);

      expect(await zkBadgeboundERC721.balanceOf(account2Signer.address)).to.be.eql(
        BigNumber.from(1)
      );

      await evmRevert(hre, evmSnapshotId);
    });

    it('source 0x4 mints the ZK Badge on 0x2 for the first time', async () => {
      resetStateSnapshotId = await evmSnapshot(hre);

      const nullifierFrom0x1 = await provingScheme.getNullifier({
        sources: [account1],
        destination: account2,
      });

      // 0x2 should hold the attestation with 0x1 nullifier
      const attestationsExtraData1 = await attestationsRegistry.getAttestationExtraData(
        badgeId,
        account2Signer.address
      );

      expect(
        await hydraS1AccountboundAttester.getNullifierFromExtraData(attestationsExtraData1)
      ).to.be.eql(nullifierFrom0x1);

      // 0x4 mints the badge on 0x2
      const { nullifier: nullifierFrom0x4 } = await mintBadge({
        sources: [account4],
        destination: account2,
        provingScheme,
        isDestinationAlreadyHoldingTheBadge: true,
      });

      const attestationsExtraData4 = await attestationsRegistry.getAttestationExtraData(
        badgeId,
        account2Signer.address
      );

      // verify that the attestation has the nullifier from 0x4
      expect(
        await hydraS1AccountboundAttester.getNullifierFromExtraData(attestationsExtraData4)
      ).to.be.eql(nullifierFrom0x4);
    });

    it('dest 0x2 mint the ERC721 on 0x2 (with the nullifier of 0x4 since 0x2 holds this badge)', async () => {
      const nullifierFrom0x4 = await provingScheme.getNullifier({
        sources: [account4],
        destination: account2,
      });

      expect(await zkBadgeboundERC721.balanceOf(account2Signer.address)).to.be.eql(
        BigNumber.from(0)
      );

      await zkBadgeboundERC721.connect(account2Signer).claim();

      // 0x2 should have the nft
      expect(await zkBadgeboundERC721.ownerOf(nullifierFrom0x4)).to.be.eql(account2Signer.address);

      expect(await zkBadgeboundERC721.balanceOf(account2Signer.address)).to.be.eql(
        BigNumber.from(1)
      );
    });

    it('source 0x3 mints a badge on dest 0x2', async () => {
      const nullifierFrom0x4 = await provingScheme.getNullifier({
        sources: [account4],
        destination: account2,
      });

      // 0x2 should hold the attestation with 0x4 nullifier
      const attestationsExtraData4 = await attestationsRegistry.getAttestationExtraData(
        badgeId,
        account2Signer.address
      );

      expect(
        await hydraS1AccountboundAttester.getNullifierFromExtraData(attestationsExtraData4)
      ).to.be.eql(nullifierFrom0x4);

      // 0x3 mints a badge on 0x2
      const { nullifier: nullifierFrom0x3 } = await mintBadge({
        sources: [account3],
        destination: account2,
        provingScheme,
        isDestinationAlreadyHoldingTheBadge: true,
      });

      // 0x2 should have the badge with 0x3 nullifier
      const attestationsExtraData3 = await attestationsRegistry.getAttestationExtraData(
        badgeId,
        account2Signer.address
      );

      expect(
        await hydraS1AccountboundAttester.getNullifierFromExtraData(attestationsExtraData3)
      ).to.be.eql(nullifierFrom0x3);
    });

    it('dest 0x2 can’t transfer the ERC721 (minted with nullifier from 0x4) to 0x3', async () => {
      const nullifierFrom0x4 = await provingScheme.getNullifier({
        sources: [account4],
        destination: account2,
      });

      // revert transferFrom
      await expect(
        zkBadgeboundERC721
          .connect(account2Signer)
          .transferFrom(account2Signer.address, account3Signer.address, nullifierFrom0x4)
      ).to.be.revertedWith('UserDoesNotMeetRequirements()');

      // revert safeTransferFrom
      await expect(
        zkBadgeboundERC721
          .connect(account2Signer)
          ['safeTransferFrom(address,address,uint256)'](
            account2Signer.address,
            account3Signer.address,
            nullifierFrom0x4
          )
      ).to.be.revertedWith('UserDoesNotMeetRequirements()');
    });

    it('dest 0x2 can’t transfer the ERC721 (minted with nullifier from 0x4) to 0x3 (even with a proof of ownership of 0x2 and 0x3)', async () => {
      const nullifierFrom0x4 = await provingScheme.getNullifier({
        sources: [account4],
        destination: account3,
      });

      const {
        request,
        proofData,
        nullifier: nullifierFrom0x3,
      } = await provingScheme.generateProof({
        sources: [account3],
        destination: account3,
      });

      // revert transferWithSismo (valid proof, but the nft (nullifier) is not the same than the nullifier in the proof)
      await expect(
        zkBadgeboundERC721
          .connect(account2Signer)
          .transferWithSismo(
            account2Signer.address,
            account3Signer.address,
            nullifierFrom0x4,
            request,
            proofData
          )
      ).to.be.revertedWith(
        `BadgeNullifierNotEqualToTokenId(${nullifierFrom0x3}, ${nullifierFrom0x4})`
      );
      await evmRevert(hre, resetStateSnapshotId);
    });
  });

  describe('Remaining scenarios: Test that strange edge cases do not happen', async () => {
    it('0x3 should NOT be able to mint an ERC721 on 0x3 if 0x3 holds a badge (but not the gated badge)', async () => {
      // 0x1 mints a badge on 0x03 (but not the gated badge)
      await mintBadge({
        sources: [account1],
        destination: account3,
        group: groups[1], // group 1 is not the gated badge group
        value: BigNumber.from(2), // 2 is the value of the second group
        provingScheme,
      });

      // 0x3 should NOT hold the gated badge
      await checkAccountHoldsBadge(account3Signer.address, badgeId, false);

      // 0x3 should NOT be able to mint an ERC721 on 0x3 if 0x3 holds a badge (but not the gated badge)
      await expect(zkBadgeboundERC721.connect(account3Signer).claim()).to.be.revertedWith(
        'UserDoesNotMeetRequirements()'
      );
      await evmRevert(hre, resetStateSnapshotId);
    });

    it('0x1 should NOT be able to mint a NFT on 0x00', async () => {
      resetStateSnapshotId = await evmSnapshot(hre);
      // 0x1 mints a badge on 0x02
      await mintBadge({
        sources: [account1],
        destination: account2,
        provingScheme,
        isDestinationAlreadyHoldingTheBadge: true,
      });

      await expect(
        zkBadgeboundERC721.connect(account2Signer).claimTo(zeroAddress)
      ).to.be.revertedWith('UserDoesNotMeetRequirements()');
    });

    it('should NOT allow the transfer of the nft to 0x00', async () => {
      resetStateSnapshotId = await evmSnapshot(hre);

      const { nullifier: nullifierFrom0x1 } = await mintBadge({
        sources: [account1],
        destination: account2,
        provingScheme,
        isDestinationAlreadyHoldingTheBadge: true,
      });

      // 0x2 mint the nft
      await zkBadgeboundERC721.connect(account2Signer).claim();

      // 0x2 should hold the nft
      expect(await zkBadgeboundERC721.balanceOf(account2Signer.address)).to.be.eql(
        BigNumber.from(1)
      );

      // 0x2 should NOT be able to transfer the nft to 0x00
      await expect(
        zkBadgeboundERC721
          .connect(account2Signer)
          ['safeTransferFrom(address,address,uint256)'](
            account2Signer.address,
            zeroAddress,
            nullifierFrom0x1
          )
      ).to.be.revertedWith('UserDoesNotMeetRequirements()');
      await evmRevert(hre, resetStateSnapshotId);
    });

    it('should NOT allow the transfer of the nft from 0x00 if NFT is not minted', async () => {
      resetStateSnapshotId = await evmSnapshot(hre);

      const { nullifier: nullifierFrom0x1 } = await mintBadge({
        sources: [account1],
        destination: account2,
        provingScheme,
        isDestinationAlreadyHoldingTheBadge: true,
      });

      // 0x2 should NOT be able to transfer the nft from 0x00 to 0x2
      await expect(
        zkBadgeboundERC721
          .connect(account2Signer)
          ['safeTransferFrom(address,address,uint256)'](
            zeroAddress,
            account2Signer.address,
            nullifierFrom0x1
          )
      ).to.be.revertedWith('ERC721: invalid token ID');

      await evmRevert(hre, resetStateSnapshotId);
    });

    it('should NOT allow the transfer of the nft from 0x00 if NFT is minted', async () => {
      resetStateSnapshotId = await evmSnapshot(hre);

      const { nullifier: nullifierFrom0x1 } = await mintBadge({
        sources: [account1],
        destination: account2,
        provingScheme,
        isDestinationAlreadyHoldingTheBadge: true,
      });

      // 0x2 mint the nft
      await zkBadgeboundERC721.connect(account2Signer).claim();

      // 0x2 should NOT be able to transfer the nft from 0x00 to 0x2
      await expect(
        zkBadgeboundERC721
          .connect(account2Signer)
          ['safeTransferFrom(address,address,uint256)'](
            zeroAddress,
            account2Signer.address,
            nullifierFrom0x1
          )
      ).to.be.revertedWith('ERC721: transfer from incorrect owner');
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

      const { zkBadgeboundERC721: newZKBadgeboundERC721 } = await hre.run(
        'deploy-zk-badgebound-erc721',
        {
          name: 'Ziki Pass',
          symbol: 'ZKP',
          tokenURI: 'https://test.com/zikipass',
          gatingBadgeTokenId: badgeId.toString(),
          admin: proxyAdminSigner.address,
          options: { deploymentNamePrefix: 'zk-badgebound-erc721-new-implem', behindProxy: false },
        }
      );

      const zkBadgeboundERC721Proxy = TransparentUpgradeableProxy__factory.connect(
        zkBadgeboundERC721.address,
        proxyAdminSigner
      );

      await (await zkBadgeboundERC721Proxy.upgradeTo(newZKBadgeboundERC721.address)).wait();

      const implementationAddress = await getImplementation(zkBadgeboundERC721Proxy);
      expect(implementationAddress).to.eql(newZKBadgeboundERC721.address);
    });
  });
});
