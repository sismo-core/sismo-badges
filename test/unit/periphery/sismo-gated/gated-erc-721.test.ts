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
} from '../../../utils';

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

  let chainId: number;

  let source: HydraS1Account;
  let destination: HydraS1Account;
  let destination2: HydraS1Account;
  let randomDestination: HydraS1Account;

  let sourceValue: BigNumber;
  let registryTree: KVMerkleTree;
  let accountsTree: KVMerkleTree;
  let accountsTree2: KVMerkleTree;
  let group: HydraS1SimpleGroup;
  let group2: HydraS1SimpleGroup;
  let allAvailableGroups: GroupData[];
  let externalNullifier: BigNumber;
  let cooldownDuration: number;
  let userParams;
  let inputs: Inputs;
  let proof: SnarkProof;
  let request: RequestStruct;

  let badgeId: BigNumber;

  let evmSnapshotId: string;

  before(async () => {
    const signers = await hre.ethers.getSigners();
    [deployer, destinationSigner, destination2Signer, , , randomSigner] = signers;

    chainId = parseInt(await hre.getChainId());

    commitmentMapper = await CommitmentMapperTester.generate();
    commitmentMapperPubKey = await commitmentMapper.getPubKey();

    let hydraS1Accounts = await generateHydraS1Accounts(signers, commitmentMapper);
    [source, destination, destination2, , , randomDestination] = hydraS1Accounts;

    allAvailableGroups = await generateGroups(hydraS1Accounts);
    const { dataFormat, groups } = await generateAttesterGroups(allAvailableGroups);

    registryTree = dataFormat.registryTree;
    [accountsTree, accountsTree2] = dataFormat.accountsTrees;
    [group, group2] = groups;
    sourceValue = accountsTree.getValue(BigNumber.from(source.identifier).toHexString());

    prover = new HydraS1Prover(registryTree, commitmentMapperPubKey);

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
      } = await hre.run('0-deploy-core-and-hydra-s1-simple-and-accountbound', {
        options: { deploymentNamePrefix: 'gated-erc721' },
      }));

      const root = registryTree.getRoot();
      await availableRootsRegistry.registerRootForAttester(
        hydraS1AccountboundAttester.address,
        root
      );

      await hydraS1AccountboundAttester.setOwner();
      expect(await hydraS1AccountboundAttester.owner()).to.be.eql(deployer.address);

      ({ mockGatedERC721 } = await hre.run('deploy-mock-gated-erc-721', {
        badgesAddress: badges.address,
        attesterAddress: hydraS1AccountboundAttester.address,
        gatedBadge: (
          await hydraS1AccountboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()
        ).add(group.properties.groupIndex),
      }));

      badgeId = (await hydraS1AccountboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()).add(
        group.properties.groupIndex
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
    });

    after(async () => {
      externalNullifier = await generateExternalNullifier(
        hydraS1AccountboundAttester.address,
        group.properties.groupIndex
      );

      userParams = {
        source: source,
        destination: destination,
        claimedValue: sourceValue,
        chainId: chainId,
        accountsTree: accountsTree,
        externalNullifier: externalNullifier,
        isStrict: !group.properties.isScore,
      };

      inputs = await prover.generateInputs(userParams);

      proof = await prover.generateSnarkProof(userParams);

      request = {
        claims: [
          {
            groupId: group.id,
            claimedValue: sourceValue,
            extraData: encodeGroupProperties(group.properties),
          },
        ],
        destination: BigNumber.from(destination.identifier).toHexString(),
      };

      evmSnapshotId = await evmSnapshot(hre);
    });
  });

  /*************************************************************************************/
  /******************************* GENERATE ATTESTATIONS *******************************/
  /*************************************************************************************/
  describe('Generate Attestations', () => {
    it('Should generate a proof with Hydra S1 Prover and verify it onchain using the attester', async () => {
      const generateAttestationsTransaction =
        await hydraS1AccountboundAttester.generateAttestations(request, proof.toBytes());

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
          encodeAccountBoundAttestationExtraData({
            nullifier: inputs.publicInputs.nullifier,
            burnCount: 0,
          }),
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
          ).add(group.properties.groupIndex),
          destinationSigner.address
        )
      ).to.be.true;
    });

    it('Should revert because of a wrong destination address', async () => {
      await expect(
        mockGatedERC721.connect(destinationSigner).safeMint(
          destination2Signer.address,
          0,
          [] // empty bytes data
        )
      ).to.be.revertedWith(`UserIsNotOwnerOfBadge(${badgeId})`);

      expect(await mockGatedERC721.balanceOf(destinationSigner.address)).to.be.eql(
        BigNumber.from(0)
      );
    });

    it('Should mint a NFT with a nullifier not already stored and a correct destination address', async () => {
      await mockGatedERC721.connect(destinationSigner).safeMint(
        destinationSigner.address,
        0,
        [] // empty bytes data
      );

      expect(await mockGatedERC721.balanceOf(destinationSigner.address)).to.be.eql(
        BigNumber.from(1)
      );
    });

    it('Should revert the mint if nullifier already stored', async () => {
      await expect(
        mockGatedERC721.connect(destinationSigner).safeMint(
          destinationSigner.address,
          1,
          [] // empty bytes data
        )
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
          encodeAccountBoundAttestationExtraData({
            nullifier: inputs.publicInputs.nullifier,
            burnCount: 1, // burn count should be incremented
          }),
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
      ).to.equal(
        encodeAccountBoundAttestationExtraData({
          nullifier: inputs.publicInputs.nullifier,
          burnCount: 1, // burnCount should be incremented
        })
      );

      // 2 - Checks that the attester unrecorded & rerecorded the attestation in the registry
      // 2.1 - Checks that the old destination has not anymore it's attestation
      expect(
        await attestationsRegistry.hasAttestation(
          (
            await hydraS1AccountboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()
          ).add(group.properties.groupIndex),
          destinationSigner.address
        )
      ).to.be.false;

      // 2.2 - Checks that the new destination has it's attestation
      expect(
        await attestationsRegistry.hasAttestation(
          (
            await hydraS1AccountboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()
          ).add(group.properties.groupIndex),
          destination2Signer.address
        )
      ).to.be.true;
    });

    it('Should revert the mint if the nft has already been minted for a specific nullifier', async () => {
      await expect(
        mockGatedERC721.connect(destination2Signer).safeMint(
          destination2Signer.address,
          1,
          [] // empty bytes data
        )
      ).to.be.revertedWith(`NFTAlreadyMinted()`);
    });

    it('Should allow the safeTransferFrom because the proof is provided for another destination holding the badge (nullifier already stored)', async () => {
      const newProof = await prover.generateSnarkProof({
        ...userParams,
        destination: destination2,
      });

      const newRequest = {
        ...request,
        destination: BigNumber.from(destination2.identifier).toHexString(),
      };

      await mockGatedERC721
        .connect(destinationSigner)
        ['safeTransferFrom(address,address,uint256,bytes)'](
          destinationSigner.address,
          destination2Signer.address,
          0,
          packRequestAndProofToBytes(newRequest, newProof)
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

    it('Should be able to change the destination of the badge multiple times and transfer the nft with proof whenever the user wants', async () => {
      let newProof = await prover.generateSnarkProof({
        ...userParams,
        destination: destination2,
      });

      let newRequest = {
        ...request,
        destination: BigNumber.from(destination2.identifier).toHexString(),
      };

      increaseTime(hre, cooldownDuration);
      await hydraS1AccountboundAttester.generateAttestations(request, proof.toBytes());

      expect(
        await hydraS1AccountboundAttester.getNullifierBurnCount(
          BigNumber.from(inputs.publicInputs.nullifier)
        )
      ).to.be.eql(2); // the burnCount should be incremented

      newProof = await prover.generateSnarkProof({
        ...userParams,
        destination: randomDestination,
      });

      newRequest = {
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
        ['safeTransferFrom(address,address,uint256,bytes)'](
          destination2Signer.address,
          randomSigner.address,
          0,
          packRequestAndProofToBytes(request, proof)
        );

      // the current holder should hold the NFT
      expect(await mockGatedERC721.balanceOf(randomSigner.address)).to.be.eql(BigNumber.from(1));

      // the previous holder should hold no NFT
      expect(await mockGatedERC721.balanceOf(destination2Signer.address)).to.be.eql(
        BigNumber.from(0)
      );
    });

    it('Should allow the safeMint because the proof is provided (nullifier not stored and no attestations generated)', async () => {
      evmRevert(hre, evmSnapshotId);

      // verify that the address dos not hold any attestations
      expect(await attestationsRegistry.hasAttestation(badgeId, destinationSigner.address)).to.be
        .false;

      // verify that the address does not hold any NFT
      expect(await mockGatedERC721.balanceOf(destinationSigner.address)).to.be.eql(
        BigNumber.from(0)
      );

      await mockGatedERC721.safeMint(
        destinationSigner.address,
        0,
        packRequestAndProofToBytes(request, proof)
      );

      // verify that the address dos hold a new attestation
      expect(await attestationsRegistry.hasAttestation(badgeId, destinationSigner.address)).to.be
        .true;

      // verify that the address does hold a new NFT
      expect(await mockGatedERC721.balanceOf(destinationSigner.address)).to.be.eql(
        BigNumber.from(1)
      );
    });

    it('Should revert the safeMint because the proof is provided but nullifier is already stored', async () => {
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
        mockGatedERC721.safeMint(
          destination2Signer.address,
          1,
          packRequestAndProofToBytes(newRequest, newProof)
        )
      ).to.be.revertedWith(`NFTAlreadyMinted()`);
    });
  });
});
