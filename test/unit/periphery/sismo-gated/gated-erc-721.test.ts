import { encodeAccountBoundAttestationExtraData } from '../../../utils/hydra-s1-accountbound';
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
  AttestationsRegistry,
  AvailableRootsRegistry,
  Badges,
  CommitmentMapperRegistry,
  HydraS1AccountboundAttester,
  HydraS1Verifier,
  MockGatedERC721,
} from 'types';
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
  GenerateRequestAndProofReturnType,
  generateRequestAndProof,
} from '../../../utils';
import { formatBytes32String } from 'ethers/lib/utils';

describe('Test Gated ERC721 Mock Contract with accountbound behaviour', () => {
  let attestationsRegistry: AttestationsRegistry;
  let hydraS1AccountboundAttester: HydraS1AccountboundAttester;
  let hydraS1Verifier: HydraS1Verifier;
  let commitmentMapperRegistry: CommitmentMapperRegistry;
  let availableRootsRegistry: AvailableRootsRegistry;
  let badges: Badges;
  let mockGatedERC721: MockGatedERC721;

  let prover: HydraS1Prover;
  let commitmentMapper: CommitmentMapperTester;
  let commitmentMapperPubKey: EddsaPublicKey;

  let deployer: SignerWithAddress;
  let destinationSigner: SignerWithAddress;
  let destination2Signer: SignerWithAddress;
  let randomSigner: SignerWithAddress;

  let hydraS1Accounts: HydraS1Account[];

  let chainId: number;

  let source: HydraS1Account;
  let otherSource: HydraS1Account;
  let destination: HydraS1Account;
  let destination2: HydraS1Account;
  let randomDestination: HydraS1Account;

  let sources: HydraS1Account[];
  let destinations: HydraS1Account[];

  let sourceValue: BigNumber;
  let otherSourceValue: BigNumber;
  let sourceValue2: BigNumber;
  let registryTree: KVMerkleTree;
  let accountsTree: KVMerkleTree;
  let accountsTree2: KVMerkleTree;
  let accountsTrees: KVMerkleTree[];
  let group: HydraS1SimpleGroup;
  let group2: HydraS1SimpleGroup;
  let allAvailableGroups: GroupData[];
  let externalNullifier: BigNumber;
  let externalNullifier2: BigNumber;
  let cooldownDuration: number;
  let userParams;
  let userParams2;
  let inputs: Inputs;
  let inputs2: Inputs;
  let proof: SnarkProof;
  let proof2: SnarkProof;
  let request: RequestStruct;
  let request2: RequestStruct;

  let badgeId: BigNumber;
  let badgeId2: BigNumber;

  let evmSnapshotId: string;

  before(async () => {
    const signers = await hre.ethers.getSigners();
    [deployer, destinationSigner, destination2Signer, , , randomSigner] = signers;

    chainId = parseInt(await hre.getChainId());

    commitmentMapper = await CommitmentMapperTester.generate();
    commitmentMapperPubKey = await commitmentMapper.getPubKey();

    hydraS1Accounts = await generateHydraS1Accounts(signers, commitmentMapper);
    [source, destination, destination2, , , randomDestination] = hydraS1Accounts;

    allAvailableGroups = await generateGroups(hydraS1Accounts);

    const { dataFormat, groups } = await generateAttesterGroups(allAvailableGroups);

    registryTree = dataFormat.registryTree;
    [accountsTree, accountsTree2] = dataFormat.accountsTrees;
    [group, group2] = groups;
    sourceValue = accountsTree.getValue(BigNumber.from(source.identifier).toHexString());
    sourceValue2 = accountsTree2.getValue(BigNumber.from(source.identifier).toHexString());

    prover = new HydraS1Prover(registryTree, commitmentMapperPubKey);

    // new future way of generating proving data
    // but not correct for now so just commenting it out

    // const res = await generateProvingData();
    // const provingData = await generateProvingData({
    //   groups: res.groups,
    // });

    // accountsTrees = provingData.accountsTrees;
    // registryTree = provingData.registryTree;
    // sources = provingData.sources;
    // destinations = provingData.destinations;

    // source = sources[0];
    // destination = destinations[0];

    // [group, group2] = provingData.groups;

    // sourceValue = accountsTrees[0].getValue(BigNumber.from(source.identifier).toHexString());
    // sourceValue2 = accountsTrees[1].getValue(BigNumber.from(source.identifier).toHexString());

    // prover = new HydraS1Prover(provingData.registryTree, provingData.commitmentMapperPubKey);

    cooldownDuration = 60 * 60 * 24;
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
        badges,
        commitmentMapperRegistry,
        availableRootsRegistry,
      } = await hre.run('0-deploy-core-and-hydra-s1-simple-and-accountbound-and-pythia1', {
        options: { deploymentNamePrefix: 'gated-erc721' },
      }));

      const root = registryTree.getRoot();
      await availableRootsRegistry.registerRootForAttester(
        hydraS1AccountboundAttester.address,
        root
      );

      expect(await hydraS1AccountboundAttester.owner()).to.be.eql(deployer.address);

      ({ mockGatedERC721 } = await hre.run('deploy-mock-gated-erc-721', {
        badgesLocalAddress: badges.address,
        hydraS1AccountboundLocalAddress: hydraS1AccountboundAttester.address,
      }));

      badgeId = (await hydraS1AccountboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()).add(
        group.properties.groupIndex
      );

      badgeId2 = (await hydraS1AccountboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()).add(
        group2.properties.groupIndex
      );

      // 0 - Checks that the verifier, available roots registry, commitment mapper registry and attestations registry are set
      expect(await hydraS1AccountboundAttester.getVerifier()).to.equal(hydraS1Verifier.address);
      expect(await hydraS1AccountboundAttester.getAvailableRootsRegistry()).to.equal(
        availableRootsRegistry.address
      );
      expect(await hydraS1AccountboundAttester.getCommitmentMapperRegistry()).to.equal(
        commitmentMapperRegistry.address
      );
      expect(await hydraS1AccountboundAttester.getAttestationRegistry()).to.equal(
        attestationsRegistry.address
      );
    });

    it('Should set a cooldown duration for a groupIndex', async () => {
      // set a cooldown of 1 day for first group
      const setCooldownDurationTransaction = await hydraS1AccountboundAttester
        .connect(deployer)
        .setCooldownDurationForGroupIndex(group.properties.groupIndex, cooldownDuration);

      await expect(setCooldownDurationTransaction)
        .to.emit(hydraS1AccountboundAttester, 'CooldownDurationSetForGroupIndex')
        .withArgs(group.properties.groupIndex, cooldownDuration);

      expect(
        await hydraS1AccountboundAttester.getCooldownDurationForGroupIndex(
          group.properties.groupIndex
        )
      ).to.be.eql(cooldownDuration);

      // set a cooldown of 1 day for second group
      const setCooldownDurationTransaction2 = await hydraS1AccountboundAttester
        .connect(deployer)
        .setCooldownDurationForGroupIndex(group2.properties.groupIndex, cooldownDuration);
    });

    after(async () => {
      const requestAndProof: GenerateRequestAndProofReturnType = await generateRequestAndProof({
        prover,
        attester: hydraS1AccountboundAttester,
        group,
        source,
        destination,
        sourceValue,
        chainId,
        accountsTree: accountsTree,
      });

      proof = requestAndProof.proof;
      request = requestAndProof.request;
      inputs = requestAndProof.inputs;
      userParams = requestAndProof.userParams;
      externalNullifier = requestAndProof.externalNullifier;
    });
  });

  /*************************************************************************************/
  /******************************* GENERATE ATTESTATIONS *******************************/
  /*************************************************************************************/
  describe('Generate Attestations and try minting without proofs', () => {
    it('Should generate a proof with Hydra S1 Prover and verify it onchain using the attester', async () => {
      evmSnapshotId = await evmSnapshot(hre);

      const generateAttestationsTransaction =
        await hydraS1AccountboundAttester.generateAttestations(request, proof.toBytes());

      const extraData = await attestationsRegistry.getAttestationExtraData(
        await (
          await hydraS1AccountboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()
        ).add(group.properties.groupIndex),
        BigNumber.from(destination.identifier).toHexString()
      );

      // 0 - Checks that the transaction emitted the event
      await expect(generateAttestationsTransaction)
        .to.emit(hydraS1AccountboundAttester, 'AttestationGenerated')
        .withArgs([
          await (
            await hydraS1AccountboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()
          ).add(group.properties.groupIndex),
          request.destination,
          hydraS1AccountboundAttester.address,
          sourceValue,
          group.properties.generationTimestamp,
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
      expect(await attestationsRegistry.hasAttestation(badgeId, destinationSigner.address)).to.be
        .true;
    });

    it('Should revert safeMint because of a wrong destination address', async () => {
      await expect(
        mockGatedERC721.connect(destinationSigner).safeMint(destination2Signer.address, 0)
      ).to.be.revertedWith(
        `UserIsNotOwnerOfBadge(${badgeId}, ${await mockGatedERC721.GATED_BADGE_MIN_LEVEL()})`
      );

      expect(await mockGatedERC721.balanceOf(destinationSigner.address)).to.be.eql(
        BigNumber.from(0)
      );
    });

    it('Should mint a NFT with a nullifier not already stored and a correct destination address (attestation already generated in AttestationsRegistry)', async () => {
      const extraData = await attestationsRegistry.getAttestationExtraData(
        (
          await hydraS1AccountboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()
        ).add(group.properties.groupIndex),
        destinationSigner.address
      );

      await mockGatedERC721.connect(destinationSigner).safeMint(destinationSigner.address, 0);

      expect(await mockGatedERC721.balanceOf(destinationSigner.address)).to.be.eql(
        BigNumber.from(1)
      );
    });

    it('Should revert the mint if nullifier already stored', async () => {
      await expect(
        mockGatedERC721.connect(destinationSigner).safeMint(destinationSigner.address, 1)
      ).to.be.revertedWith(`NFTAlreadyMinted()`);
    });

    it('Should be able to change the destination, deleting the old attestation (since the cooldown duration is zero)', async () => {
      const newProof = await prover.generateSnarkProof({
        ...userParams,
        destination: destination2,
      });

      const newRequest = {
        ...request,
        destination: BigNumber.from(destination2.identifier).toHexString(),
      };

      const generateAttestationsTransaction =
        await hydraS1AccountboundAttester.generateAttestations(newRequest, newProof.toBytes());

      const attestationsExtraData = await attestationsRegistry.getAttestationExtraData(
        (
          await hydraS1AccountboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()
        ).add(group.properties.groupIndex),
        BigNumber.from(destination2.identifier).toHexString()
      );

      // 0 - Checks that the transaction emitted the event
      await expect(generateAttestationsTransaction)
        .to.emit(hydraS1AccountboundAttester, 'AttestationGenerated')
        .withArgs([
          await (
            await hydraS1AccountboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()
          ).add(group.properties.groupIndex),
          newRequest.destination,
          hydraS1AccountboundAttester.address,
          sourceValue,
          group.properties.generationTimestamp,
          attestationsExtraData,
        ]);
      await expect(generateAttestationsTransaction)
        .to.emit(hydraS1AccountboundAttester, 'NullifierDestinationUpdated')
        .withArgs(inputs.publicInputs.nullifier, destination2.identifier);
      await expect(generateAttestationsTransaction)
        .to.emit(hydraS1AccountboundAttester, 'NullifierSetOnCooldown')
        .withArgs(inputs.publicInputs.nullifier, 1);

      // 1 - Checks that the nullifier informations were successfully updated
      expect(
        await hydraS1AccountboundAttester.getDestinationOfNullifier(
          BigNumber.from(inputs.publicInputs.nullifier)
        )
      ).to.be.equal(BigNumber.from(destination2.identifier));

      expect(
        await hydraS1AccountboundAttester.getNullifierCooldownStart(
          BigNumber.from(inputs.publicInputs.nullifier)
        )
      ).to.be.eql((await ethers.provider.getBlock('latest')).timestamp);

      expect(
        await hydraS1AccountboundAttester.getNullifierBurnCount(
          BigNumber.from(inputs.publicInputs.nullifier)
        )
      ).to.be.eql(1); // the burnCount should be incremented

      // burnCount should be recorded in the attestationsRegistry
      expect(
        await attestationsRegistry.getAttestationExtraData(
          (
            await hydraS1AccountboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()
          ).add(group.properties.groupIndex),
          destination2Signer.address
        )
      ).to.equal(attestationsExtraData);

      // 2 - Checks that the attester unrecorded & rerecorded the attestation in the registry
      // 2.1 - Checks that the old destination has not anymore it's attestation
      expect(await attestationsRegistry.hasAttestation(badgeId, destinationSigner.address)).to.be
        .false;

      // 2.2 - Checks that the new destination has it's attestation
      expect(await attestationsRegistry.hasAttestation(badgeId, destination2Signer.address)).to.be
        .true;
    });

    it('Should revert the mint if the nft has already been minted for a specific nullifier', async () => {
      await expect(
        mockGatedERC721.connect(destination2Signer).safeMint(destination2Signer.address, 1)
      ).to.be.revertedWith(`NFTAlreadyMinted()`);
    });
  });

  describe('Tests safeTransferFrom without proof', () => {
    it('Should revert the safeTransferFrom because the user wants to transfer to a destination NOT holding the badge (nullifier already stored and proof is valid)', async () => {
      await expect(
        mockGatedERC721
          .connect(destinationSigner)
          ['safeTransferFrom(address,address,uint256)'](
            destinationSigner.address,
            randomSigner.address,
            0
          )
      ).to.be.revertedWith(
        `UserIsNotOwnerOfBadge(${badgeId}, ${await mockGatedERC721.GATED_BADGE_MIN_LEVEL()})`
      );
    });

    it('Should allow the safeTransferFrom because the destination is holding the badge (nullifier already stored)', async () => {
      await mockGatedERC721
        .connect(destinationSigner)
        ['safeTransferFrom(address,address,uint256)'](
          destinationSigner.address,
          destination2Signer.address,
          0
        );

      // the previous holder should hold no NFT
      expect(await mockGatedERC721.balanceOf(destinationSigner.address)).to.be.eql(
        BigNumber.from(0)
      );

      // the current holder should hold the NFT
      expect(await mockGatedERC721.balanceOf(destination2Signer.address)).to.be.eql(
        BigNumber.from(1)
      );
    });

    it('Should be able to change the destination of the badge multiple times and transfer the nft to a destination holding the badge whenever the user wants', async () => {
      increaseTime(hre, cooldownDuration);
      await hydraS1AccountboundAttester.generateAttestations(request, proof.toBytes());

      expect(
        await hydraS1AccountboundAttester.getNullifierBurnCount(
          BigNumber.from(inputs.publicInputs.nullifier)
        )
      ).to.be.eql(2); // the burnCount should be incremented

      let newProof = await prover.generateSnarkProof({
        ...userParams,
        destination: randomDestination,
      });

      let newRequest = {
        ...request,
        destination: BigNumber.from(randomDestination.identifier).toHexString(),
      };

      increaseTime(hre, cooldownDuration);
      await hydraS1AccountboundAttester.generateAttestations(newRequest, newProof.toBytes());

      expect(
        await hydraS1AccountboundAttester.getNullifierBurnCount(
          BigNumber.from(inputs.publicInputs.nullifier)
        )
      ).to.be.eql(3); // the burnCount should be incremented

      increaseTime(hre, cooldownDuration);

      await mockGatedERC721
        .connect(destination2Signer)
        ['safeTransferFrom(address,address,uint256)'](
          destination2Signer.address,
          randomSigner.address,
          0
        );

      // the current holder should hold the NFT
      expect(await mockGatedERC721.balanceOf(randomSigner.address)).to.be.eql(BigNumber.from(1));

      // the previous holder should hold no NFT
      expect(await mockGatedERC721.balanceOf(destination2Signer.address)).to.be.eql(
        BigNumber.from(0)
      );

      evmRevert(hre, evmSnapshotId);
    }).timeout(80000);
  });

  describe('Tests mintWithSismo function with proofs', () => {
    it('Should revert the mintWithSismo because a proof is provided but the destination does not match the `to` address', async () => {
      evmSnapshotId = await evmSnapshot(hre);
      // verify that the address dos not hold any attestations
      expect(await attestationsRegistry.hasAttestation(badgeId, destination2Signer.address)).to.be
        .false;
      // verify that the address does not hold any NFT
      expect(await mockGatedERC721.balanceOf(destination2Signer.address)).to.be.eql(
        BigNumber.from(0)
      );

      await expect(
        mockGatedERC721.mintWithSismo(
          destination2Signer.address, // wrong `to` address -> should be `destinationSigner.address`
          1,
          request,
          proof.toBytes()
        )
      ).to.be.revertedWith(
        `UserIsNotOwnerOfBadge(${badgeId}, ${await mockGatedERC721.GATED_BADGE_MIN_LEVEL()})`
      );
    });

    it('Should revert the mintWithSismo because the user wants to generate a valid attestation with a value lower than the minimum balance required (nullifier not stored and no attestations generated)', async () => {
      let newAllAvailableGroups = await generateGroups(hydraS1Accounts);
      // introduce a new value of 0 for the source
      newAllAvailableGroups[0] = {
        ...newAllAvailableGroups[0],
        [BigNumber.from(source.identifier).toHexString()]: 0,
      };
      const { dataFormat: newDataFormat, groups: newGroups } = await generateAttesterGroups(
        newAllAvailableGroups
      );

      // create new merkle trees
      const newRegistryTree = newDataFormat.registryTree;
      const newAccountsTree = newDataFormat.accountsTrees[0];
      // get new groups
      const newGroup = newGroups[0];

      // get new source value
      const newSourceValue = newAccountsTree.getValue(
        BigNumber.from(source.identifier).toHexString()
      );
      const newProver = new HydraS1Prover(newRegistryTree, commitmentMapperPubKey);
      const newExternalNullifier = await generateExternalNullifier(
        hydraS1AccountboundAttester.address,
        newGroup.properties.groupIndex
      );

      const newUserParams = {
        source: source,
        destination: destination,
        claimedValue: newSourceValue,
        chainId: chainId,
        accountsTree: newAccountsTree,
        externalNullifier: newExternalNullifier,
        isStrict: !newGroup.properties.isScore,
      };

      const newProof = await newProver.generateSnarkProof(newUserParams);
      const newRequest = {
        claims: [
          {
            groupId: newGroup.id,
            claimedValue: newSourceValue,
            extraData: encodeGroupProperties(newGroup.properties),
          },
        ],
        destination: BigNumber.from(destination.identifier).toHexString(),
      };

      // register the new root
      await availableRootsRegistry.registerRootForAttester(
        hydraS1AccountboundAttester.address,
        newRegistryTree.getRoot()
      );

      await expect(
        mockGatedERC721
          .connect(destinationSigner)
          .mintWithSismo(destinationSigner.address, 0, newRequest, newProof.toBytes())
      ).to.be.revertedWith(
        `UserIsNotOwnerOfBadge(${badgeId}, ${await mockGatedERC721.GATED_BADGE_MIN_LEVEL()})`
      );
    });

    it('Should allow the mintWithSismo because the proof is provided (nullifier not stored and no attestations generated)', async () => {
      // verify that the address dos not hold any attestations
      expect(await attestationsRegistry.hasAttestation(badgeId, destinationSigner.address)).to.be
        .false;

      // verify that the address does not hold any NFT
      expect(await mockGatedERC721.balanceOf(destinationSigner.address)).to.be.eql(
        BigNumber.from(0)
      );

      await mockGatedERC721.mintWithSismo(destinationSigner.address, 0, request, proof.toBytes());

      // verify that the address dos hold a new attestation
      expect(await attestationsRegistry.hasAttestation(badgeId, destinationSigner.address)).to.be
        .true;

      // verify that the address does hold a new NFT
      expect(await mockGatedERC721.balanceOf(destinationSigner.address)).to.be.eql(
        BigNumber.from(1)
      );
    });

    it('Should revert the mintWithSismo because the proof is provided but nullifier is already stored', async () => {
      increaseTime(hre, cooldownDuration);
      const newProof = await prover.generateSnarkProof({
        ...userParams,
        destination: destination2,
      });
      const newRequest = {
        ...request,
        destination: BigNumber.from(destination2.identifier).toHexString(),
      };
      // verify that the address dos not hold any attestations
      expect(await attestationsRegistry.hasAttestation(badgeId, destination2Signer.address)).to.be
        .false;
      // verify that the address does not hold any NFT
      expect(await mockGatedERC721.balanceOf(destination2Signer.address)).to.be.eql(
        BigNumber.from(0)
      );
      await expect(
        mockGatedERC721.mintWithSismo(destination2Signer.address, 1, newRequest, newProof.toBytes())
      ).to.be.revertedWith(`NFTAlreadyMinted()`);
    });
  });

  describe('Tests transferWithSismo function with proofs', () => {
    it('Should revert the transferWithSismo because a proof is provided but the destination does not match the `to` address', async () => {
      evmSnapshotId = await evmSnapshot(hre);
      // verify that the address does hold attestation
      expect(await attestationsRegistry.hasAttestation(badgeId, destinationSigner.address)).to.be
        .true;
      // verify that the address does hold the NFT
      expect(await mockGatedERC721.balanceOf(destinationSigner.address)).to.be.eql(
        BigNumber.from(1)
      );

      // verify that the address dos not hold any attestations
      expect(await attestationsRegistry.hasAttestation(badgeId, destination2Signer.address)).to.be
        .false;
      // verify that the address does not hold any NFT
      expect(await mockGatedERC721.balanceOf(destination2Signer.address)).to.be.eql(
        BigNumber.from(0)
      );

      await expect(
        mockGatedERC721.transferWithSismo(
          destinationSigner.address,
          destination2Signer.address, // wrong `to` address -> should be `destinationSigner.address`
          1,
          request,
          proof.toBytes()
        )
      ).to.be.revertedWith(
        `UserIsNotOwnerOfBadge(${badgeId}, ${await mockGatedERC721.GATED_BADGE_MIN_LEVEL()})`
      );
    });

    it('Should revert the transferWithSismo because the user wants to generate a valid attestation with a value lower than the minimum balance required', async () => {
      let newAllAvailableGroups = await generateGroups(hydraS1Accounts);
      // introduce a new value of 0 for the source
      newAllAvailableGroups[0] = {
        ...newAllAvailableGroups[0],
        [BigNumber.from(source.identifier).toHexString()]: 0,
      };
      const { dataFormat: newDataFormat, groups: newGroups } = await generateAttesterGroups(
        newAllAvailableGroups
      );

      // create new merkle trees
      const newRegistryTree = newDataFormat.registryTree;
      const newAccountsTree = newDataFormat.accountsTrees[0];
      // get new groups
      const newGroup = newGroups[0];

      // get new source value
      const newSourceValue = newAccountsTree.getValue(
        BigNumber.from(source.identifier).toHexString()
      );
      const newProver = new HydraS1Prover(newRegistryTree, commitmentMapperPubKey);
      const newExternalNullifier = await generateExternalNullifier(
        hydraS1AccountboundAttester.address,
        newGroup.properties.groupIndex
      );

      const newUserParams = {
        source: source,
        destination: destination2,
        claimedValue: newSourceValue,
        chainId: chainId,
        accountsTree: newAccountsTree,
        externalNullifier: newExternalNullifier,
        isStrict: !newGroup.properties.isScore,
      };

      const newProof = await newProver.generateSnarkProof(newUserParams);
      const newRequest = {
        claims: [
          {
            groupId: newGroup.id,
            claimedValue: newSourceValue,
            extraData: encodeGroupProperties(newGroup.properties),
          },
        ],
        destination: BigNumber.from(destination2.identifier).toHexString(),
      };

      // register the new root
      await availableRootsRegistry.registerRootForAttester(
        hydraS1AccountboundAttester.address,
        newRegistryTree.getRoot()
      );

      await expect(
        mockGatedERC721
          .connect(destinationSigner)
          .transferWithSismo(
            destinationSigner.address,
            destination2Signer.address,
            0,
            newRequest,
            newProof.toBytes()
          )
      ).to.be.revertedWith(
        `UserIsNotOwnerOfBadge(${badgeId}, ${await mockGatedERC721.GATED_BADGE_MIN_LEVEL()})`
      );
    });

    it('Should allow the mintWithSismo because the proof is provided (nullifier stored and attestations already generated on address holding the NFT)', async () => {
      // verify that the address does hold attestation
      expect(await attestationsRegistry.hasAttestation(badgeId, destinationSigner.address)).to.be
        .true;
      // verify that the address does hold the NFT
      expect(await mockGatedERC721.balanceOf(destinationSigner.address)).to.be.eql(
        BigNumber.from(1)
      );

      // verify that the address dos not hold any attestations
      expect(await attestationsRegistry.hasAttestation(badgeId, destination2Signer.address)).to.be
        .false;
      // verify that the address does not hold any NFT
      expect(await mockGatedERC721.balanceOf(destination2Signer.address)).to.be.eql(
        BigNumber.from(0)
      );

      let newProof = await prover.generateSnarkProof({
        ...userParams,
        destination: destination2,
      });

      let newRequest = {
        ...request,
        destination: BigNumber.from(destination2.identifier).toHexString(),
      };

      await mockGatedERC721
        .connect(destinationSigner)
        .transferWithSismo(
          destinationSigner.address,
          destination2Signer.address,
          0,
          newRequest,
          newProof.toBytes()
        );

      // verify that the address does hold a new attestation
      expect(await attestationsRegistry.hasAttestation(badgeId, destination2Signer.address)).to.be
        .true;

      // verify that the address does hold a new NFT
      expect(await mockGatedERC721.balanceOf(destination2Signer.address)).to.be.eql(
        BigNumber.from(1)
      );

      // verify that the address dos not hold attestation anymore
      expect(await attestationsRegistry.hasAttestation(badgeId, destinationSigner.address)).to.be
        .false;
      // verify that the address does not hold NFT anymore
      expect(await mockGatedERC721.balanceOf(destinationSigner.address)).to.be.eql(
        BigNumber.from(0)
      );
    });
  });
});
