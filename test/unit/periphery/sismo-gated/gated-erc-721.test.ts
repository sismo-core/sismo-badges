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
import { BigNumber } from 'ethers';
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

  before(async () => {
    const signers = await hre.ethers.getSigners();
    [deployer, destinationSigner, destination2Signer, , , randomSigner] = signers;

    chainId = parseInt(await hre.getChainId());

    commitmentMapper = await CommitmentMapperTester.generate();
    commitmentMapperPubKey = await commitmentMapper.getPubKey();

    let hydraS1Accounts = await generateHydraS1Accounts(signers, commitmentMapper);
    [source, destination, destination2] = hydraS1Accounts;

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
        gatedBadges: [BigNumber.from(15151111)],
      }));

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

    //   it('Should be able to change the destination, deleting the old attestation (since the cooldown duration is zero)', async () => {
    //     const newProof = await prover.generateSnarkProof({
    //       ...userParams,
    //       destination: destination2,
    //     });

    //     const newRequest = {
    //       ...request,
    //       destination: BigNumber.from(destination2.identifier).toHexString(),
    //     };

    //     const generateAttestationsTransaction =
    //       await hydraS1AccountboundAttester.generateAttestations(newRequest, newProof.toBytes());

    //     // 0 - Checks that the transaction emitted the event
    //     await expect(generateAttestationsTransaction)
    //       .to.emit(hydraS1AccountboundAttester, 'AttestationGenerated')
    //       .withArgs([
    //         await (
    //           await hydraS1AccountboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()
    //         ).add(group.properties.groupIndex),
    //         newRequest.destination,
    //         hydraS1AccountboundAttester.address,
    //         sourceValue,
    //         group.properties.generationTimestamp,
    //         encodeAccountBoundAttestationExtraData({
    //           nullifier: inputs.publicInputs.nullifier,
    //           burnCount: 1, // burn count should be incremented
    //         }),
    //       ]);
    //     await expect(generateAttestationsTransaction)
    //       .to.emit(hydraS1AccountboundAttester, 'NullifierDestinationUpdated')
    //       .withArgs(inputs.publicInputs.nullifier, destination2.identifier);
    //     await expect(generateAttestationsTransaction)
    //       .to.emit(hydraS1AccountboundAttester, 'NullifierSetOnCooldown')
    //       .withArgs(inputs.publicInputs.nullifier, 1);

    //     // 1 - Checks that the nullifier informations were successfully updated
    //     expect(
    //       await hydraS1AccountboundAttester.getDestinationOfNullifier(
    //         BigNumber.from(inputs.publicInputs.nullifier)
    //       )
    //     ).to.be.equal(BigNumber.from(destination2.identifier));

    //     expect(
    //       await hydraS1AccountboundAttester.getNullifierCooldownStart(
    //         BigNumber.from(inputs.publicInputs.nullifier)
    //       )
    //     ).to.be.eql((await ethers.provider.getBlock('latest')).timestamp);

    //     expect(
    //       await hydraS1AccountboundAttester.getNullifierBurnCount(
    //         BigNumber.from(inputs.publicInputs.nullifier)
    //       )
    //     ).to.be.eql(1); // the burnCount should be incremented

    //     // burnCount should be recorded in the attestationsRegistry
    //     expect(
    //       await attestationsRegistry.getAttestationExtraData(
    //         (
    //           await hydraS1AccountboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()
    //         ).add(group.properties.groupIndex),
    //         destination2Signer.address
    //       )
    //     ).to.equal(
    //       encodeAccountBoundAttestationExtraData({
    //         nullifier: inputs.publicInputs.nullifier,
    //         burnCount: 1, // burnCount should be incremented
    //       })
    //     );

    //     // 2 - Checks that the attester unrecorded & rerecorded the attestation in the registry
    //     // 2.1 - Checks that the old destination has not anymore it's attestation
    //     expect(
    //       await attestationsRegistry.hasAttestation(
    //         (
    //           await hydraS1AccountboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()
    //         ).add(group.properties.groupIndex),
    //         destinationSigner.address
    //       )
    //     ).to.be.false;

    //     // 2.2 - Checks that the new destination has it's attestation
    //     expect(
    //       await attestationsRegistry.hasAttestation(
    //         (
    //           await hydraS1AccountboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()
    //         ).add(group.properties.groupIndex),
    //         destination2Signer.address
    //       )
    //     ).to.be.true;
    //   });

    //   it('Should revert if the nullifier is in cooldown', async () => {
    //     const burnCount = await hydraS1AccountboundAttester.getNullifierBurnCount(
    //       BigNumber.from(inputs.publicInputs.nullifier)
    //     );

    //     const destination = await hydraS1AccountboundAttester.getDestinationOfNullifier(
    //       BigNumber.from(inputs.publicInputs.nullifier)
    //     );

    //     await expect(
    //       hydraS1AccountboundAttester.generateAttestations(request, proof.toBytes())
    //     ).to.be.revertedWith(
    //       `NullifierOnCooldown(${
    //         inputs.publicInputs.nullifier
    //       }, "${destination}", ${burnCount}, ${await hydraS1AccountboundAttester.getCooldownDurationForGroupIndex(
    //         group.properties.groupIndex
    //       )})`
    //     );
    //   });

    //   it('Should renew the timestamp even if the nullifier is in cooldown', async () => {
    //     const evmSnapshotId = await evmSnapshot(hre);
    //     const latestCooldownStart = await hydraS1AccountboundAttester.getNullifierCooldownStart(
    //       BigNumber.from(inputs.publicInputs.nullifier)
    //     );

    //     const renewGenerationTimestamp = group.properties.generationTimestamp + 10;
    //     // regenerate groups for attester with different timestamp
    //     const { dataFormat, groups } = await generateAttesterGroups(allAvailableGroups, {
    //       generationTimestamp: renewGenerationTimestamp,
    //     });
    //     // register new registry tree root on chain
    //     await availableRootsRegistry.registerRootForAttester(
    //       hydraS1AccountboundAttester.address,
    //       dataFormat.registryTree.getRoot()
    //     );

    //     // create new prover using the new registryTree
    //     const renewProver = new HydraS1Prover(dataFormat.registryTree, commitmentMapperPubKey);
    //     const renewProof = await renewProver.generateSnarkProof({
    //       ...userParams,
    //       destination: destination2,
    //       accountsTree: dataFormat.accountsTrees[0],
    //     });

    //     const renewRequest = {
    //       claims: [
    //         {
    //           groupId: groups[0].id,
    //           claimedValue: sourceValue,
    //           extraData: encodeGroupProperties({
    //             ...group.properties,
    //             generationTimestamp: renewGenerationTimestamp,
    //           }),
    //         },
    //       ],
    //       destination: BigNumber.from(destination2.identifier).toHexString(),
    //     };

    //     const generateAttestationsTransaction =
    //       await hydraS1AccountboundAttester.generateAttestations(renewRequest, renewProof.toBytes());

    //     // 0 - Checks that the transaction emitted the event with the new timestamp
    //     await expect(generateAttestationsTransaction)
    //       .to.emit(hydraS1AccountboundAttester, 'AttestationGenerated')
    //       .withArgs([
    //         await (
    //           await hydraS1AccountboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()
    //         ).add(group.properties.groupIndex),
    //         renewRequest.destination,
    //         hydraS1AccountboundAttester.address,
    //         sourceValue,
    //         renewGenerationTimestamp,
    //         encodeAccountBoundAttestationExtraData({
    //           nullifier: inputs.publicInputs.nullifier,
    //           burnCount: 1,
    //         }),
    //       ]);

    //     // A renew should not have changed the nullifierData
    //     // cooldownStart and burnCount should be the same
    //     expect(
    //       await hydraS1AccountboundAttester.getDestinationOfNullifier(
    //         BigNumber.from(inputs.publicInputs.nullifier)
    //       )
    //     ).to.be.eql(BigNumber.from(destination2.identifier).toHexString());

    //     expect(
    //       await hydraS1AccountboundAttester.getNullifierCooldownStart(
    //         BigNumber.from(inputs.publicInputs.nullifier)
    //       )
    //     ).to.be.eql(latestCooldownStart);

    //     expect(
    //       await hydraS1AccountboundAttester.getNullifierBurnCount(
    //         BigNumber.from(inputs.publicInputs.nullifier)
    //       )
    //     ).to.be.eql(1);

    //     // 2 - Checks that the attestation in the registry has the new timestamp
    //     expect(
    //       await attestationsRegistry.getAttestationTimestamp(
    //         (
    //           await hydraS1AccountboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()
    //         ).add(group.properties.groupIndex),
    //         destination2Signer.address
    //       )
    //     ).to.equal(renewGenerationTimestamp);

    //     evmRevert(hre, evmSnapshotId);
    //   });

    //   it('Should be able to update the claimedValue to zero even if the nullifier is in cooldown', async () => {
    //     const evmSnapshotId = await evmSnapshot(hre);
    //     // regenerate groups for attester with different timestamp
    //     const { dataFormat, groups } = await generateAttesterGroups(allAvailableGroups, {
    //       isScore: true,
    //       generationTimestamp: group.properties.generationTimestamp,
    //     });
    //     // register new registry tree root on chain
    //     await availableRootsRegistry.registerRootForAttester(
    //       hydraS1AccountboundAttester.address,
    //       dataFormat.registryTree.getRoot()
    //     );

    //     // create new prover using the new registryTree
    //     const renewProver = new HydraS1Prover(dataFormat.registryTree, commitmentMapperPubKey);
    //     const renewProof = await renewProver.generateSnarkProof({
    //       ...userParams,
    //       destination: destination2,
    //       accountsTree: dataFormat.accountsTrees[0],
    //       isStrict: false,
    //       claimedValue: 0,
    //     });

    //     const renewRequest = {
    //       claims: [
    //         {
    //           groupId: groups[0].id,
    //           claimedValue: 0,
    //           extraData: encodeGroupProperties(groups[0].properties),
    //         },
    //       ],
    //       destination: BigNumber.from(destination2.identifier).toHexString(),
    //     };

    //     const generateAttestationsTransaction =
    //       await hydraS1AccountboundAttester.generateAttestations(renewRequest, renewProof.toBytes());

    //     // Checks that the transaction emitted the event with a claimedValue of zero
    //     await expect(generateAttestationsTransaction)
    //       .to.emit(hydraS1AccountboundAttester, 'AttestationGenerated')
    //       .withArgs([
    //         await (
    //           await hydraS1AccountboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()
    //         ).add(group.properties.groupIndex),
    //         renewRequest.destination,
    //         hydraS1AccountboundAttester.address,
    //         0, // claimedValue
    //         group.properties.generationTimestamp,
    //         encodeAccountBoundAttestationExtraData({
    //           nullifier: inputs.publicInputs.nullifier,
    //           burnCount: 1,
    //         }),
    //       ]);

    //     //  Checks that the attestation in the registry has a value of zero
    //     expect(
    //       await attestationsRegistry.getAttestationValue(
    //         (
    //           await hydraS1AccountboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()
    //         ).add(group.properties.groupIndex),
    //         destination2Signer.address
    //       )
    //     ).to.equal(0);

    //     evmRevert(hre, evmSnapshotId);
    //   });

    //   it('Should revert because the cooldown period is not yet finished', async () => {
    //     // not yet the end of the cooldown period
    //     await increaseTime(hre, cooldownDuration - 10);

    //     await expect(
    //       hydraS1AccountboundAttester.generateAttestations(request, proof.toBytes())
    //     ).to.be.revertedWith(
    //       `NullifierOnCooldown(${
    //         inputs.publicInputs.nullifier
    //       }, "${await hydraS1AccountboundAttester.getDestinationOfNullifier(
    //         BigNumber.from(inputs.publicInputs.nullifier)
    //       )}", ${1}, ${cooldownDuration})`
    //     );
    //   });

    //   it('Should be able to change again the destination after the cooldown period', async () => {
    //     const evmSnapshotId = await evmSnapshot(hre);
    //     await increaseTime(hre, cooldownDuration);

    //     const generateAttestationsTransaction = hydraS1AccountboundAttester.generateAttestations(
    //       request,
    //       proof.toBytes()
    //     );

    //     // 0 - Checks that the transaction emitted the event
    //     await expect(generateAttestationsTransaction)
    //       .to.emit(hydraS1AccountboundAttester, 'AttestationGenerated')
    //       .withArgs([
    //         await (
    //           await hydraS1AccountboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()
    //         ).add(group.properties.groupIndex),
    //       ]);

    //     // 1 - Checks that the nullifier information were successfully updated
    //     expect(
    //       await hydraS1AccountboundAttester.getDestinationOfNullifier(
    //         BigNumber.from(inputs.publicInputs.nullifier)
    //       )
    //     ).to.be.equal(destination.identifier);

    //     // cooldownStart should be reset to the latest block timestamp
    //     // and burnCount incremented by 1
    //     expect(
    //       await hydraS1AccountboundAttester.getNullifierCooldownStart(
    //         BigNumber.from(inputs.publicInputs.nullifier)
    //       )
    //     ).to.be.eql((await ethers.provider.getBlock('latest')).timestamp);

    //     expect(
    //       await hydraS1AccountboundAttester.getNullifierBurnCount(
    //         BigNumber.from(inputs.publicInputs.nullifier)
    //       )
    //     ).to.be.eql(2); // burnCount should be incremented

    //     // 2 - Checks that the attester unrecorded & rerecorded the attestation in the registry
    //     // 2.1 - Checks that the old destination has not anymore it's attestation
    //     expect(
    //       await attestationsRegistry.hasAttestation(
    //         (
    //           await hydraS1AccountboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()
    //         ).add(group.properties.groupIndex),
    //         destination2Signer.address
    //       )
    //     ).to.be.false;

    //     // 2.2 - Checks that the new destination has it's attestation
    //     expect(
    //       await attestationsRegistry.hasAttestation(
    //         (
    //           await hydraS1AccountboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()
    //         ).add(group.properties.groupIndex),
    //         destinationSigner.address
    //       )
    //     ).to.be.true;
    //     evmRevert(hre, evmSnapshotId);
    //   });

    //   it('Should be able to change again the destination after the cooldown period with a recomputed group', async () => {
    //     const evmSnapshotId = await evmSnapshot(hre);
    //     await increaseTime(hre, cooldownDuration);

    //     const renewGenerationTimestamp = group.properties.generationTimestamp + 10;
    //     // regenerate groups for attester with different timestamp
    //     const { dataFormat, groups } = await generateAttesterGroups(allAvailableGroups, {
    //       generationTimestamp: renewGenerationTimestamp,
    //     });
    //     // register new registry tree root on chain
    //     await availableRootsRegistry.registerRootForAttester(
    //       hydraS1AccountboundAttester.address,
    //       dataFormat.registryTree.getRoot()
    //     );

    //     // create new prover using the new registryTree
    //     const renewProver = new HydraS1Prover(dataFormat.registryTree, commitmentMapperPubKey);
    //     const renewProof = await renewProver.generateSnarkProof({
    //       ...userParams,
    //       destination: destination,
    //       accountsTree: dataFormat.accountsTrees[0],
    //     });

    //     const renewRequest = {
    //       claims: [
    //         {
    //           groupId: groups[0].id,
    //           claimedValue: sourceValue,
    //           extraData: encodeGroupProperties({
    //             ...group.properties,
    //             generationTimestamp: renewGenerationTimestamp,
    //           }),
    //         },
    //       ],
    //       destination: BigNumber.from(destination.identifier).toHexString(),
    //     };

    //     const generateAttestationsTransaction =
    //       await hydraS1AccountboundAttester.generateAttestations(renewRequest, renewProof.toBytes());

    //     // 0 - Checks that the transaction emitted the event
    //     await expect(generateAttestationsTransaction)
    //       .to.emit(hydraS1AccountboundAttester, 'AttestationGenerated')
    //       .withArgs([
    //         await (
    //           await hydraS1AccountboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()
    //         ).add(group.properties.groupIndex),
    //       ]);

    //     // 1 - Checks that the nullifier information were successfully updated
    //     expect(
    //       await hydraS1AccountboundAttester.getDestinationOfNullifier(
    //         BigNumber.from(inputs.publicInputs.nullifier)
    //       )
    //     ).to.be.equal(destination.identifier);

    //     // cooldownStart should be reset to the latest block timestamp
    //     // and burnCount incremented by 1
    //     expect(
    //       await hydraS1AccountboundAttester.getNullifierCooldownStart(
    //         BigNumber.from(inputs.publicInputs.nullifier)
    //       )
    //     ).to.be.eql((await ethers.provider.getBlock('latest')).timestamp);

    //     expect(
    //       await hydraS1AccountboundAttester.getNullifierBurnCount(
    //         BigNumber.from(inputs.publicInputs.nullifier)
    //       )
    //     ).to.be.eql(2); // burnCount should be incremented

    //     // 2 - Checks that the attester unrecorded & rerecorded the attestation in the registry
    //     // 2.1 - Checks that the old destination has not anymore it's attestation
    //     expect(
    //       await attestationsRegistry.hasAttestation(
    //         (
    //           await hydraS1AccountboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()
    //         ).add(group.properties.groupIndex),
    //         destination2Signer.address
    //       )
    //     ).to.be.false;

    //     // 2.2 - Checks that the new destination has it's attestation
    //     expect(
    //       await attestationsRegistry.hasAttestation(
    //         (
    //           await hydraS1AccountboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()
    //         ).add(group.properties.groupIndex),
    //         destinationSigner.address
    //       )
    //     ).to.be.true;
    //     evmRevert(hre, evmSnapshotId);
    //   });
  });
});
