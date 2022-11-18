import { expect } from 'chai';
import hre from 'hardhat';
import {
  AttestationsRegistry,
  AvailableRootsRegistry,
  Badges,
  CommitmentMapperRegistry,
  Front,
  HydraS1SimpleAttester,
  HydraS1AccountboundAttester,
  Pythia1SimpleAttester,
  TransparentUpgradeableProxy__factory,
  HydraS1AccountboundAttesterv2,
} from '../../types';
import { RequestStruct } from 'types/Attester';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import {
  buildPoseidon,
  CommitmentMapperTester,
  EddsaPublicKey,
} from '@sismo-core/commitment-mapper-tester-js';
import { HydraS1Account, HydraS1Prover, KVMerkleTree } from '@sismo-core/hydra-s1';
import { BigNumber } from 'ethers';
import { AttestationStructOutput } from 'types/HydraS1SimpleAttester';
import { deploymentsConfig } from '../../tasks/deploy-tasks/deployments-config';
import { Deployed0 } from '../../tasks/deploy-tasks/full/0-deploy-core-and-hydra-s1-simple-and-accountbound.task';
import { getImplementation } from '../../utils';
import {
  encodeGroupProperties,
  evmRevert,
  evmSnapshot,
  generateAttesterGroups,
  generateHydraS1Accounts,
  generateGroups,
  generateExternalNullifier,
  getEventArgs,
  HydraS1SimpleGroup,
  encodeHydraS1AccountboundGroupProperties,
  generateHydraS1AccountboundAttesterGroups,
  HydraS1AccountboundGroup,
} from '../utils';
import { Deployed1 } from 'tasks/deploy-tasks/full/1-deploy-pythia-1-simple.task';
import {
  CommitmentSignerTester,
  encodePythia1GroupProperties,
  generatePythia1Group,
} from '../utils/pythia-1';
import { Pythia1Prover, SnarkProof } from '@sismo-core/pythia-1';

