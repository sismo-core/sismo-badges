import hre from 'hardhat';
import { expect } from 'chai';
import { describe } from 'mocha';
import {
  AvailableRootsRegistry,
  HydraS1SimpleAttester,
  AttestationsRegistry,
  Badges,
  CommitmentMapperRegistry,
  Front,
  HydraS1SoulboundAttester,
} from 'types';
import { RequestStruct } from 'types/Attester';

import { getEventArgs } from '../utils/expectEvent';
import { HydraS1Prover, SnarkProof, KVMerkleTree, HydraS1Account } from '@sismo-core/hydra-s1';
import { CommitmentMapperTester, EddsaPublicKey } from '@sismo-core/commitment-mapper-tester-js';
import { BigNumber } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { deploymentsConfig } from '../../tasks/deploy-tasks/deployments-config';
import {
  generateAttesterGroups,
  generateTicketIdentifier,
  generateHydraS1Accounts,
  generateLists,
  Group,
  encodeGroupProperties,
  evmSnapshot,
  evmRevert,
} from '../utils';
import { Deployed0 } from 'tasks/deploy-tasks/full/0-deploy-core-and-hydra-s1-simple-and-soulbound.task';
import { AttestationStructOutput } from 'types/HydraS1SimpleAttester';

const config = deploymentsConfig[hre.network.name];
describe('Test E2E Protocol', () => {
  let chainId: number;
  let snapshotId: string;

  // contracts
  let attestationsRegistry: AttestationsRegistry;
  let hydraS1SoulboundAttester: HydraS1SoulboundAttester;
  let hydraS1SimpleAttester: HydraS1SimpleAttester;
  let availableRootsRegistry: AvailableRootsRegistry;
  let commitmentMapperRegistry: CommitmentMapperRegistry;
  let front: Front;
  let badges: Badges;
  let earlyUserCollectionId;

  // hydra s1 prover
  let prover: HydraS1Prover;
  let commitmentMapper: CommitmentMapperTester;
  let commitmentMapperPubKey: EddsaPublicKey;
  let registryTree: KVMerkleTree;

  // Test Signers
  let deployer: SignerWithAddress;
  let randomSigner: SignerWithAddress;
  let proxyAdminSigner: SignerWithAddress;

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
  let group1: Group;
  let group2: Group;

  // Valid request and proof
  let request1: RequestStruct;
  let request2: RequestStruct;
  let proofRequest1: string;
  let proofRequest2: string;
  let ticketIdentifier1: BigNumber;
  let ticketIdentifier2: BigNumber;
  let attestationsRequested1: AttestationStructOutput[];
  let attestationsRequested2: AttestationStructOutput[];

  before(async () => {
    const signers = await hre.ethers.getSigners();
    [deployer, randomSigner, proxyAdminSigner] = signers;
    chainId = parseInt(await hre.getChainId());

    // 1 - Init commitment mapper
    commitmentMapper = await CommitmentMapperTester.generate();
    commitmentMapperPubKey = await commitmentMapper.getPubKey();
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
    const allList = await generateLists(hydraS1Accounts);
    const { dataFormat, groups } = await generateAttesterGroups(allList);

    registryTree = dataFormat.registryTree;
    accountsTree1 = dataFormat.accountsTrees[0];
    accountsTree2 = dataFormat.accountsTrees[1];
    group1 = groups[0];
    group2 = groups[1];
    source1Value = accountsTree1.getValue(BigNumber.from(source1.identifier).toHexString());
    source2Value = accountsTree1.getValue(BigNumber.from(source2.identifier).toHexString());

    // 4 - Init Proving scheme
    prover = new HydraS1Prover(registryTree, commitmentMapperPubKey);
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
        hydraS1SoulboundAttester,
        availableRootsRegistry,
      } = (await hre.run('0-deploy-core-and-hydra-s1-simple-and-soulbound', {
        options: {
          proxyAdmin: proxyAdminSigner.address,
        },
      })) as Deployed0);
      const root = registryTree.getRoot();
      await (
        await availableRootsRegistry.registerRootForAttester(hydraS1SimpleAttester.address, root)
      ).wait();
      await (
        await availableRootsRegistry.registerRootForAttester(hydraS1SoulboundAttester.address, root)
      ).wait();
      earlyUserCollectionId = await front.EARLY_USER_COLLECTION();
    });
    it('Should prepare test requests', async () => {
      // Deploy Sismo Protocol Core contracts
      ticketIdentifier1 = await generateTicketIdentifier(
        hydraS1SimpleAttester.address,
        group1.properties.groupIndex
      );

      ticketIdentifier2 = await generateTicketIdentifier(
        hydraS1SoulboundAttester.address,
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
        await prover.generateSnarkProof({
          source: source1,
          destination: destination1,
          claimedValue: source1Value,
          chainId: chainId,
          accountsTree: accountsTree1,
          ticketIdentifier: ticketIdentifier1,
          isStrict: !group1.properties.isScore,
        })
      ).toBytes();

      request2 = {
        claims: [
          {
            groupId: group2.id,
            claimedValue: source2Value,
            extraData: encodeGroupProperties(group2.properties),
          },
        ],
        destination: BigNumber.from(destination1.identifier).toHexString(),
      };

      proofRequest2 = (
        await prover.generateSnarkProof({
          source: source2,
          destination: destination1,
          claimedValue: source2Value,
          chainId: chainId,
          accountsTree: accountsTree2,
          ticketIdentifier: ticketIdentifier2,
          isStrict: !group2.properties.isScore,
        })
      ).toBytes();

      [attestationsRequested1, attestationsRequested2] = await front.batchBuildAttestations(
        [hydraS1SimpleAttester.address, hydraS1SoulboundAttester.address],
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
    it('Should generate attestations from hydra s1 simple and hydra s1 soulbound via batch', async () => {
      const tx = await front.batchGenerateAttestations(
        [hydraS1SimpleAttester.address, hydraS1SoulboundAttester.address],
        [request1, request2],
        [proofRequest1, proofRequest2]
      );
      const { events } = await tx.wait();
      const args = getEventArgs(events, 'EarlyUserAttestationGenerated');

      expect(args.destination).to.eql(request1.destination);

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
        BigNumber.from(1),
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
    it('Should generate attestations from hydra s1 simple and hydra s1 soulbound via front and two separate txs', async () => {
      const tx = await front.generateAttestations(
        hydraS1SimpleAttester.address,
        request1,
        proofRequest1
      );
      await front.generateAttestations(hydraS1SoulboundAttester.address, request2, proofRequest2);
      const { events } = await tx.wait();
      const args = getEventArgs(events, 'EarlyUserAttestationGenerated');

      expect(args.destination).to.eql(request1.destination);

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
        BigNumber.from(1),
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
  });
});
