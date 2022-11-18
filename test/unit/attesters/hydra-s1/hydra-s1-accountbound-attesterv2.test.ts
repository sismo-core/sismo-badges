import {
  encodeAccountBoundAttestationExtraData,
  generateHydraS1AccountboundAttesterGroups,
  HydraS1AccountboundGroupProperties,
} from './../../../utils/hydra-s1-accountbound';
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
  CommitmentMapperRegistry,
  HydraS1AccountboundAttesterv2,
  HydraS1Verifier,
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
  HydraS1AccountboundGroup,
  encodeHydraS1AccountboundGroupProperties,
  GroupData,
  generateAttesterGroups,
  HydraS1SimpleGroup,
  encodeGroupProperties,
  generateGroupIdFromEncodedProperties,
  generateGroupIdFromProperties,
} from '../../../utils';

describe('Test HydraS1 Accountbound Attester V2 contract', () => {
  let attestationsRegistry: AttestationsRegistry;
  let hydraS1AccountboundAttesterv2: HydraS1AccountboundAttesterv2;
  let hydraS1Verifier: HydraS1Verifier;
  let commitmentMapperRegistry: CommitmentMapperRegistry;
  let availableRootsRegistry: AvailableRootsRegistry;

  let prover: HydraS1Prover;
  let commitmentMapper: CommitmentMapperTester;
  let commitmentMapperPubKey: EddsaPublicKey;

  let deployer: SignerWithAddress;
  let destinationSigner: SignerWithAddress;
  let destination2Signer: SignerWithAddress;

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
    [deployer, destinationSigner, destination2Signer] = signers;

    chainId = parseInt(await hre.getChainId());

    commitmentMapper = await CommitmentMapperTester.generate();
    commitmentMapperPubKey = await commitmentMapper.getPubKey();

    let hydraS1Accounts = await generateHydraS1Accounts(signers, commitmentMapper);
    [source, destination, destination2] = hydraS1Accounts;

    allAvailableGroups = await generateGroups(hydraS1Accounts);
    cooldownDuration = 10;
    const { dataFormat, groups } = await generateAttesterGroups(allAvailableGroups);

    registryTree = dataFormat.registryTree;
    [accountsTree, accountsTree2] = dataFormat.accountsTrees;
    [group, group2] = groups;
    sourceValue = accountsTree.getValue(BigNumber.from(source.identifier).toHexString());

    prover = new HydraS1Prover(registryTree, commitmentMapperPubKey);
  });

  /*************************************************************************************/
  /********************************** DEPLOYMENTS **************************************/
  /*************************************************************************************/
  describe('Deployments', () => {
    it('Should deploy, setup and test the constructed values of the contract', async () => {
      ({
        attestationsRegistry,
        hydraS1AccountboundAttesterv2,
        hydraS1Verifier,
        commitmentMapperRegistry,
        availableRootsRegistry,
      } = await hre.run('0-deploy-core-and-hydra-s1-simple-and-accountbound', {
        options: { deploymentNamePrefix: 'accountbound-v2' },
      }));

      // 0 - Checks that the verifier, available roots registry, commitment mapper registry and attestations registry are set
      expect(await hydraS1AccountboundAttesterv2.getVerifier()).to.equal(hydraS1Verifier.address);
      expect(await hydraS1AccountboundAttesterv2.getAvailableRootsRegistry()).to.equal(
        availableRootsRegistry.address
      );
      expect(await hydraS1AccountboundAttesterv2.getCommitmentMapperRegistry()).to.equal(
        commitmentMapperRegistry.address
      );
      expect(await hydraS1AccountboundAttesterv2.getAttestationRegistry()).to.equal(
        attestationsRegistry.address
      );
    });

    after(async () => {
      externalNullifier = await generateExternalNullifier(
        hydraS1AccountboundAttesterv2.address,
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
  /******************************* BUILD ATTESTATIONS **********************************/
  /*************************************************************************************/
  describe('Build attestations', () => {
    it('Should revert when the collectionId is out of attester bounds', async () => {
      const wrongGroupProperties = {
        ...group.properties,
        groupIndex: (
          await hydraS1AccountboundAttesterv2.AUTHORIZED_COLLECTION_ID_LAST()
        ).toNumber(),
      };

      const wrongRequest = {
        ...request,
        claims: [
          {
            ...request.claims[0],
            groupId: generateGroupIdFromProperties(wrongGroupProperties),
            extraData: encodeGroupProperties(wrongGroupProperties),
          },
        ],
      };

      await expect(
        hydraS1AccountboundAttesterv2.buildAttestations(wrongRequest, proof.toBytes())
      ).to.be.revertedWith('CollectionIdOutOfBound');
    });

    it('Should build the attestations', async () => {
      const buildAttestations = await hydraS1AccountboundAttesterv2.buildAttestations(
        request,
        proof.toBytes()
      );

      expect(buildAttestations[0].collectionId).to.eql(
        (await hydraS1AccountboundAttesterv2.AUTHORIZED_COLLECTION_ID_FIRST()).add(
          group.properties.groupIndex
        )
      );
      expect(buildAttestations[0].owner).to.eql(request.destination);
      expect(buildAttestations[0].issuer).to.eql(hydraS1AccountboundAttesterv2.address);
      expect(buildAttestations[0].value.toNumber()).to.eql(sourceValue.toNumber());
      expect(buildAttestations[0].timestamp).to.eql(group.properties.generationTimestamp);
      expect(buildAttestations[0].extraData).to.eql(
        encodeAccountBoundAttestationExtraData({
          nullifier: inputs.publicInputs.nullifier,
          burnCount: 0,
        })
      );
    });
  });

  /*************************************************************************************/
  /******************************* GENERATE ATTESTATIONS *******************************/
  /*************************************************************************************/
  describe('Generate Attestations', () => {
    it('Should revert if the user provided wrong group generation datas', async () => {
      const wrongExtraData = {
        ...group.properties,
      };

      await expect(
        hydraS1AccountboundAttesterv2.generateAttestations(
          { ...request, claims: [{ ...request.claims[0], groupId: group2.id }] },
          proof.toBytes()
        )
      ).to.be.revertedWith(
        `GroupIdAndPropertiesMismatch(${BigNumber.from(
          ethers.utils.keccak256(request.claims[0].extraData)
        ).mod(SNARK_FIELD)}, ${BigNumber.from(group2.id)})`
      );

      wrongExtraData.groupIndex = group2.properties.groupIndex;

      await expect(
        hydraS1AccountboundAttesterv2.generateAttestations(
          {
            ...request,
            claims: [
              {
                ...request.claims[0],
                extraData: encodeGroupProperties(wrongExtraData),
              },
            ],
          },
          proof.toBytes()
        )
      ).to.be.revertedWith(
        `GroupIdAndPropertiesMismatch(${BigNumber.from(
          ethers.utils.keccak256(encodeGroupProperties(wrongExtraData))
        ).mod(SNARK_FIELD)}, ${BigNumber.from(group.id)})`
      );

      wrongExtraData.groupIndex = group.properties.groupIndex;
      wrongExtraData.generationTimestamp = group2.properties.generationTimestamp;

      await expect(
        hydraS1AccountboundAttesterv2.generateAttestations(
          {
            ...request,
            claims: [
              {
                ...request.claims[0],
                extraData: encodeGroupProperties(wrongExtraData),
              },
            ],
          },
          proof.toBytes()
        )
      ).to.be.revertedWith(
        `GroupIdAndPropertiesMismatch(${BigNumber.from(
          ethers.utils.keccak256(encodeGroupProperties(wrongExtraData))
        ).mod(SNARK_FIELD)}, ${BigNumber.from(group.id)})`
      );

      wrongExtraData.generationTimestamp = group.properties.generationTimestamp;
      wrongExtraData.isScore = !group.properties.isScore;

      await expect(
        hydraS1AccountboundAttesterv2.generateAttestations(
          {
            ...request,
            claims: [
              {
                ...request.claims[0],
                extraData: encodeGroupProperties(wrongExtraData),
              },
            ],
          },
          proof.toBytes()
        )
      ).to.be.revertedWith(
        `GroupIdAndPropertiesMismatch(${BigNumber.from(
          ethers.utils.keccak256(encodeGroupProperties(wrongExtraData))
        ).mod(SNARK_FIELD)}, ${BigNumber.from(group.id)})`
      );

      wrongExtraData.isScore = group.properties.isScore;
    });

    it('Should revert if the snark accounts tree value mismatch the claim groupId', async () => {
      // 0 - Checks that it's reverted if the wrong proof accounts tree is not the same as the claim groupId
      const wrongProof = await prover.generateSnarkProof({
        ...userParams,
        destination: destination2,
        accountsTree: accountsTree2,
        isStrict: false,
      });

      await expect(
        hydraS1AccountboundAttesterv2.generateAttestations(request, wrongProof.toBytes())
      ).to.be.revertedWith(
        `AccountsTreeValueMismatch(${BigNumber.from(group.id)}, ${BigNumber.from(group2.id)})`
      );

      // 1 - Checks that it's reverted if the proof accounts tree is not the same as the fake claim groupId
      await expect(
        hydraS1AccountboundAttesterv2.generateAttestations(
          {
            ...request,
            claims: [
              {
                ...request.claims[0],
                groupId: group2.id,
                extraData: encodeGroupProperties(group2.properties),
              },
            ],
          },
          proof.toBytes()
        )
      ).to.be.revertedWith(
        `AccountsTreeValueMismatch(${BigNumber.from(group2.id)}, ${BigNumber.from(group.id)})`
      );
    });

    it('Should revert if the snark isStrict mismatch the claim groupProperty isScore', async () => {
      // 0 - Checks that it's reverted if the fake proof isStrict is the same with the claim isScore
      const wrongProof = await prover.generateSnarkProof({
        ...userParams,
        isStrict: group.properties.isScore,
      });

      await expect(
        hydraS1AccountboundAttesterv2.generateAttestations(request, wrongProof.toBytes())
      ).to.be.revertedWith(`IsStrictMismatch(false, false)`);
    });

    it('Should revert if the snark input destination mismatch the claim destination', async () => {
      // 0 - Checks that it's reverted if the fake proof destination is different from the claim destination
      const wrongProof = await prover.generateSnarkProof({
        ...userParams,
        destination: destination2,
      });

      await expect(
        hydraS1AccountboundAttesterv2.generateAttestations(request, wrongProof.toBytes())
      ).to.be.revertedWith(
        `DestinationMismatch("${BigNumber.from(
          destination.identifier
        ).toHexString()}", "${BigNumber.from(destination2.identifier).toHexString()}")`
      );

      // 1 - Checks that it's reverted if the proof destination is different from the fake claim destination
      await expect(
        hydraS1AccountboundAttesterv2.generateAttestations(
          {
            ...request,
            destination: BigNumber.from(destination2.identifier).toHexString(),
          },
          proof.toBytes()
        )
      ).to.be.revertedWith(
        `DestinationMismatch("${BigNumber.from(
          destination2.identifier
        ).toHexString()}", "${BigNumber.from(destination.identifier).toHexString()}")`
      );
    });

    it('Should revert if the snark input chainId mismatch the blockchain chainId', async () => {
      // 0 - Checks that it's reverted if the fake proof chainId is different from the claim chainId
      const wrongProof = await prover.generateSnarkProof({
        ...userParams,
        chainId: chainId - 1,
      });

      await expect(
        hydraS1AccountboundAttesterv2.generateAttestations(request, wrongProof.toBytes())
      ).to.be.revertedWith(
        `ChainIdMismatch(${BigNumber.from(chainId)}, ${BigNumber.from(chainId - 1)})`
      );
    });

    it('Should revert if the snark input claimedValue mismatch the claim claimedValue ', async () => {
      // 0 - Checks that it's reverted if the proof claimedvalue is different from the fake claim claimedValue
      await expect(
        hydraS1AccountboundAttesterv2.generateAttestations(
          {
            ...request,
            claims: [
              {
                ...request.claims[0],
                claimedValue: sourceValue.add(1),
              },
            ],
          },
          proof.toBytes()
        )
      ).to.be.revertedWith(`ValueMismatch(${sourceValue.add(1)}, ${sourceValue})`);
    });

    it('Should revert if the attester has not access to the registry root', async () => {
      // 0 - Checks that it's reverted if the attester has not access to the registry root
      await expect(
        hydraS1AccountboundAttesterv2.generateAttestations(request, proof.toBytes())
      ).to.be.revertedWith(
        `RegistryRootMismatch(${BigNumber.from(inputs.publicInputs.registryTreeRoot)}`
      );
    });

    it('Should revert if the input commitment mapper pub keys mismatch the onchain commitment mapper pub keys', async () => {
      await availableRootsRegistry.registerRootForAttester(
        hydraS1AccountboundAttesterv2.address,
        registryTree.getRoot()
      );

      const evmSnapshotId = await evmSnapshot(hre);

      const wrongCommitmentMapperPubKey: EddsaPublicKey = [
        commitmentMapperPubKey[0].add(1),
        commitmentMapperPubKey[1].add(1),
      ];

      await commitmentMapperRegistry.updateCommitmentMapperEdDSAPubKey(wrongCommitmentMapperPubKey);

      await expect(
        hydraS1AccountboundAttesterv2.generateAttestations(request, proof.toBytes())
      ).to.be.revertedWith(
        `CommitmentMapperPubKeyMismatch(${wrongCommitmentMapperPubKey[0]}, ${wrongCommitmentMapperPubKey[1]}, ${commitmentMapperPubKey[0]}, ${commitmentMapperPubKey[1]})`
      );

      await evmRevert(hre, evmSnapshotId);
    });

    it('Should revert if the snark input externalNullifier mismatch the claim externalNullifier', async () => {
      // 0 - Checks that it's reverted if the fake proof externalNullifier is different from the claim externalNullifier
      const wrongExternalNullifier = await generateExternalNullifier(
        hydraS1AccountboundAttesterv2.address,
        group2.properties.groupIndex
      );

      const wrongProof = await prover.generateSnarkProof({
        ...userParams,
        externalNullifier: wrongExternalNullifier,
      });

      await expect(
        hydraS1AccountboundAttesterv2.generateAttestations(request, wrongProof.toBytes())
      ).to.be.revertedWith(
        `ExternalNullifierMismatch(${externalNullifier}, ${wrongExternalNullifier})`
      );
    });

    it('Should not allow snark field overflow by providing a nullifier that is outside the snark field', async () => {
      // override the nullifier proof to overflow
      const wrongProof = { ...proof, input: [...proof.input] };
      wrongProof.input[6] = BigNumber.from(wrongProof.input[6]).add(SNARK_FIELD);

      await expect(
        hydraS1AccountboundAttesterv2.generateAttestations(request, toBytes(wrongProof))
      ).to.be.revertedWith(`InvalidGroth16Proof("verifier-gte-snark-scalar-field")`);
    });

    it('Should revert if wrong snark proof', async () => {
      // override the nullifier proof to overflow
      const wrongProof = { ...proof, a: [...proof.a] };
      wrongProof.a[0] = BigNumber.from(proof.a[0]).sub(1);

      await expect(
        hydraS1AccountboundAttesterv2.generateAttestations(request, toBytes(wrongProof))
      ).to.be.revertedWith(`InvalidGroth16Proof("")`);
    });

    it('Should generate a proof with Hydra S1 Prover and verify it onchain using the attester', async () => {
      const generateAttestationsTransaction =
        await hydraS1AccountboundAttesterv2.generateAttestations(request, proof.toBytes());

      // 0 - Checks that the transaction emitted the event
      await expect(generateAttestationsTransaction)
        .to.emit(hydraS1AccountboundAttesterv2, 'AttestationGenerated')
        .withArgs([
          await (
            await hydraS1AccountboundAttesterv2.AUTHORIZED_COLLECTION_ID_FIRST()
          ).add(group.properties.groupIndex),
          request.destination,
          hydraS1AccountboundAttesterv2.address,
          sourceValue,
          group.properties.generationTimestamp,
          encodeAccountBoundAttestationExtraData({
            nullifier: inputs.publicInputs.nullifier,
            burnCount: 0,
          }),
        ]);

      // 1 - Checks that the provided nullifier was successfully recorded in the attester
      expect(
        await hydraS1AccountboundAttesterv2.getDestinationOfNullifier(
          BigNumber.from(inputs.publicInputs.nullifier)
        )
      ).to.equal(request.destination);

      expect(
        await hydraS1AccountboundAttesterv2.getNullifierCooldownStart(
          BigNumber.from(inputs.publicInputs.nullifier)
        )
      ).to.be.eql(0);

      expect(
        await hydraS1AccountboundAttesterv2.getNullifierBurnCount(
          BigNumber.from(inputs.publicInputs.nullifier)
        )
      ).to.be.eql(0);

      // 2 - Checks that the attester recorded the attestation in the registry
      expect(
        await attestationsRegistry.hasAttestation(
          (
            await hydraS1AccountboundAttesterv2.AUTHORIZED_COLLECTION_ID_FIRST()
          ).add(group.properties.groupIndex),
          destinationSigner.address
        )
      ).to.be.true;
    });

    it('Should be able to change the destination, deleting the old attestation', async () => {
      const newProof = await prover.generateSnarkProof({
        ...userParams,
        destination: destination2,
      });

      const newRequest = {
        ...request,
        destination: BigNumber.from(destination2.identifier).toHexString(),
      };

      // set a cooldown of 1 second for first group
      await hydraS1AccountboundAttesterv2.setCooldownDurationForgroupId(group.id, 1);

      const generateAttestationsTransaction =
        await hydraS1AccountboundAttesterv2.generateAttestations(newRequest, newProof.toBytes());

      // 0 - Checks that the transaction emitted the event
      await expect(generateAttestationsTransaction)
        .to.emit(hydraS1AccountboundAttesterv2, 'AttestationGenerated')
        .withArgs([
          await (
            await hydraS1AccountboundAttesterv2.AUTHORIZED_COLLECTION_ID_FIRST()
          ).add(group.properties.groupIndex),
          newRequest.destination,
          hydraS1AccountboundAttesterv2.address,
          sourceValue,
          group.properties.generationTimestamp,
          encodeAccountBoundAttestationExtraData({
            nullifier: inputs.publicInputs.nullifier,
            burnCount: 1, // burn count should be incremented
          }),
        ]);
      await expect(generateAttestationsTransaction)
        .to.emit(hydraS1AccountboundAttesterv2, 'NullifierDestinationUpdated')
        .withArgs(inputs.publicInputs.nullifier, destination2.identifier);
      await expect(generateAttestationsTransaction)
        .to.emit(hydraS1AccountboundAttesterv2, 'NullifierSetOnCooldown')
        .withArgs(inputs.publicInputs.nullifier, 1);

      // 1 - Checks that the nullifier informations were successfully updated
      expect(
        await hydraS1AccountboundAttesterv2.getDestinationOfNullifier(
          BigNumber.from(inputs.publicInputs.nullifier)
        )
      ).to.be.equal(BigNumber.from(destination2.identifier));

      expect(
        await hydraS1AccountboundAttesterv2.getNullifierCooldownStart(
          BigNumber.from(inputs.publicInputs.nullifier)
        )
      ).to.be.eql((await ethers.provider.getBlock('latest')).timestamp);

      expect(
        await hydraS1AccountboundAttesterv2.getNullifierBurnCount(
          BigNumber.from(inputs.publicInputs.nullifier)
        )
      ).to.be.eql(1); // the burnCount should be incremented

      // burnCount should be recorded in the attestationsRegistry
      expect(
        await attestationsRegistry.getAttestationExtraData(
          (
            await hydraS1AccountboundAttesterv2.AUTHORIZED_COLLECTION_ID_FIRST()
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
      await expect(generateAttestationsTransaction)
        .to.emit(hydraS1AccountboundAttesterv2, 'AttestationDeleted')
        .withArgs([
          (
            await hydraS1AccountboundAttesterv2.AUTHORIZED_COLLECTION_ID_FIRST()
          ).add(group.properties.groupIndex),
          destinationSigner.address,
          hydraS1AccountboundAttesterv2.address,
          sourceValue,
          group.properties.generationTimestamp,
          encodeAccountBoundAttestationExtraData({
            nullifier: inputs.publicInputs.nullifier,
            burnCount: 0,
          }),
        ]);

      expect(
        await attestationsRegistry.hasAttestation(
          (
            await hydraS1AccountboundAttesterv2.AUTHORIZED_COLLECTION_ID_FIRST()
          ).add(group.properties.groupIndex),
          destinationSigner.address
        )
      ).to.be.false;

      // 2.2 - Checks that the new destination has it's attestation
      expect(
        await attestationsRegistry.hasAttestation(
          (
            await hydraS1AccountboundAttesterv2.AUTHORIZED_COLLECTION_ID_FIRST()
          ).add(group.properties.groupIndex),
          destination2Signer.address
        )
      ).to.be.true;
    });

    it('Should revert if the nullifier is in cooldown', async () => {
      const burnCount = await hydraS1AccountboundAttesterv2.getNullifierBurnCount(
        BigNumber.from(inputs.publicInputs.nullifier)
      );

      const destination = await hydraS1AccountboundAttesterv2.getDestinationOfNullifier(
        BigNumber.from(inputs.publicInputs.nullifier)
      );

      // set a cooldown of 1 day for first group
      await hydraS1AccountboundAttesterv2.setCooldownDurationForgroupId(group.id, 60 * 60 * 24);

      await expect(
        hydraS1AccountboundAttesterv2.generateAttestations(request, proof.toBytes())
      ).to.be.revertedWith(
        `NullifierOnCooldown(${
          inputs.publicInputs.nullifier
        }, "${destination}", ${burnCount}, ${await hydraS1AccountboundAttesterv2.getCooldownDurationForGroupId(
          group.id
        )})`
      );
    });

    it('Should renew the timestamp even if the nullifier is in cooldown', async () => {
      const evmSnapshotId = await evmSnapshot(hre);
      const latestCooldownStart = await hydraS1AccountboundAttesterv2.getNullifierCooldownStart(
        BigNumber.from(inputs.publicInputs.nullifier)
      );

      const renewGenerationTimestamp = group.properties.generationTimestamp + 10;
      // regenerate groups for attester with different timestamp
      const { dataFormat, groups } = await generateAttesterGroups(allAvailableGroups, {
        generationTimestamp: renewGenerationTimestamp,
      });
      // register new registry tree root on chain
      await availableRootsRegistry.registerRootForAttester(
        hydraS1AccountboundAttesterv2.address,
        dataFormat.registryTree.getRoot()
      );

      // create new prover using the new registryTree
      const renewProver = new HydraS1Prover(dataFormat.registryTree, commitmentMapperPubKey);
      const renewProof = await renewProver.generateSnarkProof({
        ...userParams,
        destination: destination2,
        accountsTree: dataFormat.accountsTrees[0],
      });

      const renewRequest = {
        claims: [
          {
            groupId: groups[0].id,
            claimedValue: sourceValue,
            extraData: encodeGroupProperties({
              ...group.properties,
              generationTimestamp: renewGenerationTimestamp,
            }),
          },
        ],
        destination: BigNumber.from(destination2.identifier).toHexString(),
      };

      const generateAttestationsTransaction =
        await hydraS1AccountboundAttesterv2.generateAttestations(
          renewRequest,
          renewProof.toBytes()
        );

      // 0 - Checks that the transaction emitted the event with the new timestamp
      await expect(generateAttestationsTransaction)
        .to.emit(hydraS1AccountboundAttesterv2, 'AttestationGenerated')
        .withArgs([
          await (
            await hydraS1AccountboundAttesterv2.AUTHORIZED_COLLECTION_ID_FIRST()
          ).add(group.properties.groupIndex),
          renewRequest.destination,
          hydraS1AccountboundAttesterv2.address,
          sourceValue,
          renewGenerationTimestamp,
          encodeAccountBoundAttestationExtraData({
            nullifier: inputs.publicInputs.nullifier,
            burnCount: 1,
          }),
        ]);

      // A renew should not have changed the nullifierData
      // cooldownStart and burnCount should be the same
      expect(
        await hydraS1AccountboundAttesterv2.getDestinationOfNullifier(
          BigNumber.from(inputs.publicInputs.nullifier)
        )
      ).to.be.eql(BigNumber.from(destination2.identifier).toHexString());

      expect(
        await hydraS1AccountboundAttesterv2.getNullifierCooldownStart(
          BigNumber.from(inputs.publicInputs.nullifier)
        )
      ).to.be.eql(latestCooldownStart);

      expect(
        await hydraS1AccountboundAttesterv2.getNullifierBurnCount(
          BigNumber.from(inputs.publicInputs.nullifier)
        )
      ).to.be.eql(1);

      // 2 - Checks that the attestation in the registry has the new timestamp
      expect(
        await attestationsRegistry.getAttestationTimestamp(
          (
            await hydraS1AccountboundAttesterv2.AUTHORIZED_COLLECTION_ID_FIRST()
          ).add(group.properties.groupIndex),
          destination2Signer.address
        )
      ).to.equal(renewGenerationTimestamp);

      evmRevert(hre, evmSnapshotId);
    });

    it('Should be able to update the claimedValue to zero even if the nullifier is in cooldown', async () => {
      const evmSnapshotId = await evmSnapshot(hre);
      // regenerate groups for attester with different timestamp
      const { dataFormat, groups } = await generateAttesterGroups(allAvailableGroups, {
        isScore: true,
        generationTimestamp: group.properties.generationTimestamp,
      });
      // register new registry tree root on chain
      await availableRootsRegistry.registerRootForAttester(
        hydraS1AccountboundAttesterv2.address,
        dataFormat.registryTree.getRoot()
      );

      // create new prover using the new registryTree
      const renewProver = new HydraS1Prover(dataFormat.registryTree, commitmentMapperPubKey);
      const renewProof = await renewProver.generateSnarkProof({
        ...userParams,
        destination: destination2,
        accountsTree: dataFormat.accountsTrees[0],
        isStrict: false,
        claimedValue: 0,
      });

      const renewRequest = {
        claims: [
          {
            groupId: groups[0].id,
            claimedValue: 0,
            extraData: encodeGroupProperties(groups[0].properties),
          },
        ],
        destination: BigNumber.from(destination2.identifier).toHexString(),
      };

      const generateAttestationsTransaction =
        await hydraS1AccountboundAttesterv2.generateAttestations(
          renewRequest,
          renewProof.toBytes()
        );

      // Checks that the transaction emitted the event with a claimedValue of zero
      await expect(generateAttestationsTransaction)
        .to.emit(hydraS1AccountboundAttesterv2, 'AttestationGenerated')
        .withArgs([
          await (
            await hydraS1AccountboundAttesterv2.AUTHORIZED_COLLECTION_ID_FIRST()
          ).add(group.properties.groupIndex),
          renewRequest.destination,
          hydraS1AccountboundAttesterv2.address,
          0, // claimedValue
          group.properties.generationTimestamp,
          encodeAccountBoundAttestationExtraData({
            nullifier: inputs.publicInputs.nullifier,
            burnCount: 1,
          }),
        ]);

      //  Checks that the attestation in the registry has a value of zero
      expect(
        await attestationsRegistry.getAttestationValue(
          (
            await hydraS1AccountboundAttesterv2.AUTHORIZED_COLLECTION_ID_FIRST()
          ).add(group.properties.groupIndex),
          destination2Signer.address
        )
      ).to.equal(0);

      evmRevert(hre, evmSnapshotId);
    });

    it('Should be able to change again the destination after the cooldown period', async () => {
      await hydraS1AccountboundAttesterv2.setCooldownDurationForgroupId(group.id, cooldownDuration);
      await increaseTime(hre, cooldownDuration);

      const generateAttestationsTransaction = hydraS1AccountboundAttesterv2.generateAttestations(
        request,
        proof.toBytes()
      );

      // 0 - Checks that the transaction emitted the event
      await expect(generateAttestationsTransaction)
        .to.emit(hydraS1AccountboundAttesterv2, 'AttestationGenerated')
        .withArgs([
          await (
            await hydraS1AccountboundAttesterv2.AUTHORIZED_COLLECTION_ID_FIRST()
          ).add(group.properties.groupIndex),
        ]);

      // 1 - Checks that the nullifier informations were successfully updated
      expect(
        await hydraS1AccountboundAttesterv2.getDestinationOfNullifier(
          BigNumber.from(inputs.publicInputs.nullifier)
        )
      ).to.be.equal(destination.identifier);

      // cooldownStart should be reset to the latest block timestamp
      // and burnCount incremented by 1
      expect(
        await hydraS1AccountboundAttesterv2.getNullifierCooldownStart(
          BigNumber.from(inputs.publicInputs.nullifier)
        )
      ).to.be.eql((await ethers.provider.getBlock('latest')).timestamp);

      expect(
        await hydraS1AccountboundAttesterv2.getNullifierBurnCount(
          BigNumber.from(inputs.publicInputs.nullifier)
        )
      ).to.be.eql(2); // burnCount should be incremented

      // 2 - Checks that the attester unrecorded & rerecorded the attestation in the registry
      // 2.1 - Checks that the old destination has not anymore it's attestation
      await expect(generateAttestationsTransaction)
        .to.emit(hydraS1AccountboundAttesterv2, 'AttestationDeleted')
        .withArgs([
          (
            await hydraS1AccountboundAttesterv2.AUTHORIZED_COLLECTION_ID_FIRST()
          ).add(group.properties.groupIndex),
          destination2Signer.address,
          hydraS1AccountboundAttesterv2.address,
          sourceValue,
          group.properties.generationTimestamp,
          encodeAccountBoundAttestationExtraData({
            nullifier: inputs.publicInputs.nullifier,
            burnCount: 1,
          }),
        ]);

      expect(
        await attestationsRegistry.hasAttestation(
          (
            await hydraS1AccountboundAttesterv2.AUTHORIZED_COLLECTION_ID_FIRST()
          ).add(group.properties.groupIndex),
          destination2Signer.address
        )
      ).to.be.false;

      // 2.2 - Checks that the new destination has it's attestation
      expect(
        await attestationsRegistry.hasAttestation(
          (
            await hydraS1AccountboundAttesterv2.AUTHORIZED_COLLECTION_ID_FIRST()
          ).add(group.properties.groupIndex),
          destinationSigner.address
        )
      ).to.be.true;
    });
  });
});
