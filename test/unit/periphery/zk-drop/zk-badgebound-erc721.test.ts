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

  let deployer: SignerWithAddress;
  let sourceSigner: SignerWithAddress;
  let source2Signer: SignerWithAddress;
  let source3Signer: SignerWithAddress;
  let source4Signer: SignerWithAddress;
  let source5Signer: SignerWithAddress;
  let destinationSigner: SignerWithAddress;
  let destination2Signer: SignerWithAddress;
  let destination3Signer: SignerWithAddress;
  let destination4Signer: SignerWithAddress;
  let destination5Signer: SignerWithAddress;
  let randomSigner: SignerWithAddress;

  let chainId: number;

  let sourcesSigners: SignerWithAddress[];
  let destinationsSigners: SignerWithAddress[];

  let badgeId: BigNumber;
  let badgeId2: BigNumber;

  let provingData: ProvingDataStruct;
  let accountsTreesWithData: { tree: KVMerkleTree; group: HydraS1SimpleGroup }[];
  let registryTree: KVMerkleTree;
  let groups: HydraS1SimpleGroup[];
  let sources: HydraS1Account[];
  let sourcesValues: BigNumber[][] = [[]];
  let destinations: HydraS1Account[];
  let destinationsValues: BigNumber[][] = [[]];

  let source1: HydraS1Account;
  let source2: HydraS1Account;
  let source3: HydraS1Account;
  let source4: HydraS1Account;
  let source5: HydraS1Account;
  let destination1: HydraS1Account;
  let destination2: HydraS1Account;
  let destination3: HydraS1Account;
  let destination4: HydraS1Account;
  let destination5: HydraS1Account;
  let zeroAddress: string;

  let prover: HydraS1Prover;
  let commitmentMapper: CommitmentMapperTester;
  let commitmentMapperPubKey: EddsaPublicKey;

  let provingScheme: HydraS1ZKPS;

  let cooldownDuration: number;
  let evmSnapshotId: string;

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

    sources = provingData.sources;
    destinations = provingData.destinations;

    const values = getValuesFromAccountsTrees(groups, accountsTreesWithData);
    sourcesValues = values.sourcesValues;

    provingScheme = new HydraS1ZKPS(provingData.commitmentMapperPubKey, chainId);

    cooldownDuration = 60 * 60 * 24;

    // data to reuse everywhere

    sourcesSigners = (await ethers.getSigners()).slice(0, 10);
    destinationsSigners = (await ethers.getSigners()).slice(10, 20);

    deployer = sourcesSigners[0];
    sourceSigner = sourcesSigners[1];
    source2Signer = sourcesSigners[2];
    source3Signer = sourcesSigners[3];
    source4Signer = sourcesSigners[4];
    source5Signer = sourcesSigners[5];

    destinationSigner = destinationsSigners[1];
    destination2Signer = destinationsSigners[2];
    destination3Signer = destinationsSigners[3];
    destination4Signer = destinationsSigners[4];
    destination5Signer = destinationsSigners[5];

    source1 = sources[1];
    source2 = sources[2];
    source3 = sources[3];
    source4 = sources[4];
    source5 = sources[5];

    destination1 = destinations[1];
    destination2 = destinations[2];
    destination3 = destinations[3];
    destination4 = destinations[4];
    destination5 = destinations[5];

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

      ({ zkBadgeboundERC721 } = await hre.run('deploy-zk-badgebound-erc721', {}));

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
      evmSnapshotId = await evmSnapshot(hre);

      const proofRequest: HydraS1ProofRequest = {
        sources: [source1],
        destination: destination2,
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
      ).to.equal(request.destination);

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
      expect(
        await attestationsRegistry.hasAttestation(
          (
            await hydraS1AccountboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()
          ).add(proofRequest.group.properties.groupIndex),
          request.destination
        )
      ).to.be.true;
    });

    it('dest 0x2 should not be able to mint the ERC721 on 0x3 without proof', async () => {
      await expect(
        zkBadgeboundERC721.connect(destination2Signer).claimTo(destination3Signer.address)
      ).to.be.revertedWith('UserDoesNotMeetRequirements()');
    });

    it('dest 0x2 should be able to mint the ERC721 on 0x2 (by calling `claim`)', async () => {
      evmSnapshotId = await evmSnapshot(hre);

      expect(await zkBadgeboundERC721.balanceOf(destination2Signer.address)).to.be.eql(
        BigNumber.from(0)
      );

      await zkBadgeboundERC721.connect(destination2Signer).claim();

      expect(await zkBadgeboundERC721.balanceOf(destination2Signer.address)).to.be.eql(
        BigNumber.from(1)
      );

      evmRevert(hre, evmSnapshotId);
    });

    it('dest 0x2 should be able to mint the ERC721 on 0x2 (by calling `claimTo`)', async () => {
      const proofRequest: HydraS1ProofRequest = {
        sources: [source1],
        destination: destination2,
        value: BigNumber.from(1),
        group: groups[0],
        attesterAddress: hydraS1AccountboundAttester.address,
      };

      const { inputs } = await provingScheme.generateProof(proofRequest, {
        registryTree,
        accountsTreesWithData,
      });

      expect(await zkBadgeboundERC721.balanceOf(destination2Signer.address)).to.be.eql(
        BigNumber.from(0)
      );

      await zkBadgeboundERC721.connect(destination2Signer).claimTo(destination2Signer.address);

      expect(await zkBadgeboundERC721.balanceOf(destination2Signer.address)).to.be.eql(
        BigNumber.from(1)
      );
    });

    it('source 0x1 transfers the ZK Badge from dest 0x2 to dest 0x3 (same user controls source 0x1, dest 0x2 and dest 0x3)', async () => {
      const proofRequest: HydraS1ProofRequest = {
        sources: [source1],
        destination: destination3,
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
          destination3Signer.address,
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
      ).to.equal(destination3Signer.address);

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
          destination2Signer.address
        )
      ).to.be.false;

      expect(
        await attestationsRegistry.hasAttestation(
          (
            await hydraS1AccountboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()
          ).add(proofRequest.group.properties.groupIndex),
          destination3Signer.address
        )
      ).to.be.true;
    });

    it('0x3 should NOT be able to mint the ERC721 (one ERC721 per source, using `claim`)', async () => {
      await expect(zkBadgeboundERC721.connect(destination3Signer).claim()).to.be.revertedWith(
        'ERC721: token already minted'
      );
    });

    it('0x3 should NOT be able to mint the ERC721 (one ERC721 per source, using `claimTo`)', async () => {
      await expect(
        zkBadgeboundERC721.connect(destination3Signer).claimTo(destination3Signer.address)
      ).to.be.revertedWith('ERC721: token already minted');
    });

    it('0x2 should be able to transfer the ERC721 from 0x2 to 0x3 (using `safeTransferFrom`)', async () => {
      evmSnapshotId = await evmSnapshot(hre);
      const proofRequest: HydraS1ProofRequest = {
        sources: [source1],
        destination: destination3,
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
      ).to.be.eql(destination2Signer.address);

      expect(await zkBadgeboundERC721.balanceOf(destination3Signer.address)).to.be.eql(
        BigNumber.from(0)
      );

      await zkBadgeboundERC721
        .connect(destination2Signer)
        ['safeTransferFrom(address,address,uint256)'](
          destination2Signer.address,
          destination3Signer.address,
          BigNumber.from(inputs.publicInputs.nullifier)
        );

      expect(
        await zkBadgeboundERC721.ownerOf(BigNumber.from(inputs.publicInputs.nullifier))
      ).to.be.eql(destination3Signer.address);

      expect(await zkBadgeboundERC721.balanceOf(destination2Signer.address)).to.be.eql(
        BigNumber.from(0)
      );

      expect(await zkBadgeboundERC721.balanceOf(destination3Signer.address)).to.be.eql(
        BigNumber.from(1)
      );

      await evmRevert(hre, evmSnapshotId);
    });

    it('0x2 should be able to transfer the ERC721 from 0x2 to 0x3 (using `transferFrom`)', async () => {
      evmSnapshotId = await evmSnapshot(hre);
      const proofRequest: HydraS1ProofRequest = {
        sources: [source1],
        destination: destination3,
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
      ).to.be.eql(destination2Signer.address);

      expect(await zkBadgeboundERC721.balanceOf(destination3Signer.address)).to.be.eql(
        BigNumber.from(0)
      );

      await zkBadgeboundERC721
        .connect(destination2Signer)
        .transferFrom(
          destination2Signer.address,
          destination3Signer.address,
          BigNumber.from(inputs.publicInputs.nullifier)
        );

      expect(
        await zkBadgeboundERC721.ownerOf(BigNumber.from(inputs.publicInputs.nullifier))
      ).to.be.eql(destination3Signer.address);

      expect(await zkBadgeboundERC721.balanceOf(destination2Signer.address)).to.be.eql(
        BigNumber.from(0)
      );

      expect(await zkBadgeboundERC721.balanceOf(destination3Signer.address)).to.be.eql(
        BigNumber.from(1)
      );
    });

    it('0x3 should be able to transfer ERC721 from 0x3 to any destination with a valid proof of ownership of 0x1 and new destination (badge will be also transferred)', async () => {
      increaseTime(hre, cooldownDuration);

      const proofRequest: HydraS1ProofRequest = {
        sources: [source1],
        destination: destination4,
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
      ).to.be.eql(destination3Signer.address);

      expect(await zkBadgeboundERC721.balanceOf(destination4Signer.address)).to.be.eql(
        BigNumber.from(0)
      );

      const transferTx = await zkBadgeboundERC721
        .connect(destination3Signer)
        .transferWithSismo(
          destination3Signer.address,
          destination4Signer.address,
          BigNumber.from(inputs.publicInputs.nullifier),
          request,
          proofData
        );

      // it should transfer the nft to the new destination
      expect(
        await zkBadgeboundERC721.ownerOf(BigNumber.from(inputs.publicInputs.nullifier))
      ).to.be.eql(destination4Signer.address);

      expect(await zkBadgeboundERC721.balanceOf(destination3Signer.address)).to.be.eql(
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
      ).to.equal(destination4Signer.address);

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
          destination3Signer.address
        )
      ).to.be.false;
    });
  });
});