const config = deploymentsConfig[hre.network.name];
describe('Test E2E Protocol', () => {
  let chainId: number;
  let snapshotId: string;

  // contracts
  let attestationsRegistry: AttestationsRegistry;
  let hydraS1AccountboundAttester: HydraS1AccountboundAttester;
  let hydraS1AccountboundAttesterv2: HydraS1AccountboundAttesterv2;
  let hydraS1SimpleAttester: HydraS1SimpleAttester;
  let pythia1SimpleAttester: Pythia1SimpleAttester;
  let availableRootsRegistry: AvailableRootsRegistry;
  let commitmentMapperRegistry: CommitmentMapperRegistry;
  let front: Front;
  let badges: Badges;
  let earlyUserCollectionId;

  // hydra s1 prover
  let hydraS1Prover1: HydraS1Prover;
  let hydraS1Prover2: HydraS1Prover;
  let commitmentMapper: CommitmentMapperTester;
  let commitmentMapperPubKey: EddsaPublicKey;
  let registryTree1: KVMerkleTree;
  let registryTree2: KVMerkleTree;

  // pythia 1 prover
  let pythia1Prover: Pythia1Prover;
  let commitmentSigner: CommitmentSignerTester;

  // Test Signers
  let deployer: SignerWithAddress;
  let proxyAdminSigner: SignerWithAddress;
  let pythia1destinationSigner: SignerWithAddress;

  // Test accounts
  let source1: HydraS1Account;
  let source2: HydraS1Account;
  let destination1: HydraS1Account;
  let destination2: HydraS1Account;

  // Data source test
  let source1Value: BigNumber;
  let source2Value: BigNumber;
  let accountsTree1: KVMerkleTree;
  let accountsTree2: KVMerkleTree;
  let group1: HydraS1SimpleGroup;
  let group2: HydraS1AccountboundGroup;

  // Valid request and proof
  let request1: RequestStruct;
  let request2: RequestStruct;
  let proofRequest1: string;
  let proofRequest2: string;
  let externalNullifier1: BigNumber;
  let externalNullifier2: BigNumber;
  let attestationsRequested1: AttestationStructOutput[];
  let attestationsRequested2: AttestationStructOutput[];
  let poseidon;

  before(async () => {
    const signers = await hre.ethers.getSigners();
    [deployer, , proxyAdminSigner, pythia1destinationSigner] = signers;
    chainId = parseInt(await hre.getChainId());
    poseidon = await buildPoseidon();

    // 1 - Init commitment mapper and commitment signer
    commitmentMapper = await CommitmentMapperTester.generate();
    commitmentMapperPubKey = await commitmentMapper.getPubKey();
    commitmentSigner = new CommitmentSignerTester();

    // 2 - Generate Hydra S1 Accounts with the commitment mapper
    let hydraS1Accounts: HydraS1Account[] = await generateHydraS1Accounts(
      signers,
      commitmentMapper
    );

    source1 = hydraS1Accounts[0];
    source2 = hydraS1Accounts[4];
    destination1 = hydraS1Accounts[1];
    destination2 = hydraS1Accounts[3];

    // 3 - Generate data source
    const allList = generateGroups(hydraS1Accounts);
    const { dataFormat, groups } = await generateAttesterGroups(allList);
    const { dataFormat: dataFormat2, groups: groups2 } =
      await generateHydraS1AccountboundAttesterGroups(allList, {
        cooldownDuration: 10,
      });

    registryTree1 = dataFormat.registryTree;
    registryTree2 = dataFormat2.registryTree;
    accountsTree1 = dataFormat.accountsTrees[0];
    accountsTree2 = dataFormat2.accountsTrees[0];
    group1 = groups[0];
    group2 = groups2[0];
    source1Value = accountsTree1.getValue(BigNumber.from(source1.identifier).toHexString());
    source2Value = accountsTree1.getValue(BigNumber.from(source2.identifier).toHexString());

    // 4 - Init Proving scheme
    hydraS1Prover1 = new HydraS1Prover(registryTree1, commitmentMapperPubKey);
    hydraS1Prover2 = new HydraS1Prover(registryTree2, commitmentMapperPubKey);
    pythia1Prover = new Pythia1Prover();
  });

  /*************************************************************************************/
  /********************************** SETUP ********************************************/
  /*************************************************************************************/

  describe('Deployments, setup contracts and prepare test requests', () => {
    it('Should deploy and setup core', async () => {
      // Deploy Sismo Protocol Core contracts

      ({
        attestationsRegistry,
        badges,
        front,
        commitmentMapperRegistry,
        hydraS1SimpleAttester,
        hydraS1AccountboundAttester,
        hydraS1AccountboundAttesterv2,
        availableRootsRegistry,
      } = (await hre.run('0-deploy-core-and-hydra-s1-simple-and-accountbound', {
        options: {
          proxyAdmin: proxyAdminSigner.address,
        },
      })) as Deployed0);

      ({ pythia1SimpleAttester } = (await hre.run('1-deploy-pythia-1-simple', {
        options: {
          proxyAdmin: proxyAdminSigner.address,
        },
      })) as Deployed1);

      await (
        await availableRootsRegistry.registerRootForAttester(
          hydraS1SimpleAttester.address,
          registryTree1.getRoot()
        )
      ).wait();
      await (
        await availableRootsRegistry.registerRootForAttester(
          hydraS1AccountboundAttester.address,
          registryTree2.getRoot()
        )
      ).wait();
      earlyUserCollectionId = await front.EARLY_USER_COLLECTION();
    });
    it('Should prepare test requests', async () => {
      // Deploy Sismo Protocol Core contracts
      externalNullifier1 = await generateExternalNullifier(
        hydraS1SimpleAttester.address,
        group1.properties.groupIndex
      );

      externalNullifier2 = await generateExternalNullifier(
        hydraS1AccountboundAttester.address,
        group2.properties.groupIndex
      );

      request1 = {
        claims: [
          {
            groupId: group1.id,
            claimedValue: source1Value,
            extraData: encodeGroupProperties(group1.properties),
          },
        ],
        destination: BigNumber.from(destination1.identifier).toHexString(),
      };

      proofRequest1 = (
        await hydraS1Prover1.generateSnarkProof({
          source: source1,
          destination: destination1,
          claimedValue: source1Value,
          chainId: chainId,
          accountsTree: accountsTree1,
          externalNullifier: externalNullifier1,
          isStrict: !group1.properties.isScore,
        })
      ).toBytes();

      request2 = {
        claims: [
          {
            groupId: group2.id,
            claimedValue: source2Value,
            extraData: encodeHydraS1AccountboundGroupProperties(group2.properties),
          },
        ],
        destination: BigNumber.from(destination1.identifier).toHexString(),
      };

      proofRequest2 = (
        await hydraS1Prover2.generateSnarkProof({
          source: source2,
          destination: destination1,
          claimedValue: source2Value,
          chainId: chainId,
          accountsTree: accountsTree2,
          externalNullifier: externalNullifier2,
          isStrict: !group2.properties.isScore,
        })
      ).toBytes();

      [attestationsRequested1, attestationsRequested2] = await front.batchBuildAttestations(
        [hydraS1SimpleAttester.address, hydraS1AccountboundAttester.address],
        [request1, request2],
        [proofRequest1, proofRequest2]
      );

      snapshotId = await evmSnapshot(hre);
    });
  });

  /*************************************************************************************/
  /************************ATTESTATIONS AND BADGES GENERATIONS**************************/
  /*************************************************************************************/

  describe('Test attestations generations', () => {
    it('Should generate attestations from hydra s1 simple and hydra s1 accountbound via batch', async () => {
      const tx = await front.batchGenerateAttestations(
        [hydraS1SimpleAttester.address, hydraS1AccountboundAttester.address],
        [request1, request2],
        [proofRequest1, proofRequest2]
      );
      const { events } = await tx.wait();

      const earlyUserActivated = Date.now() < Date.parse('15 Sept 2022 00:00:00 GMT');
      if (earlyUserActivated) {
        const args = getEventArgs(events, 'EarlyUserAttestationGenerated');
        expect(args.destination).to.eql(request1.destination);
      }

      const attestationsValues = await attestationsRegistry.getAttestationValueBatch(
        [
          attestationsRequested1[0].collectionId,
          attestationsRequested2[0].collectionId,
          earlyUserCollectionId,
        ],
        [request1.destination, request2.destination, request1.destination]
      );

      const expectedAttestationsValues = [
        attestationsRequested1[0].value,
        attestationsRequested2[0].value,
        earlyUserActivated ? BigNumber.from(1) : BigNumber.from(0),
      ];

      expect(attestationsValues).to.be.eql(expectedAttestationsValues);

      const balances = await badges.balanceOfBatch(
        [request1.destination, request2.destination, request1.destination],
        [
          attestationsRequested1[0].collectionId,
          attestationsRequested2[0].collectionId,
          earlyUserCollectionId,
        ]
      );

      const expectedBalances = expectedAttestationsValues;

      expect(balances).to.be.eql(expectedBalances);
    });
    it('Should reset contracts', async () => {
      await evmRevert(hre, snapshotId);

      const attestationsValues = await attestationsRegistry.getAttestationValueBatch(
        [
          attestationsRequested1[0].collectionId,
          attestationsRequested2[0].collectionId,
          earlyUserCollectionId,
        ],
        [request1.destination, request2.destination, request1.destination]
      );

      const expectedAttestationsValues = [BigNumber.from(0), BigNumber.from(0), BigNumber.from(0)];

      expect(attestationsValues).to.be.eql(expectedAttestationsValues);

      const balances = await badges.balanceOfBatch(
        [request1.destination, request2.destination, request1.destination],
        [
          attestationsRequested1[0].collectionId,
          attestationsRequested2[0].collectionId,
          earlyUserCollectionId,
        ]
      );

      const expectedBalances = expectedAttestationsValues;

      expect(balances).to.be.eql(expectedBalances);
    });
    it('Should generate attestations from hydra s1 simple and hydra s1 accountbound via front and two separate txs', async () => {
      const tx = await front.generateAttestations(
        hydraS1SimpleAttester.address,
        request1,
        proofRequest1
      );
      await front.generateAttestations(
        hydraS1AccountboundAttester.address,
        request2,
        proofRequest2
      );
      const { events } = await tx.wait();
      const earlyUserActivated = Date.now() < Date.parse('15 Sept 2022 00:00:00 GMT');
      if (earlyUserActivated) {
        const args = getEventArgs(events, 'EarlyUserAttestationGenerated');
        expect(args.destination).to.eql(request1.destination);
      }

      const attestationsValues = await attestationsRegistry.getAttestationValueBatch(
        [
          attestationsRequested1[0].collectionId,
          attestationsRequested2[0].collectionId,
          earlyUserCollectionId,
        ],
        [request1.destination, request2.destination, request1.destination]
      );

      const expectedAttestationsValues = [
        attestationsRequested1[0].value,
        attestationsRequested2[0].value,
        earlyUserActivated ? BigNumber.from(1) : BigNumber.from(0),
      ];

      expect(attestationsValues).to.be.eql(expectedAttestationsValues);

      const balances = await badges.balanceOfBatch(
        [request1.destination, request2.destination, request1.destination],
        [
          attestationsRequested1[0].collectionId,
          attestationsRequested2[0].collectionId,
          earlyUserCollectionId,
        ]
      );

      const expectedBalances = expectedAttestationsValues;

      expect(balances).to.be.eql(expectedBalances);
    });
    it('Should generate an attestation from pythia 1 simple', async () => {
      const secret = BigNumber.from('0x123');
      const commitment = poseidon([secret]);
      const commitmentValue = BigNumber.from('0x9');
      const pythia1group1 = generatePythia1Group({
        internalCollectionId: 0,
        isScore: false,
      });
      const commitmentReceipt = await commitmentSigner.getCommitmentReceipt(
        commitment,
        commitmentValue,
        pythia1group1.id
      );

      const externalNullifier = await generateExternalNullifier(
        pythia1SimpleAttester.address,
        pythia1group1.properties.internalCollectionId
      );

      const request = {
        claims: [
          {
            groupId: pythia1group1.id,
            claimedValue: commitmentValue,
            extraData: encodePythia1GroupProperties(pythia1group1.properties),
          },
        ],
        destination: BigNumber.from(pythia1destinationSigner.address).toHexString(),
      };

      const proof = (await pythia1Prover.generateSnarkProof({
        secret: secret,
        value: commitmentValue,
        commitmentReceipt: commitmentReceipt,
        commitmentSignerPubKey: await commitmentSigner.getPublicKey(),
        destinationIdentifier: pythia1destinationSigner.address,
        claimedValue: commitmentValue,
        chainId: chainId,
        groupId: pythia1group1.id,
        ticketIdentifier: externalNullifier,
        isStrict: !pythia1group1.properties.isScore,
      })) as SnarkProof;

      const tx = await pythia1SimpleAttester
        .connect(pythia1destinationSigner)
        .generateAttestations(request, proof.toBytes());
      await tx.wait();

      const balances = await badges.balanceOfBatch(
        [pythia1destinationSigner.address],
        [
          BigNumber.from(config.synapsPythia1SimpleAttester.collectionIdFirst).add(
            pythia1group1.properties.internalCollectionId
          ),
        ]
      );

      expect(balances).to.be.eql([commitmentValue]);
    });
  });

  describe('Update Implementation', () => {
    it('Should update Hydra S1 Simple implementation', async () => {
      const { hydraS1SimpleAttester: newHydraS1SimpleAttester } = await hre.run(
        'deploy-hydra-s1-simple-attester',
        {
          collectionIdFirst: config.hydraS1SimpleAttester.collectionIdFirst,
          collectionIdLast: config.hydraS1SimpleAttester.collectionIdLast,
          commitmentMapperRegistryAddress: commitmentMapperRegistry.address,
          availableRootsRegistryAddress: availableRootsRegistry.address,
          attestationsRegistryAddress: attestationsRegistry.address,
          options: { behindProxy: false },
        }
      );

      const hydraS1SimpleAttesterProxy = TransparentUpgradeableProxy__factory.connect(
        hydraS1SimpleAttester.address,
        proxyAdminSigner
      );

      await (await hydraS1SimpleAttesterProxy.upgradeTo(newHydraS1SimpleAttester.address)).wait();

      const implementationAddress = await getImplementation(hydraS1SimpleAttesterProxy);
      expect(implementationAddress).to.eql(newHydraS1SimpleAttester.address);
    });

    it('Should update Hydra S1 Accountbound implementation with V2', async () => {
      const { hydraS1AccountboundAttesterv2: newHydraS1AccountboundAttester } = await hre.run(
        'deploy-hydra-s1-accountbound-attester-v2',
        {
          collectionIdFirst: config.hydraS1AccountboundAttester.collectionIdFirst,
          collectionIdLast: config.hydraS1AccountboundAttester.collectionIdLast,
          commitmentMapperRegistryAddress: commitmentMapperRegistry.address,
          availableRootsRegistryAddress: availableRootsRegistry.address,
          attestationsRegistryAddress: attestationsRegistry.address,
          options: { behindProxy: false },
        }
      );

      const hydraS1AccountboundAttesterProxy = TransparentUpgradeableProxy__factory.connect(
        hydraS1AccountboundAttesterv2.address,
        proxyAdminSigner
      );

      await (
        await hydraS1AccountboundAttesterProxy.upgradeTo(newHydraS1AccountboundAttester.address)
      ).wait();

      const implementationAddress = await getImplementation(hydraS1AccountboundAttesterProxy);
      expect(implementationAddress).to.eql(newHydraS1AccountboundAttester.address);
    });
  });
});
