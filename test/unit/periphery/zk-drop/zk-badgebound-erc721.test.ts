import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { CommitmentMapperTester, EddsaPublicKey } from '@sismo-core/commitment-mapper-tester-js';
import {
  HydraS1Account,
  HydraS1Prover,
  Inputs,
  KVMerkleTree,
  SnarkProof,
  SNARK_FIELD,
} from '@sismo-core/hydra-s1';
import { expect } from 'chai';
import { BigNumber, utils } from 'ethers';
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
import { RequestStruct } from 'types/HydraS1SimpleAttester';
import {
  evmRevert,
  evmSnapshot,
  generateHydraS1Accounts,
  generateGroups,
  generateExternalNullifier,
  increaseTime,
  toBytes,
  GroupData,
  generateAttesterGroups,
  HydraS1SimpleGroup,
  encodeGroupProperties,
  generateGroupIdFromProperties,
  packRequestAndProofToBytes,
  generateProvingData,
  ProvingDataStruct,
  getValuesFromAccountsTrees,
  HydraS1ProofRequest,
  HydraS1ZKPS,
} from '../../../utils';
import { formatBytes32String } from 'ethers/lib/utils';
import { deploymentsConfig } from '../../../../tasks/deploy-tasks/deployments-config';

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

  const config = deploymentsConfig[hre.network.name];

  before(async () => {
    chainId = parseInt(await hre.getChainId());

    // create a first group groups[0] in the merkle tree with all values 1
    const firstProvingData = await generateProvingData({ groupValue: 1 });

    // create a second group groups[1] in the merkle tree with all values 0
    const secondProvingData = await generateProvingData({
      groups: firstProvingData.groups, // reuse all groups from the first proving data
      groupValue: 0,
    });

    // create a third groups[0] in the merkle tree with all values 42
    provingData = await generateProvingData({
      groups: secondProvingData.groups, // reuse all groups from the second proving data
      groupValue: 42,
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

      const code = await hre.network.provider.send('eth_getCode', [
        config.sismoAddressesProvider.address,
      ]);

      // needed to not break `yarn test`
      if (code === '0x') {
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
      }

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

      const extraData = await attestationsRegistry.getAttestationExtraData(
        (
          await hydraS1AccountboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()
        ).add(proofRequest.group.properties.groupIndex),
        BigNumber.from(proofRequest.destination.identifier).toHexString()
      );

      // 0 - Checks that the transaction emitted the event
      await expect(generateAttestationsTransaction)
        .to.emit(hydraS1AccountboundAttester, 'AttestationGenerated')
        .withArgs([
          (
            await hydraS1AccountboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()
          ).add(proofRequest.group.properties.groupIndex),
          account2Signer.address,
          hydraS1AccountboundAttester.address,
          proofRequest.value,
          proofRequest.group.properties.generationTimestamp,
          extraData,
        ]);

      // 1 - Checks that the provided nullifier was successfully recorded in the attester
      expect(
        await hydraS1AccountboundAttester.getDestinationOfNullifier(
          BigNumber.from(inputs.publicInputs.nullifier)
        )
      ).to.equal(account2Signer.address);

      expect(
        await hydraS1AccountboundAttester.getNullifierCooldownStart(
          BigNumber.from(inputs.publicInputs.nullifier)
        )
      ).to.be.eql(0);

      expect(
        await hydraS1AccountboundAttester.getNullifierBurnCount(
          BigNumber.from(inputs.publicInputs.nullifier)
        )
      ).to.be.eql(0);

      // 2 - Checks that the attester recorded the attestation in the registry
      expect(await attestationsRegistry.hasAttestation(badgeId, account2Signer.address)).to.be.true;
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

      const extraData = await attestationsRegistry.getAttestationExtraData(
        (
          await hydraS1AccountboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()
        ).add(proofRequest.group.properties.groupIndex),
        BigNumber.from(proofRequest.destination.identifier).toHexString()
      );

      // 0 - Checks that the transaction emitted the event
      await expect(generateAttestationsTransaction)
        .to.emit(hydraS1AccountboundAttester, 'AttestationGenerated')
        .withArgs([
          (
            await hydraS1AccountboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()
          ).add(proofRequest.group.properties.groupIndex),
          account3Signer.address,
          hydraS1AccountboundAttester.address,
          proofRequest.value,
          proofRequest.group.properties.generationTimestamp,
          extraData,
        ]);

      // 1 - Checks that the provided nullifier was successfully recorded in the attester
      expect(
        await hydraS1AccountboundAttester.getDestinationOfNullifier(
          BigNumber.from(inputs.publicInputs.nullifier)
        )
      ).to.equal(account3Signer.address);

      expect(
        await hydraS1AccountboundAttester.getNullifierCooldownStart(
          BigNumber.from(inputs.publicInputs.nullifier)
        )
      ).to.be.eql((await ethers.provider.getBlock('latest')).timestamp);

      expect(
        await hydraS1AccountboundAttester.getNullifierBurnCount(
          BigNumber.from(inputs.publicInputs.nullifier)
        )
      ).to.be.eql(1); // burnCount is incremented by 1

      // 2 - Checks that the attester recorded the attestation in the registry
      // the attestation has been from 0x2 to 0x3
      expect(
        await attestationsRegistry.hasAttestation(
          (
            await hydraS1AccountboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()
          ).add(proofRequest.group.properties.groupIndex),
          account2Signer.address
        )
      ).to.be.false;

      expect(
        await attestationsRegistry.hasAttestation(
          (
            await hydraS1AccountboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()
          ).add(proofRequest.group.properties.groupIndex),
          account3Signer.address
        )
      ).to.be.true;
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
      const proofRequest: HydraS1ProofRequest = {
        sources: [account1],
        destination: account3,
        value: BigNumber.from(1),
        group: groups[0],
        attesterAddress: hydraS1AccountboundAttester.address,
      };

      const { inputs } = await provingScheme.generateProof(proofRequest, {
        registryTree,
        accountsTreesWithData,
      });

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
      const proofRequest: HydraS1ProofRequest = {
        sources: [account1],
        destination: account3,
        value: BigNumber.from(1),
        group: groups[0],
        attesterAddress: hydraS1AccountboundAttester.address,
      };

      const { inputs } = await provingScheme.generateProof(proofRequest, {
        registryTree,
        accountsTreesWithData,
      });

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

      // it should transfer the badge to the new destination
      const extraData = await attestationsRegistry.getAttestationExtraData(
        (
          await hydraS1AccountboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()
        ).add(proofRequest.group.properties.groupIndex),
        BigNumber.from(proofRequest.destination.identifier).toHexString()
      );

      // 0 - Checks that the transaction emitted the event
      await expect(transferTx)
        .to.emit(hydraS1AccountboundAttester, 'AttestationGenerated')
        .withArgs([
          (
            await hydraS1AccountboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()
          ).add(proofRequest.group.properties.groupIndex),
          request.destination,
          hydraS1AccountboundAttester.address,
          proofRequest.value,
          proofRequest.group.properties.generationTimestamp,
          extraData,
        ]);

      // 1 - Checks that the provided nullifier was successfully recorded in the attester
      expect(
        await hydraS1AccountboundAttester.getDestinationOfNullifier(
          BigNumber.from(inputs.publicInputs.nullifier)
        )
      ).to.equal(account4Signer.address);

      expect(
        await hydraS1AccountboundAttester.getNullifierCooldownStart(
          BigNumber.from(inputs.publicInputs.nullifier)
        )
      ).to.be.eql((await ethers.provider.getBlock('latest')).timestamp);

      expect(
        await hydraS1AccountboundAttester.getNullifierBurnCount(
          BigNumber.from(inputs.publicInputs.nullifier)
        )
      ).to.be.eql(2); // check that nullifier was incremented

      // 2 - Checks that the attester recorded the attestation in the registry
      expect(
        await attestationsRegistry.hasAttestation(
          (
            await hydraS1AccountboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()
          ).add(proofRequest.group.properties.groupIndex),
          account3Signer.address
        )
      ).to.be.false;

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

      const extraData = await attestationsRegistry.getAttestationExtraData(
        (
          await hydraS1AccountboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()
        ).add(proofRequest.group.properties.groupIndex),
        account2Signer.address
      );

      // 0 - Checks that the transaction emitted the event
      await expect(mintNftTx)
        .to.emit(hydraS1AccountboundAttester, 'AttestationGenerated')
        .withArgs([
          (
            await hydraS1AccountboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()
          ).add(proofRequest.group.properties.groupIndex),
          account2Signer.address,
          hydraS1AccountboundAttester.address,
          proofRequest.value,
          proofRequest.group.properties.generationTimestamp,
          extraData,
        ]);

      // 1 - Checks that the provided nullifier was successfully recorded in the attester
      expect(
        await hydraS1AccountboundAttester.getDestinationOfNullifier(
          BigNumber.from(inputs.publicInputs.nullifier)
        )
      ).to.equal(account2Signer.address);

      expect(
        await hydraS1AccountboundAttester.getNullifierCooldownStart(
          BigNumber.from(inputs.publicInputs.nullifier)
        )
      ).to.be.eql(0);

      expect(
        await hydraS1AccountboundAttester.getNullifierBurnCount(
          BigNumber.from(inputs.publicInputs.nullifier)
        )
      ).to.be.eql(0);

      // 2 - Checks that the attester recorded the attestation in the registry
      expect(await attestationsRegistry.hasAttestation(badgeId, account2Signer.address)).to.be.true;
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
      const proofRequest: HydraS1ProofRequest = {
        sources: [account3],
        destination: account2,
        value: BigNumber.from(1),
        group: groups[0],
        attesterAddress: hydraS1AccountboundAttester.address,
      };

      const { request, proofData } = await provingScheme.generateProof(proofRequest, {
        registryTree,
        accountsTreesWithData,
      });

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

      const extraData = await attestationsRegistry.getAttestationExtraData(
        (
          await hydraS1AccountboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()
        ).add(proofRequest.group.properties.groupIndex),
        account2Signer.address
      );

      // 0 - Checks that the transaction emitted the event
      await expect(badgeOverrideTx)
        .to.emit(hydraS1AccountboundAttester, 'AttestationGenerated')
        .withArgs([
          (
            await hydraS1AccountboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()
          ).add(proofRequest.group.properties.groupIndex),
          account2Signer.address,
          hydraS1AccountboundAttester.address,
          proofRequest.value,
          proofRequest.group.properties.generationTimestamp,
          extraData,
        ]);

      // 1 - Checks that the provided nullifier was successfully recorded in the attester
      expect(
        await hydraS1AccountboundAttester.getDestinationOfNullifier(
          BigNumber.from(inputs.publicInputs.nullifier)
        )
      ).to.equal(account2Signer.address);

      expect(
        await hydraS1AccountboundAttester.getNullifierCooldownStart(
          BigNumber.from(inputs.publicInputs.nullifier)
        )
      ).to.be.eql(0);

      expect(
        await hydraS1AccountboundAttester.getNullifierBurnCount(
          BigNumber.from(inputs.publicInputs.nullifier)
        )
      ).to.be.eql(0);

      // 2 - Checks that the attester recorded the attestation in the registry
      expect(await attestationsRegistry.hasAttestation(badgeId, account2Signer.address)).to.be.true;

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
      const proofRequest: HydraS1ProofRequest = {
        sources: [account3],
        destination: account2,
        value: BigNumber.from(1),
        group: groups[0],
        attesterAddress: hydraS1AccountboundAttester.address,
      };

      const { request, proofData } = await provingScheme.generateProof(proofRequest, {
        registryTree,
        accountsTreesWithData,
      });

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

      const extraData = await attestationsRegistry.getAttestationExtraData(
        (
          await hydraS1AccountboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()
        ).add(proofRequest.group.properties.groupIndex),
        account3Signer.address
      );

      // 0 - Checks that the transaction emitted the event
      await expect(badgeTransferTx)
        .to.emit(hydraS1AccountboundAttester, 'AttestationGenerated')
        .withArgs([
          (
            await hydraS1AccountboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()
          ).add(proofRequest.group.properties.groupIndex),
          account3Signer.address,
          hydraS1AccountboundAttester.address,
          proofRequest.value,
          proofRequest.group.properties.generationTimestamp,
          extraData,
        ]);

      // 1 - Checks that the provided nullifier was successfully recorded in the attester
      expect(
        await hydraS1AccountboundAttester.getDestinationOfNullifier(
          BigNumber.from(inputs.publicInputs.nullifier)
        )
      ).to.equal(account3Signer.address);

      expect(
        await hydraS1AccountboundAttester.getNullifierCooldownStart(
          BigNumber.from(inputs.publicInputs.nullifier)
        )
      ).to.be.eql((await ethers.provider.getBlock('latest')).timestamp);

      expect(
        await hydraS1AccountboundAttester.getNullifierBurnCount(
          BigNumber.from(inputs.publicInputs.nullifier)
        )
      ).to.be.eql(1); // burnCount should be incremented

      // 2 - Checks that the attester recorded the attestation in the registry
      expect(await attestationsRegistry.hasAttestation(badgeId, account3Signer.address)).to.be.true;

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
      // we use the same proof request as before to check that the token Id is indeed the nullifier used for the badge
      const proofRequest: HydraS1ProofRequest = {
        sources: [account3],
        destination: account3,
        value: BigNumber.from(1),
        group: groups[0],
        attesterAddress: hydraS1AccountboundAttester.address,
      };

      const { inputs } = await provingScheme.generateProof(proofRequest, {
        registryTree,
        accountsTreesWithData,
      });

      expect(
        await zkBadgeboundERC721.ownerOf(BigNumber.from(inputs.publicInputs.nullifier))
      ).to.be.eql(account3Signer.address);
    });

    it('dest0x2 should NOT be able to transfer the nft1 on 0x3', async () => {
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

      // retrieve old nullifier that was used to mint a nft on 0x3 (nullifier for the badge)
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

      await expect(
        zkBadgeboundERC721
          .connect(account2Signer)
          .transferFrom(
            account2Signer.address,
            account3Signer.address,
            BigNumber.from(inputs.publicInputs.nullifier)
          )
      ).to.be.revertedWith(
        `BadgeNullifierNotEqualToTokenId(${BigNumber.from(
          oldInputs.publicInputs.nullifier
        )}, ${BigNumber.from(inputs.publicInputs.nullifier)})'`
      );
    });

    it('dest0x2 should NOT be able to transfer the nft1 on 0x3 even with a valid proof (proof with 0x1)', async () => {
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
  });
});
