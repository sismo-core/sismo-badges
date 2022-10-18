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
  HydraS1SoulboundAttester,
  HydraS1Verifier,
} from 'types';
import { RequestStruct } from 'types/HydraS1SimpleAttester';
import {
  encodeGroupProperties,
  evmRevert,
  evmSnapshot,
  generateAttesterGroups,
  generateGroupIdFromProperties,
  generateHydraS1Accounts,
  generateLists,
  generateTicketIdentifier,
  Group,
  increaseTime,
  toBytes,
} from '../../../utils';

describe('Test HydraS1 Soulbound Attester contract', () => {
  let attestationsRegistry: AttestationsRegistry;
  let hydraS1SoulboundAttester: HydraS1SoulboundAttester;
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
  let group: Group;
  let group2: Group;
  let ticketIdentifier: BigNumber;
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

    const { dataFormat, groups } = await generateAttesterGroups(
      await generateLists(hydraS1Accounts)
    );

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
    it('Should deploy, setup and test and test the constructed values of the contract', async () => {
      ({
        attestationsRegistry,
        hydraS1SoulboundAttester,
        hydraS1Verifier,
        commitmentMapperRegistry,
        availableRootsRegistry,
      } = await hre.run('0-deploy-core-and-hydra-s1-simple-and-soulbound', {
        options: { deploymentNamePrefix: 'soulbound' },
      }));

      // 0 - Checks that the verifier, available roots registry, commitment mapper registry and attestations registry are set
      expect(await hydraS1SoulboundAttester.getVerifier()).to.equal(hydraS1Verifier.address);
      expect(await hydraS1SoulboundAttester.getAvailableRootsRegistry()).to.equal(
        availableRootsRegistry.address
      );
      expect(await hydraS1SoulboundAttester.getCommitmentMapperRegistry()).to.equal(
        commitmentMapperRegistry.address
      );
      expect(await hydraS1SoulboundAttester.getAttestationRegistry()).to.equal(
        attestationsRegistry.address
      );
    });

    after(async () => {
      ticketIdentifier = await generateTicketIdentifier(
        hydraS1SoulboundAttester.address,
        group.properties.groupIndex
      );

      userParams = {
        source: source,
        destination: destination,
        claimedValue: sourceValue,
        chainId: chainId,
        accountsTree: accountsTree,
        ticketIdentifier: ticketIdentifier,
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
        groupIndex: (await hydraS1SoulboundAttester.AUTHORIZED_COLLECTION_ID_LAST()).toNumber(),
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

      await expect(hydraS1SoulboundAttester.buildAttestations(wrongRequest, proof.toBytes())).to.be
        .reverted;
    });

    it('Should build the attestations', async () => {
      const buildAttestations = await hydraS1SoulboundAttester.buildAttestations(
        request,
        proof.toBytes()
      );

      expect(buildAttestations).to.eql([
        [
          (await hydraS1SoulboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()).add(
            group.properties.groupIndex
          ),
          request.destination,
          hydraS1SoulboundAttester.address,
          sourceValue,
          group.properties.generationTimestamp,
          ethers.utils.hexlify(BigNumber.from(inputs.publicInputs.userTicket).toHexString()),
        ],
      ]);
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
        hydraS1SoulboundAttester.generateAttestations(
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
        hydraS1SoulboundAttester.generateAttestations(
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
        hydraS1SoulboundAttester.generateAttestations(
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
        hydraS1SoulboundAttester.generateAttestations(
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
        hydraS1SoulboundAttester.generateAttestations(request, wrongProof.toBytes())
      ).to.be.revertedWith(
        `AccountsTreeValueMismatch(${BigNumber.from(group.id)}, ${BigNumber.from(group2.id)})`
      );

      // 1 - Checks that it's reverted if the proof accounts tree is not the same as the fake claim groupId
      await expect(
        hydraS1SoulboundAttester.generateAttestations(
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
        hydraS1SoulboundAttester.generateAttestations(request, wrongProof.toBytes())
      ).to.be.revertedWith(`IsStrictMismatch(false, false)`);
    });

    it('Should revert if the snark input destination mismatch the claim destination', async () => {
      // 0 - Checks that it's reverted if the fake proof destination is different from the claim destination
      const wrongProof = await prover.generateSnarkProof({
        ...userParams,
        destination: destination2,
      });

      await expect(
        hydraS1SoulboundAttester.generateAttestations(request, wrongProof.toBytes())
      ).to.be.revertedWith(
        `DestinationMismatch("${BigNumber.from(
          destination.identifier
        ).toHexString()}", "${BigNumber.from(destination2.identifier).toHexString()}")`
      );

      // 1 - Checks that it's reverted if the proof destination is different from the fake claim destination
      await expect(
        hydraS1SoulboundAttester.generateAttestations(
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
        hydraS1SoulboundAttester.generateAttestations(request, wrongProof.toBytes())
      ).to.be.revertedWith(
        `ChainIdMismatch(${BigNumber.from(chainId)}, ${BigNumber.from(chainId - 1)})`
      );
    });

    it('Should revert if the attester has not access to the registry root', async () => {
      // 0 - Checks that it's reverted if the attester has not access to the registry root
      await expect(
        hydraS1SoulboundAttester.generateAttestations(request, proof.toBytes())
      ).to.be.revertedWith(
        `RegistryRootMismatch(${BigNumber.from(inputs.publicInputs.registryTreeRoot)}`
      );
    });

    it('Should revert if the input commitment mapper pub keys mismatch the onchain commitment mapper pub keys', async () => {
      await availableRootsRegistry.registerRootForAttester(
        hydraS1SoulboundAttester.address,
        registryTree.getRoot()
      );

      const evmSnapshotId = await evmSnapshot(hre);

      const wrongCommitmentMapperPubKey: EddsaPublicKey = [
        commitmentMapperPubKey[0].add(1),
        commitmentMapperPubKey[1].add(1),
      ];

      await commitmentMapperRegistry.updateCommitmentMapperEdDSAPubKey(wrongCommitmentMapperPubKey);

      await expect(
        hydraS1SoulboundAttester.generateAttestations(request, proof.toBytes())
      ).to.be.revertedWith(
        `CommitmentMapperPubKeyMismatch(${wrongCommitmentMapperPubKey[0]}, ${wrongCommitmentMapperPubKey[1]}, ${commitmentMapperPubKey[0]}, ${commitmentMapperPubKey[1]})`
      );

      await evmRevert(hre, evmSnapshotId);
    });

    it('Should revert if the snark input ticketIdentifier mismatch the claim ticketIdentifier', async () => {
      // 0 - Checks that it's reverted if the fake proof ticketIdentifier is different from the claim ticketIdentifier
      const wrongTicketIdentifier = await generateTicketIdentifier(
        hydraS1SoulboundAttester.address,
        group2.properties.groupIndex
      );

      const wrongProof = await prover.generateSnarkProof({
        ...userParams,
        ticketIdentifier: wrongTicketIdentifier,
      });

      await expect(
        hydraS1SoulboundAttester.generateAttestations(request, wrongProof.toBytes())
      ).to.be.revertedWith(
        `TicketIdentifierMismatch(${ticketIdentifier}, ${wrongTicketIdentifier})`
      );
    });

    it('Should not allow snark field overflow by providing a ticket that is outside the snark field', async () => {
      // override the ticket proof to overflow
      const wrongProof = { ...proof, input: [...proof.input] };
      wrongProof.input[6] = BigNumber.from(wrongProof.input[6]).add(SNARK_FIELD);

      await expect(
        hydraS1SoulboundAttester.generateAttestations(request, toBytes(wrongProof))
      ).to.be.revertedWith(`InvalidGroth16Proof("verifier-gte-snark-scalar-field")`);
    });

    it('Should revert if wrong snark proof', async () => {
      // override the ticket proof to overflow
      const wrongProof = { ...proof, a: [...proof.a] };
      wrongProof.a[0] = BigNumber.from(proof.a[0]).sub(1);

      await expect(
        hydraS1SoulboundAttester.generateAttestations(request, toBytes(wrongProof))
      ).to.be.revertedWith(`InvalidGroth16Proof("")`);
    });

    it('Should generate a proof with Hydra S1 Prover and verify it onchain using the attester', async () => {
      const generateAttestationsTransaction = await hydraS1SoulboundAttester.generateAttestations(
        request,
        proof.toBytes()
      );

      // 0 - Checks that the transaction emitted the event
      await expect(generateAttestationsTransaction)
        .to.emit(hydraS1SoulboundAttester, 'AttestationGenerated')
        .withArgs([
          await (
            await hydraS1SoulboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()
          ).add(group.properties.groupIndex),
          request.destination,
          hydraS1SoulboundAttester.address,
          sourceValue,
          group.properties.generationTimestamp,
          BigNumber.from(inputs.publicInputs.userTicket).toHexString(),
        ]);

      // 1 - Checks that the provided userTicket was successfully recorded in the attester
      expect(
        await hydraS1SoulboundAttester.getDestinationOfTicket(
          BigNumber.from(inputs.publicInputs.userTicket)
        )
      ).to.equal(request.destination);

      expect(
        await hydraS1SoulboundAttester.getTicketData(BigNumber.from(inputs.publicInputs.userTicket))
      ).to.be.eql([BigNumber.from(destination.identifier).toHexString(), 0]);

      expect(
        await hydraS1SoulboundAttester.isTicketOnCooldown(
          BigNumber.from(inputs.publicInputs.userTicket)
        )
      ).to.be.false;

      console.log(sourceValue);

      console.log(
        await attestationsRegistry.hasAttestation(
          (
            await hydraS1SoulboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()
          ).add(group.properties.groupIndex),
          request.destination
        )
      );

      console.log(
        await attestationsRegistry.getAttestationData(
          (
            await hydraS1SoulboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()
          ).add(group.properties.groupIndex),
          request.destination
        )
      );

      // 2 - Checks that the attester recorded the attestation in the registry
      expect(
        await attestationsRegistry.hasAttestation(
          (
            await hydraS1SoulboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()
          ).add(group.properties.groupIndex),
          destinationSigner.address
        )
      ).to.be.true;
    });

    it('Should change the destination if the ticket is reused one time', async () => {
      const newProof = await prover.generateSnarkProof({
        ...userParams,
        destination: destination2,
      });

      const newRequest = {
        ...request,
        destination: BigNumber.from(destination2.identifier).toHexString(),
      };

      const generateAttestationsTransaction = await hydraS1SoulboundAttester.generateAttestations(
        newRequest,
        newProof.toBytes()
      );

      // 0 - Checks that the transaction emitted the event
      await expect(generateAttestationsTransaction)
        .to.emit(hydraS1SoulboundAttester, 'AttestationGenerated')
        .withArgs([
          await (
            await hydraS1SoulboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()
          ).add(group.properties.groupIndex),
        ]);

      // 1 - Checks that the userTicket informations were successfully updated
      expect(
        await hydraS1SoulboundAttester.getDestinationOfTicket(
          BigNumber.from(inputs.publicInputs.userTicket)
        )
      ).to.be.equal(BigNumber.from(destination2.identifier));

      expect(
        await hydraS1SoulboundAttester.getTicketData(BigNumber.from(inputs.publicInputs.userTicket))
      ).to.be.eql([
        BigNumber.from(destination2.identifier).toHexString(),
        await (await ethers.provider.getBlock('latest')).timestamp,
      ]);

      expect(
        await hydraS1SoulboundAttester.isTicketOnCooldown(
          BigNumber.from(inputs.publicInputs.userTicket)
        )
      ).to.be.true;

      // 2 - Checks that the attester unrecorded & rerecorded the attestation in the registry
      // 2.1 - Checks that the old destination has not anymore it's attestation
      await expect(generateAttestationsTransaction)
        .to.emit(hydraS1SoulboundAttester, 'AttestationDeleted')
        .withArgs([
          (
            await hydraS1SoulboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()
          ).add(group.properties.groupIndex),
          destinationSigner.address,
          hydraS1SoulboundAttester.address,
          sourceValue,
          group.properties.generationTimestamp,
          ethers.utils.hexlify(BigNumber.from(inputs.publicInputs.userTicket).toHexString()),
        ]);

      expect(
        await attestationsRegistry.hasAttestation(
          (
            await hydraS1SoulboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()
          ).add(group.properties.groupIndex),
          destinationSigner.address
        )
      ).to.be.false;

      // 2.2 - Checks that the new destination has it's attestation
      expect(
        await attestationsRegistry.hasAttestation(
          (
            await hydraS1SoulboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()
          ).add(group.properties.groupIndex),
          destination2Signer.address
        )
      ).to.be.true;
    });

    it('Should revert if the ticket is reused too many times in cooldown', async () => {
      const ticketData = await hydraS1SoulboundAttester.getTicketData(
        BigNumber.from(inputs.publicInputs.userTicket)
      );

      await expect(
        hydraS1SoulboundAttester.generateAttestations(request, proof.toBytes())
      ).to.be.revertedWith(`TicketUsedAndOnCooldown(["${ticketData[0]}", ${ticketData[1]}])`);
    });

    it('Should reset the cooldown if the ticket is reused many times after the cooldown period', async () => {
      const evmSnapshotId = await evmSnapshot(hre);

      await increaseTime(hre, 300000);

      const generateAttestationsTransaction = hydraS1SoulboundAttester.generateAttestations(
        request,
        proof.toBytes()
      );

      // 0 - Checks that the transaction emitted the event
      await expect(generateAttestationsTransaction)
        .to.emit(hydraS1SoulboundAttester, 'AttestationGenerated')
        .withArgs([
          await (
            await hydraS1SoulboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()
          ).add(group.properties.groupIndex),
        ]);

      // 1 - Checks that the userTicket informations were successfully updated
      expect(
        await hydraS1SoulboundAttester.getDestinationOfTicket(
          BigNumber.from(inputs.publicInputs.userTicket)
        )
      ).to.be.equal(destination.identifier);

      expect(
        await hydraS1SoulboundAttester.getTicketData(BigNumber.from(inputs.publicInputs.userTicket))
      ).to.be.eql([
        BigNumber.from(destination.identifier).toHexString(),
        await (await ethers.provider.getBlock('latest')).timestamp,
      ]);

      expect(
        await hydraS1SoulboundAttester.isTicketOnCooldown(
          BigNumber.from(inputs.publicInputs.userTicket)
        )
      ).to.be.true;

      // 2 - Checks that the attester unrecorded & rerecorded the attestation in the registry
      // 2.1 - Checks that the old destination has not anymore it's attestation
      await expect(generateAttestationsTransaction)
        .to.emit(hydraS1SoulboundAttester, 'AttestationDeleted')
        .withArgs([
          (
            await hydraS1SoulboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()
          ).add(group.properties.groupIndex),
          destination2Signer.address,
          hydraS1SoulboundAttester.address,
          sourceValue,
          group.properties.generationTimestamp,
          ethers.utils.hexlify(BigNumber.from(inputs.publicInputs.userTicket).toHexString()),
        ]);

      expect(
        await attestationsRegistry.hasAttestation(
          (
            await hydraS1SoulboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()
          ).add(group.properties.groupIndex),
          destination2Signer.address
        )
      ).to.be.false;

      // 2.2 - Checks that the new destination has it's attestation
      expect(
        await attestationsRegistry.hasAttestation(
          (
            await hydraS1SoulboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()
          ).add(group.properties.groupIndex),
          destinationSigner.address
        )
      ).to.be.true;

      evmRevert(hre, evmSnapshotId);
    });
  });

  /*************************************************************************************/
  /******************************** DELETE ATTESTATIONS ********************************/
  /*************************************************************************************/
  describe('Delete attestations', () => {
    it('Should revert if the caller is not the owner of the ticket', async () => {
      await expect(
        hydraS1SoulboundAttester
          .connect(destinationSigner)
          .deleteAttestations(
            [
              BigNumber.from(group.properties.groupIndex).add(
                await hydraS1SoulboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()
              ),
            ],
            BigNumber.from(destination2.identifier).toHexString(),
            ethers.utils.toUtf8Bytes('')
          )
      ).to.be.revertedWith(
        `NotAttestationOwner(${inputs.publicInputs.userTicket}, "${destinationSigner.address}")`
      );
    });

    it('Should revert if the ticket is on cooldown', async () => {
      await expect(
        hydraS1SoulboundAttester
          .connect(destination2Signer)
          .deleteAttestations(
            [
              BigNumber.from(group.properties.groupIndex).add(
                await hydraS1SoulboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()
              ),
            ],
            BigNumber.from(destination2.identifier).toHexString(),
            ethers.utils.toUtf8Bytes('')
          )
      ).to.be.revertedWith(`TicketFrozen(${inputs.publicInputs.userTicket})`);
    });

    it('Should delete an attestation', async () => {
      const evmSnapshotId = await evmSnapshot(hre);

      await increaseTime(hre, 300000);

      const ticketInformation = await hydraS1SoulboundAttester.getTicketData(
        BigNumber.from(inputs.publicInputs.userTicket).toHexString()
      );

      const deleteAttestationsTransaction = await hydraS1SoulboundAttester
        .connect(destination2Signer)
        .deleteAttestations(
          [
            BigNumber.from(group.properties.groupIndex).add(
              await hydraS1SoulboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()
            ),
          ],
          BigNumber.from(destination2.identifier).toHexString(),
          ethers.utils.toUtf8Bytes('')
        );

      await expect(deleteAttestationsTransaction)
        .to.emit(hydraS1SoulboundAttester, 'AttestationDeleted')
        .withArgs([
          (
            await hydraS1SoulboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()
          ).add(group.properties.groupIndex),
          destination2Signer.address,
          hydraS1SoulboundAttester.address,
          sourceValue,
          group.properties.generationTimestamp,
          ethers.utils.hexlify(BigNumber.from(inputs.publicInputs.userTicket).toHexString()),
        ]);

      expect(
        await hydraS1SoulboundAttester.getDestinationOfTicket(
          BigNumber.from(inputs.publicInputs.userTicket)
        )
      ).to.be.equal(ethers.constants.AddressZero);

      expect(
        await hydraS1SoulboundAttester.getTicketData(BigNumber.from(inputs.publicInputs.userTicket))
      ).to.be.eql([ethers.constants.AddressZero, ticketInformation[1]]);

      expect(
        await hydraS1SoulboundAttester.isTicketOnCooldown(
          BigNumber.from(inputs.publicInputs.userTicket)
        )
      ).to.be.false;

      await evmRevert(hre, evmSnapshotId);
    });
  });
});
