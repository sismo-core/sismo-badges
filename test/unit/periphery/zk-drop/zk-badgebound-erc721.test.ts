import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { HydraS1Account, KVMerkleTree } from '@sismo-core/hydra-s1';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import hre, { ethers } from 'hardhat';
import {
  AddressesProvider,
  AttestationsRegistry,
  AvailableRootsRegistry,
  Badges,
  CommitmentMapperRegistry,
  Front,
  HydraS1AccountboundAttester,
  HydraS1Verifier,
  ZKBadgeboundERC721,
} from '../../../../types';
import {
  evmRevert,
  evmSnapshot,
  HydraS1SimpleGroup,
  generateProvingData,
  ProvingDataStruct,
  HydraS1ProofRequest,
  HydraS1ZKPS,
  getBlockTimestamp,
  increaseTime,
} from '../../../utils';
import { testAttestationIsWellRegistered } from '../../../../test/utils/test-utils';

describe('Test ZK Badgebound ERC721 Contract', async () => {
  let attestationsRegistry: AttestationsRegistry;
  let hydraS1AccountboundAttester: HydraS1AccountboundAttester;
  let hydraS1Verifier: HydraS1Verifier;
  let commitmentMapperRegistry: CommitmentMapperRegistry;
  let availableRootsRegistry: AvailableRootsRegistry;
  let badges: Badges;
  let front: Front;
  let sismoAddressesProvider: AddressesProvider;
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

  let provingData: ProvingDataStruct;
  let accountsTreesWithData: { tree: KVMerkleTree; group: HydraS1SimpleGroup }[];
  let registryTree: KVMerkleTree;
  let groups: HydraS1SimpleGroup[];

  let provingScheme: HydraS1ZKPS;

  let cooldownDuration: number;
  let evmSnapshotId: string;
  let resetStateSnapshotId: string;
  let chainId: number;

  let badgeId: BigNumber;
  let badgeId2: BigNumber;

  before(async () => {
    chainId = parseInt(await hre.getChainId());

    // create a first group groups[0] in the merkle tree with all values 1
    const firstProvingData = await generateProvingData({ groupValue: 1 });

    // create a second group groups[1] in the merkle tree with all values 2
    provingData = await generateProvingData({
      groups: firstProvingData.groups,
      groupValue: 2,
    });

    accountsTreesWithData = provingData.accountsTreesWithData;
    registryTree = provingData.registryTree;
    groups = provingData.groups;

    accounts = provingData.accounts;

    provingScheme = new HydraS1ZKPS(provingData.commitmentMapperPubKey, chainId);

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
    it('Should deploy, setup and test the constructed values of the contract', async () => {
      ({
        attestationsRegistry,
        hydraS1AccountboundAttester,
        hydraS1Verifier,
        front,
        badges,
        commitmentMapperRegistry,
        availableRootsRegistry,
      } = await hre.run('0-deploy-core-and-hydra-s1-simple-and-accountbound-and-pythia1', {
        options: { deploymentNamePrefix: 'zk-badgebound-erc721' },
      }));

      ({ sismoAddressesProvider } = await hre.run('deploy-sismo-addresses-provider', {
        owner: deployer.address,
        badges: badges.address,
        attestationsRegistry: attestationsRegistry.address,
        front: front.address,
        hydraS1AccountboundAttester: hydraS1AccountboundAttester.address,
        commitmentMapperRegistry: commitmentMapperRegistry.address,
        availableRootsRegistry: availableRootsRegistry.address,
        hydraS1Verifier: hydraS1Verifier.address,
      }));

      ({ zkBadgeboundERC721 } = await hre.run('deploy-zk-badgebound-erc721', {
        options: { deploymentNamePrefix: 'zk-badgebound-erc721' },
      }));

      const root = registryTree.getRoot();
      await availableRootsRegistry.registerRootForAttester(
        hydraS1AccountboundAttester.address,
        root
      );

      await hydraS1AccountboundAttester.setCooldownDurationForGroupIndex(
        groups[0].properties.groupIndex,
        cooldownDuration
      );

      badgeId = (await hydraS1AccountboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()).add(
        groups[0].properties.groupIndex
      );

      badgeId2 = (await hydraS1AccountboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()).add(
        groups[1].properties.groupIndex
      );
    });

    it('should check the contract configuration', async () => {
      expect(await zkBadgeboundERC721.name()).to.equal('Mergoor Pass');
      expect(await zkBadgeboundERC721.symbol()).to.equal('MPT');
      expect(await zkBadgeboundERC721.MERGOOOR_PASS_BADGE_ID()).to.equal(badgeId);
    });
  });

  describe('Scenario 1: mint badge, mint NFT, transfer badge and then transfer NFT. Prevent to mint again.', () => {
    it('source 0x1 mints the ZK Badge on dest 0x2 for the first time (same user controls 0x1 and 0x2)', async () => {
      resetStateSnapshotId = await evmSnapshot(hre);
      const proofRequest: HydraS1ProofRequest = {
        sources: [account1],
        destination: account2,
        value: BigNumber.from(1),
        group: groups[0],
        attesterAddress: hydraS1AccountboundAttester.address,
      };

      const { request, proofData, inputs } = await provingScheme.generateProof(proofRequest, {
        registryTree,
        accountsTreesWithData,
      });

      const generateAttestationsTransaction =
        await hydraS1AccountboundAttester.generateAttestations(request, proofData);

      expect(
        await testAttestationIsWellRegistered({
          proofRequest,
          nullifier: BigNumber.from(inputs.publicInputs.nullifier),
          badgeId: badgeId,
          accountAddress: account2Signer.address,
          expectedCooldownStart: 0,
          expectedBurnCount: 0,
          tx: generateAttestationsTransaction,
          attestationsRegistry,
          attester: hydraS1AccountboundAttester,
        })
      ).to.be.true;
    });

    it('dest 0x2 should NOT be able to mint the ERC721 on 0x3 without proof', async () => {
      await expect(
        zkBadgeboundERC721.connect(account2Signer).claimTo(account3Signer.address)
      ).to.be.revertedWith('UserDoesNotMeetRequirements()');
    });

    it('dest 0x2 should be able to mint the ERC721 on 0x2 (by calling `claim`)', async () => {
      evmSnapshotId = await evmSnapshot(hre);
      expect(await attestationsRegistry.hasAttestation(badgeId, account2Signer.address)).to.be.true;

      expect(await zkBadgeboundERC721.balanceOf(account2Signer.address)).to.be.eql(
        BigNumber.from(0)
      );

      await zkBadgeboundERC721.connect(account2Signer).claim();

      expect(await zkBadgeboundERC721.balanceOf(account2Signer.address)).to.be.eql(
        BigNumber.from(1)
      );

      evmRevert(hre, evmSnapshotId);
    });

    it('dest 0x2 should be able to mint the ERC721 on 0x2 (by calling `claimTo`)', async () => {
      expect(await zkBadgeboundERC721.balanceOf(account2Signer.address)).to.be.eql(
        BigNumber.from(0)
      );

      await zkBadgeboundERC721.connect(account2Signer).claimTo(account2Signer.address);

      expect(await zkBadgeboundERC721.balanceOf(account2Signer.address)).to.be.eql(
        BigNumber.from(1)
      );
    });

    it('source 0x1 transfers the ZK Badge from dest 0x2 to dest 0x3 (same user controls source 0x1, dest 0x2 and dest 0x3)', async () => {
      const proofRequest: HydraS1ProofRequest = {
        sources: [account1],
        destination: account3,
        value: BigNumber.from(1),
        group: groups[0],
        attesterAddress: hydraS1AccountboundAttester.address,
      };

      const { request, proofData, inputs } = await provingScheme.generateProof(proofRequest, {
        registryTree,
        accountsTreesWithData,
      });

      const generateAttestationsTransaction =
        await hydraS1AccountboundAttester.generateAttestations(request, proofData);

      expect(
        await testAttestationIsWellRegistered({
          proofRequest,
          nullifier: BigNumber.from(inputs.publicInputs.nullifier),
          badgeId: badgeId,
          accountAddress: account3Signer.address, // the badge should be registered to account3
          expectedCooldownStart: await getBlockTimestamp(), // the cooldown period should start now for this badge
          expectedBurnCount: 1, // the burn count should be incremented since we are transferring the badge
          tx: generateAttestationsTransaction,
          attestationsRegistry,
          attester: hydraS1AccountboundAttester,
        })
      ).to.be.true;

      // 2 - Checks that 0x2 does not have the badge anymore
      expect(await attestationsRegistry.hasAttestation(badgeId, account2Signer.address)).to.be
        .false;
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

      const { inputs } = await provingScheme.generateProof(
        {
          sources: [account1],
          destination: account3,
          value: BigNumber.from(1),
          group: groups[0],
          attesterAddress: hydraS1AccountboundAttester.address,
        },
        {
          registryTree,
          accountsTreesWithData,
        }
      );

      expect(
        await zkBadgeboundERC721.ownerOf(BigNumber.from(inputs.publicInputs.nullifier))
      ).to.be.eql(account2Signer.address);

      expect(await zkBadgeboundERC721.balanceOf(account3Signer.address)).to.be.eql(
        BigNumber.from(0)
      );

      await zkBadgeboundERC721
        .connect(account2Signer)
        ['safeTransferFrom(address,address,uint256)'](
          account2Signer.address,
          account3Signer.address,
          BigNumber.from(inputs.publicInputs.nullifier)
        );

      expect(
        await zkBadgeboundERC721.ownerOf(BigNumber.from(inputs.publicInputs.nullifier))
      ).to.be.eql(account3Signer.address);

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

      const { inputs } = await provingScheme.generateProof(
        {
          sources: [account1],
          destination: account3,
          value: BigNumber.from(1),
          group: groups[0],
          attesterAddress: hydraS1AccountboundAttester.address,
        },
        {
          registryTree,
          accountsTreesWithData,
        }
      );

      expect(
        await zkBadgeboundERC721.ownerOf(BigNumber.from(inputs.publicInputs.nullifier))
      ).to.be.eql(account2Signer.address);

      expect(await zkBadgeboundERC721.balanceOf(account3Signer.address)).to.be.eql(
        BigNumber.from(0)
      );

      await zkBadgeboundERC721
        .connect(account2Signer)
        .transferFrom(
          account2Signer.address,
          account3Signer.address,
          BigNumber.from(inputs.publicInputs.nullifier)
        );

      expect(
        await zkBadgeboundERC721.ownerOf(BigNumber.from(inputs.publicInputs.nullifier))
      ).to.be.eql(account3Signer.address);

      expect(await zkBadgeboundERC721.balanceOf(account2Signer.address)).to.be.eql(
        BigNumber.from(0)
      );

      expect(await zkBadgeboundERC721.balanceOf(account3Signer.address)).to.be.eql(
        BigNumber.from(1)
      );
    });

    it('0x3 should be able to transfer ERC721 from 0x3 to any destination with a valid proof of ownership of 0x1 and new destination (badge will be also transferred)', async () => {
      increaseTime(hre, cooldownDuration);

      const proofRequest: HydraS1ProofRequest = {
        sources: [account1],
        destination: account4,
        value: BigNumber.from(1),
        group: groups[0],
        attesterAddress: hydraS1AccountboundAttester.address,
      };

      const { request, proofData, inputs } = await provingScheme.generateProof(proofRequest, {
        registryTree,
        accountsTreesWithData,
      });

      expect(
        await zkBadgeboundERC721.ownerOf(BigNumber.from(inputs.publicInputs.nullifier))
      ).to.be.eql(account3Signer.address);

      expect(await zkBadgeboundERC721.balanceOf(account4Signer.address)).to.be.eql(
        BigNumber.from(0)
      );

      const transferTx = await zkBadgeboundERC721
        .connect(account3Signer)
        .transferWithSismo(
          account3Signer.address,
          account4Signer.address,
          BigNumber.from(inputs.publicInputs.nullifier),
          request,
          proofData
        );

      // it should transfer the nft to the new destination
      expect(
        await zkBadgeboundERC721.ownerOf(BigNumber.from(inputs.publicInputs.nullifier))
      ).to.be.eql(account4Signer.address);

      expect(await zkBadgeboundERC721.balanceOf(account3Signer.address)).to.be.eql(
        BigNumber.from(0)
      );

      expect(
        await testAttestationIsWellRegistered({
          proofRequest,
          nullifier: BigNumber.from(inputs.publicInputs.nullifier),
          badgeId,
          accountAddress: account4Signer.address,
          expectedCooldownStart: await getBlockTimestamp(),
          expectedBurnCount: 2,
          tx: transferTx,
          attestationsRegistry,
          attester: hydraS1AccountboundAttester,
        })
      ).to.be.true;

      // 2 - Checks that 0x3 does not hold the badge anymore
      expect(await attestationsRegistry.hasAttestation(badgeId, account3Signer.address)).to.be
        .false;

      evmRevert(hre, resetStateSnapshotId);
    });
  });

  describe('Scenario 2: new badge minting on an address already owning a NFT (with a different nullifier), prevent new nft minting on this address, mint a new nft by transferring the badge first to a new address', async () => {
    it('source 0x1 mints the ZK Badge and the ERC721 on dest 0x2 for the first time with a valid proof of ownership of 0x1 and 0x2', async () => {
      resetStateSnapshotId = await evmSnapshot(hre);

      const proofRequest: HydraS1ProofRequest = {
        sources: [account1],
        destination: account2,
        value: BigNumber.from(1),
        group: groups[0],
        attesterAddress: hydraS1AccountboundAttester.address,
      };

      const { request, proofData, inputs } = await provingScheme.generateProof(proofRequest, {
        registryTree,
        accountsTreesWithData,
      });

      const mintNftTx = await zkBadgeboundERC721.claimWithSismo(request, proofData);

      expect(
        await testAttestationIsWellRegistered({
          proofRequest,
          nullifier: BigNumber.from(inputs.publicInputs.nullifier),
          badgeId,
          accountAddress: account2Signer.address,
          expectedCooldownStart: 0,
          expectedBurnCount: 0,
          tx: mintNftTx,
          attestationsRegistry,
          attester: hydraS1AccountboundAttester,
        })
      ).to.be.true;
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

    it('source 0x3 should not be able to mint a NFT on dest 0x2 (even with a valid proof) because 0x2 owns an ERC721', async () => {
      const { request, proofData } = await provingScheme.generateProof(
        {
          sources: [account3],
          destination: account2,
          value: BigNumber.from(1),
          group: groups[0],
          attesterAddress: hydraS1AccountboundAttester.address,
        },
        {
          registryTree,
          accountsTreesWithData,
        }
      );

      await expect(zkBadgeboundERC721.claimWithSismo(request, proofData)).to.be.revertedWith(
        `NFTAlreadyOwned("${account2Signer.address}", 1)`
      );
    });

    it('source 0x3 should be able to mint a badge on dest 0x2', async () => {
      const proofRequest: HydraS1ProofRequest = {
        sources: [account3],
        destination: account2,
        value: BigNumber.from(1),
        group: groups[0],
        attesterAddress: hydraS1AccountboundAttester.address,
      };

      const { request, proofData, inputs } = await provingScheme.generateProof(proofRequest, {
        registryTree,
        accountsTreesWithData,
      });

      const badgeOverrideTx = await hydraS1AccountboundAttester.generateAttestations(
        request,
        proofData
      );

      expect(
        await testAttestationIsWellRegistered({
          proofRequest,
          nullifier: BigNumber.from(inputs.publicInputs.nullifier),
          badgeId,
          accountAddress: account2Signer.address,
          expectedCooldownStart: 0, // its a new badge, so no cooldown should start
          expectedBurnCount: 0, // its a new badge, so burn count should be 0
          tx: badgeOverrideTx,
          attestationsRegistry,
          attester: hydraS1AccountboundAttester,
        })
      ).to.be.true;

      const oldProofRequest: HydraS1ProofRequest = {
        sources: [account1], // account1 is the source that was used to mint the ERC721 hold on account2
        destination: account2,
        value: BigNumber.from(1),
        group: groups[0],
        attesterAddress: hydraS1AccountboundAttester.address,
      };

      // We retrieve the old nullifier to see if it is still the one registered in the extraData of the attestation (should not be the case)
      const { inputs: oldInputs } = await provingScheme.generateProof(oldProofRequest, {
        registryTree,
        accountsTreesWithData,
      });

      // We check that the old nullifier is different from the new nullifier
      expect(inputs.publicInputs.nullifier).to.not.be.eql(oldInputs.publicInputs.nullifier);

      // We check that the new nullifier is the one registered in the extraData of the attestation
      const extraData = await attestationsRegistry.getAttestationExtraData(
        badgeId,
        account2Signer.address
      );

      expect(await hydraS1AccountboundAttester.getNullifierFromExtraData(extraData)).to.equal(
        inputs.publicInputs.nullifier
      );
    });

    it('source 0x3 should not be able to mint a ERC721 on dest 0x2 because 0x2 owns an ERC721 (Even with a new badge on 0x2 with a new nullifier)', async () => {
      expect(await zkBadgeboundERC721.balanceOf(account2Signer.address)).to.be.eql(
        BigNumber.from(1)
      );

      await expect(zkBadgeboundERC721.claimTo(account2Signer.address)).to.be.revertedWith(
        `NFTAlreadyOwned("${account2Signer.address}", 1)`
      );
    });

    it('source 0x3 should not be able to mint a ERC721 on dest 0x2 because 0x2 owns an ERC721 (even with a valid proof and a new badge)', async () => {
      const { request, proofData } = await provingScheme.generateProof(
        {
          sources: [account3],
          destination: account2,
          value: BigNumber.from(1),
          group: groups[0],
          attesterAddress: hydraS1AccountboundAttester.address,
        },
        {
          registryTree,
          accountsTreesWithData,
        }
      );

      await expect(zkBadgeboundERC721.claimWithSismo(request, proofData)).to.be.revertedWith(
        `NFTAlreadyOwned("${account2Signer.address}", 1)`
      );
    });

    it('source 0x3 should be able to transfer badge3 from 0x2 to 0x3', async () => {
      const proofRequest: HydraS1ProofRequest = {
        sources: [account3],
        destination: account3,
        value: BigNumber.from(1),
        group: groups[0],
        attesterAddress: hydraS1AccountboundAttester.address,
      };

      const { request, proofData, inputs } = await provingScheme.generateProof(proofRequest, {
        registryTree,
        accountsTreesWithData,
      });

      const badgeTransferTx = await hydraS1AccountboundAttester.generateAttestations(
        request,
        proofData
      );

      expect(
        await testAttestationIsWellRegistered({
          proofRequest,
          nullifier: BigNumber.from(inputs.publicInputs.nullifier),
          badgeId,
          accountAddress: account3Signer.address,
          expectedCooldownStart: await getBlockTimestamp(),
          expectedBurnCount: 1, // the badge is transferred from 0x2 to 0x3, so burn count should be incremented
          tx: badgeTransferTx,
          attestationsRegistry,
          attester: hydraS1AccountboundAttester,
        })
      ).to.be.true;

      // 2 - Checks that the attester unrecorded the attestation in the registry
      expect(await attestationsRegistry.hasAttestation(badgeId, account2Signer.address)).to.be
        .false;
    });

    it('dest 0x3 should be able to mint a ERC721 on 0x3', async () => {
      expect(await zkBadgeboundERC721.balanceOf(account3Signer.address)).to.be.eql(
        BigNumber.from(0)
      );

      expect(await zkBadgeboundERC721.connect(account3Signer).claimTo(account3Signer.address));

      expect(await zkBadgeboundERC721.balanceOf(account3Signer.address)).to.be.eql(
        BigNumber.from(1)
      );

      // we use the same proof request as in the previous test to check that the token Id is indeed the nullifier used for the badge
      const { inputs } = await provingScheme.generateProof(
        {
          sources: [account3],
          destination: account3,
          value: BigNumber.from(1),
          group: groups[0],
          attesterAddress: hydraS1AccountboundAttester.address,
        },
        {
          registryTree,
          accountsTreesWithData,
        }
      );

      expect(
        await zkBadgeboundERC721.ownerOf(BigNumber.from(inputs.publicInputs.nullifier))
      ).to.be.eql(account3Signer.address);
    });

    it('dest0x2 should NOT be able to transfer the nft1 (minted with nullifier from 0x1) on 0x3', async () => {
      // this nullifier is the tokenId of the nft we want to transfer from 0x2 to 0x3
      const { inputs } = await provingScheme.generateProof(
        {
          sources: [account1],
          destination: account3,
          value: BigNumber.from(1),
          group: groups[0],
          attesterAddress: hydraS1AccountboundAttester.address,
        },
        {
          registryTree,
          accountsTreesWithData,
        }
      );

      const nullifierFrom0x1 = inputs.publicInputs.nullifier;

      // retrieve the nullifier of the badge (nullifier from 0x3) that is also the tokenId of the nft on 0x3
      const { inputs: oldInputs } = await provingScheme.generateProof(
        {
          sources: [account3],
          destination: account3,
          value: BigNumber.from(1),
          group: groups[0],
          attesterAddress: hydraS1AccountboundAttester.address,
        },
        {
          registryTree,
          accountsTreesWithData,
        }
      );

      const nullifierFrom0x3 = oldInputs.publicInputs.nullifier;

      await expect(
        zkBadgeboundERC721
          .connect(account2Signer)
          .transferFrom(
            account2Signer.address,
            account3Signer.address,
            BigNumber.from(inputs.publicInputs.nullifier)
          )
      ).to.be.revertedWith(
        `BadgeNullifierNotEqualToTokenId(${BigNumber.from(nullifierFrom0x3)}, ${BigNumber.from(
          nullifierFrom0x1
        )})'`
      );
    });

    it('dest0x2 should NOT be able to transfer the nft1 on 0x3 even with a valid proof (proof with 0x1 nullifier)', async () => {
      const { request, proofData, inputs } = await provingScheme.generateProof(
        {
          sources: [account1],
          destination: account3,
          value: BigNumber.from(1),
          group: groups[0],
          attesterAddress: hydraS1AccountboundAttester.address,
        },
        {
          registryTree,
          accountsTreesWithData,
        }
      );

      await expect(
        zkBadgeboundERC721.transferWithSismo(
          account2Signer.address,
          account3Signer.address,
          BigNumber.from(inputs.publicInputs.nullifier),
          request,
          proofData
        )
      ).to.be.revertedWith(`NFTAlreadyOwned("${account3Signer.address}", 1)`);
    });

    it('source 0x1 should be able to mint a badge on dest 0x2', async () => {
      evmSnapshotId = await evmSnapshot(hre);

      const { request, proofData } = await provingScheme.generateProof(
        {
          sources: [account1],
          destination: account2,
          value: BigNumber.from(1),
          group: groups[0],
          attesterAddress: hydraS1AccountboundAttester.address,
        },
        {
          registryTree,
          accountsTreesWithData,
        }
      );

      expect(await attestationsRegistry.hasAttestation(badgeId, account2Signer.address)).to.be
        .false;

      await hydraS1AccountboundAttester.generateAttestations(request, proofData);

      expect(await attestationsRegistry.hasAttestation(badgeId, account2Signer.address)).to.be.true;

      await evmRevert(hre, evmSnapshotId);
    });

    it('dest 0x2 should be able to transfer the ERC721 from 0x2 to 0x1 with a valid proof of ownership of 0x1 and 0x2', async () => {
      const proofRequest = {
        sources: [account1],
        destination: account1,
        value: BigNumber.from(1),
        group: groups[0],
        attesterAddress: hydraS1AccountboundAttester.address,
      };

      const { request, proofData, inputs } = await provingScheme.generateProof(proofRequest, {
        registryTree,
        accountsTreesWithData,
      });

      // 0x1 should not have the badge yet
      expect(await attestationsRegistry.hasAttestation(badgeId, account1Signer.address)).to.be
        .false;

      // 0x1 should have no nft
      expect(await zkBadgeboundERC721.balanceOf(account1Signer.address)).to.be.eql(
        BigNumber.from(0)
      );

      // 0x2 should have no badge
      expect(await attestationsRegistry.hasAttestation(badgeId, account2Signer.address)).to.be
        .false;

      // 0x2 should have the nft
      expect(
        await zkBadgeboundERC721.ownerOf(BigNumber.from(inputs.publicInputs.nullifier))
      ).to.be.eql(account2Signer.address);

      const transferTx = await zkBadgeboundERC721.transferWithSismo(
        account2Signer.address,
        account1Signer.address,
        BigNumber.from(inputs.publicInputs.nullifier),
        request,
        proofData
      );

      expect(
        await testAttestationIsWellRegistered({
          proofRequest,
          nullifier: BigNumber.from(inputs.publicInputs.nullifier),
          badgeId,
          accountAddress: account1Signer.address,
          expectedCooldownStart: await getBlockTimestamp(), // this badge has been overriden, but the nullifier was stored in the hydraS1Accountbound attester, so cooldown is still applied
          expectedBurnCount: 1, // for the same reason, the burn count is incremented to 1
          tx: transferTx,
          attestationsRegistry,
          attester: hydraS1AccountboundAttester,
        })
      );

      // 0x1 should have the badge now
      expect(await attestationsRegistry.hasAttestation(badgeId, account1Signer.address)).to.be.true;

      // 0x1 should have the nft
      expect(
        await zkBadgeboundERC721.ownerOf(BigNumber.from(inputs.publicInputs.nullifier))
      ).to.be.eql(account1Signer.address);

      // 0x2 should have no badge
      expect(await attestationsRegistry.hasAttestation(badgeId, account2Signer.address)).to.be
        .false;

      // 0x2 should have no nft
      expect(await zkBadgeboundERC721.balanceOf(account1Signer.address)).to.be.eql(
        BigNumber.from(1)
      );

      await evmRevert(hre, resetStateSnapshotId);
    });
  });

  describe('Scenario 3: tests that badges can be minted by several sources on a destination but the nft can only be transferred to the account holding the valid badge (same nullifier) or with a valid proof (same nullifier) ', async () => {
    it('source 0x1 mints the ZK Badge on 0x2 for the first time', async () => {
      resetStateSnapshotId = await evmSnapshot(hre);

      const proofRequest = {
        sources: [account1],
        destination: account2,
        value: BigNumber.from(1),
        group: groups[0],
        attesterAddress: hydraS1AccountboundAttester.address,
      };

      const { request, proofData, inputs } = await provingScheme.generateProof(proofRequest, {
        registryTree,
        accountsTreesWithData,
      });

      expect(await attestationsRegistry.hasAttestation(badgeId, account2Signer.address)).to.be
        .false;

      const mintBadgeTx = await hydraS1AccountboundAttester.generateAttestations(
        request,
        proofData
      );

      expect(
        await testAttestationIsWellRegistered({
          proofRequest,
          nullifier: BigNumber.from(inputs.publicInputs.nullifier),
          badgeId,
          accountAddress: account2Signer.address,
          expectedCooldownStart: 0, // this badge is new, so no cooldown set
          expectedBurnCount: 0, // for the same reason, the burn count is 0
          tx: mintBadgeTx,
          attestationsRegistry,
          attester: hydraS1AccountboundAttester,
        })
      );

      // 0x2 should only have the badge
      expect(await zkBadgeboundERC721.balanceOf(account2Signer.address)).to.be.eql(
        BigNumber.from(0)
      );
    });

    it('dest 0x2 should be able to mint the ERC721', async () => {
      evmSnapshotId = await evmSnapshot(hre);

      const { inputs } = await provingScheme.generateProof(
        {
          sources: [account1],
          destination: account2,
          value: BigNumber.from(1),
          group: groups[0],
          attesterAddress: hydraS1AccountboundAttester.address,
        },
        {
          registryTree,
          accountsTreesWithData,
        }
      );

      expect(await zkBadgeboundERC721.balanceOf(account2Signer.address)).to.be.eql(
        BigNumber.from(0)
      );

      await zkBadgeboundERC721.connect(account2Signer).claim();

      // 0x2 should have the nft
      expect(
        await zkBadgeboundERC721.ownerOf(BigNumber.from(inputs.publicInputs.nullifier))
      ).to.be.eql(account2Signer.address);

      expect(await zkBadgeboundERC721.balanceOf(account2Signer.address)).to.be.eql(
        BigNumber.from(1)
      );

      await evmRevert(hre, evmSnapshotId);
    });

    it('source 0x4 mints the ZK Badge on 0x2 for the first time', async () => {
      resetStateSnapshotId = await evmSnapshot(hre);

      const { inputs: oldInputs } = await provingScheme.generateProof(
        {
          sources: [account1],
          destination: account2,
          value: BigNumber.from(1),
          group: groups[0],
          attesterAddress: hydraS1AccountboundAttester.address,
        },
        {
          registryTree,
          accountsTreesWithData,
        }
      );

      // 0x2 should hold the attestation with 0x1 nullifier
      expect(await attestationsRegistry.hasAttestation(badgeId, account2Signer.address)).to.be.true;

      const attestationsExtraData1 = await attestationsRegistry.getAttestationExtraData(
        badgeId,
        account2Signer.address
      );

      expect(
        await hydraS1AccountboundAttester.getNullifierFromExtraData(attestationsExtraData1)
      ).to.be.eql(BigNumber.from(oldInputs.publicInputs.nullifier));

      const proofRequest = {
        sources: [account4],
        destination: account2,
        value: BigNumber.from(1),
        group: groups[0],
        attesterAddress: hydraS1AccountboundAttester.address,
      };

      const { request, proofData, inputs } = await provingScheme.generateProof(proofRequest, {
        registryTree,
        accountsTreesWithData,
      });

      const mintBadgeFrom0x4 = await hydraS1AccountboundAttester.generateAttestations(
        request,
        proofData
      );

      expect(
        await testAttestationIsWellRegistered({
          proofRequest,
          nullifier: BigNumber.from(inputs.publicInputs.nullifier),
          badgeId,
          accountAddress: account2Signer.address,
          expectedCooldownStart: 0, // this badge is new, so no cooldown set
          expectedBurnCount: 0, // for the same reason, the burn count is 0
          tx: mintBadgeFrom0x4,
          attestationsRegistry,
          attester: hydraS1AccountboundAttester,
        })
      ).to.be.true;

      const attestationsExtraData4 = await attestationsRegistry.getAttestationExtraData(
        badgeId,
        account2Signer.address
      );

      expect(
        await hydraS1AccountboundAttester.getNullifierFromExtraData(attestationsExtraData4)
      ).to.be.eql(BigNumber.from(inputs.publicInputs.nullifier));
    });

    it('dest 0x2 mint the ERC721 on 0x2 (with the nullifier of 0x4 since 0x2 holds this badge)', async () => {
      const { inputs } = await provingScheme.generateProof(
        {
          sources: [account4],
          destination: account2,
          value: BigNumber.from(1),
          group: groups[0],
          attesterAddress: hydraS1AccountboundAttester.address,
        },
        {
          registryTree,
          accountsTreesWithData,
        }
      );

      expect(await zkBadgeboundERC721.balanceOf(account2Signer.address)).to.be.eql(
        BigNumber.from(0)
      );

      await zkBadgeboundERC721.connect(account2Signer).claim();

      // 0x2 should have the nft
      expect(
        await zkBadgeboundERC721.ownerOf(BigNumber.from(inputs.publicInputs.nullifier))
      ).to.be.eql(account2Signer.address);

      expect(await zkBadgeboundERC721.balanceOf(account2Signer.address)).to.be.eql(
        BigNumber.from(1)
      );
    });

    it('source 0x3 mints a badge on dest 0x2', async () => {
      const { inputs: oldInputs } = await provingScheme.generateProof(
        {
          sources: [account4],
          destination: account2,
          value: BigNumber.from(1),
          group: groups[0],
          attesterAddress: hydraS1AccountboundAttester.address,
        },
        {
          registryTree,
          accountsTreesWithData,
        }
      );

      // 0x2 should hold the attestation with 0x1 nullifier
      expect(await attestationsRegistry.hasAttestation(badgeId, account2Signer.address)).to.be.true;

      const attestationsExtraData1 = await attestationsRegistry.getAttestationExtraData(
        badgeId,
        account2Signer.address
      );

      expect(
        await hydraS1AccountboundAttester.getNullifierFromExtraData(attestationsExtraData1)
      ).to.be.eql(BigNumber.from(oldInputs.publicInputs.nullifier));

      const proofRequest = {
        sources: [account3],
        destination: account2,
        value: BigNumber.from(1),
        group: groups[0],
        attesterAddress: hydraS1AccountboundAttester.address,
      };

      const { request, proofData, inputs } = await provingScheme.generateProof(proofRequest, {
        registryTree,
        accountsTreesWithData,
      });

      const tx = await hydraS1AccountboundAttester.generateAttestations(request, proofData);

      expect(
        await testAttestationIsWellRegistered({
          proofRequest,
          nullifier: BigNumber.from(inputs.publicInputs.nullifier),
          badgeId,
          accountAddress: account2Signer.address,
          expectedCooldownStart: 0, // this badge is new, so no cooldown set
          expectedBurnCount: 0, // for the same reason, the burn count is 0
          tx,
          attestationsRegistry,
          attester: hydraS1AccountboundAttester,
        })
      ).to.be.true;

      // 0x2 should have the badge with 0x4 nullifier
      expect(await attestationsRegistry.hasAttestation(badgeId, account2Signer.address)).to.be.true;

      const attestationsExtraData4 = await attestationsRegistry.getAttestationExtraData(
        badgeId,
        account2Signer.address
      );

      expect(
        await hydraS1AccountboundAttester.getNullifierFromExtraData(attestationsExtraData4)
      ).to.be.eql(BigNumber.from(inputs.publicInputs.nullifier));
    });

    it('dest 0x2 can’t transfer the ERC721 (minted with nullifier from 0x4) to 0x3', async () => {
      const { inputs } = await provingScheme.generateProof(
        {
          sources: [account4],
          destination: account2,
          value: BigNumber.from(1),
          group: groups[0],
          attesterAddress: hydraS1AccountboundAttester.address,
        },
        {
          registryTree,
          accountsTreesWithData,
        }
      );

      // revert transferFrom
      await expect(
        zkBadgeboundERC721
          .connect(account2Signer)
          .transferFrom(
            account2Signer.address,
            account3Signer.address,
            BigNumber.from(inputs.publicInputs.nullifier)
          )
      ).to.be.revertedWith('UserDoesNotMeetRequirements()');

      // revert safeTransferFrom
      await expect(
        zkBadgeboundERC721
          .connect(account2Signer)
          ['safeTransferFrom(address,address,uint256)'](
            account2Signer.address,
            account3Signer.address,
            BigNumber.from(inputs.publicInputs.nullifier)
          )
      ).to.be.revertedWith('UserDoesNotMeetRequirements()');
    });

    it('dest 0x2 can’t transfer the ERC721 (minted with nullifier from 0x4) to 0x3 (even with a proof of ownership of 0x2 and 0x3)', async () => {
      const { inputs: inputsFrom0x4 } = await provingScheme.generateProof(
        {
          sources: [account4],
          destination: account3,
          value: BigNumber.from(1),
          group: groups[0],
          attesterAddress: hydraS1AccountboundAttester.address,
        },
        {
          registryTree,
          accountsTreesWithData,
        }
      );

      const nullifierFrom0x4 = BigNumber.from(inputsFrom0x4.publicInputs.nullifier);

      const {
        request: requestFrom0x3,
        proofData: proofFrom0x3,
        inputs: inputsFrom0x3,
      } = await provingScheme.generateProof(
        {
          sources: [account3],
          destination: account3,
          value: BigNumber.from(1),
          group: groups[0],
          attesterAddress: hydraS1AccountboundAttester.address,
        },
        {
          registryTree,
          accountsTreesWithData,
        }
      );

      const nullifierFrom0x3 = BigNumber.from(inputsFrom0x3.publicInputs.nullifier);

      // revert transferWithSismo (valid proof, but the nft (nullifier) is not the same than the nullifier in the proof)
      await expect(
        zkBadgeboundERC721
          .connect(account2Signer)
          .transferWithSismo(
            account2Signer.address,
            account3Signer.address,
            nullifierFrom0x4,
            requestFrom0x3,
            proofFrom0x3
          )
      ).to.be.revertedWith(
        `BadgeNullifierNotEqualToTokenId(${nullifierFrom0x3}, ${nullifierFrom0x4})`
      );
    });
  });
});
