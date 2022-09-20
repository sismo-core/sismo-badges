import { expect } from 'chai';
import hre from 'hardhat';
import {
  AttestationsRegistry,
  AvailableRootsRegistry,
  Badges,
  CommitmentMapperRegistry,
  HydraS1IncrementalMerkleAttester,
  HydraS1SimpleAttester,
  IncrementalMerkleTree,
} from 'types';
import { RequestStruct } from 'types/Attester';

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { CommitmentMapperTester } from '@sismo-core/commitment-mapper-tester-js';
import {
  buildPoseidon,
  EddsaPublicKey,
  HydraS1Account,
  HydraS1Prover,
  KVMerkleTree,
  SnarkProof,
  SNARK_FIELD,
} from '@sismo-core/hydra-s1';
import { BigNumber } from 'ethers';
import { Deployed2 } from 'tasks/deploy-tasks/full/2-deploy-hydra-s1-merkle-attester.task';
import { deploymentsConfig } from '../../../../tasks/deploy-tasks/deployments-config';
import {
  encodeGroupProperties,
  generateAttesterGroups,
  generateGroupIdFromEncodedProperties,
  generateGroupIdFromProperties,
  generateHydraS1Accounts,
  generateLists,
  generateTicketIdentifier,
  Group,
  toBytes,
} from '../../../utils';
import { getEventArgs } from '../../../utils/expectEvent';
import hasherContract from '../../../../build/Hasher.json';

const NUMBER_OF_LEVEL = 4;
const NUMBER_OF_HISTORICAL_ROOTS = 3;

const config = deploymentsConfig[hre.network.name];
const collectionIdFirst = BigNumber.from(config.hydraS1SimpleAttester.collectionIdFirst);
const collectionIdLast = BigNumber.from(config.hydraS1SimpleAttester.collectionIdLast);

describe('Test Hydra S1 merkle attester contract, not strict', () => {
  let chainId: number;
  let poseidon;

  // contracts
  let hydraS1IncrementalMerkleAttester: HydraS1IncrementalMerkleAttester;
  let incrementalMerkleTree: IncrementalMerkleTree;
  let attestationsRegistry: AttestationsRegistry;
  let badges: Badges;

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
  let destination1: HydraS1Account;
  let destination2: HydraS1Account;

  // Data source test
  let source1Value: BigNumber;
  let accountsTree1: KVMerkleTree;
  let accountsTree2: KVMerkleTree;
  let group1: Group;
  let group2: Group;

  // Valid request and proof
  let request: RequestStruct;
  let proof: SnarkProof;
  let ticketIdentifier: BigNumber;

  before(async () => {
    const signers = await hre.ethers.getSigners();
    [deployer, randomSigner, proxyAdminSigner] = signers;
    chainId = parseInt(await hre.getChainId());

    poseidon = await buildPoseidon();

    // 1 - Init commitment mapper
    commitmentMapper = await CommitmentMapperTester.generate();
    commitmentMapperPubKey = await commitmentMapper.getPubKey();

    // 2 - Generate Hydra S1 Accounts with the commitment mapper
    let hydraS1Accounts: HydraS1Account[] = await generateHydraS1Accounts(
      signers,
      commitmentMapper
    );

    source1 = hydraS1Accounts[0];
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

    // 4 - Init Proving scheme
    prover = new HydraS1Prover(registryTree, commitmentMapperPubKey);
  });

  /*************************************************************************************/
  /********************************** DEPLOYMENTS **************************************/
  /*************************************************************************************/

  describe('Deployments', () => {
    it('Should deploy and setup hydra s1 merkle attester', async () => {
      const Hasher = await hre.ethers.getContractFactory(
        hasherContract.abi,
        hasherContract.bytecode
      );
      const hasher = await Hasher.deploy();

      // todo: remove - it is only useful to run tests only on this file .
      await hre.run('0-deploy-core-and-hydra-s1-simple-and-soulbound', {});

      const { mockAttestationsRegistry } = await hre.run('deploy-mock-attestations-registry', {
        attestationValue: 1,
        options: {
          behindProxy: false,
        },
      });

      ({ hydraS1IncrementalMerkleAttester, incrementalMerkleTree } = (await hre.run(
        '2-deploy-hydra-s1-merkle-attester',
        {
          attestationsRegistryAddress: mockAttestationsRegistry.address,
          hasherAddress: hasher.address,
          levels: '2', // this is not taken into account for now (hardcoded in deployment)
          rootHistorySize: '3',
          options: {
            behindProxy: false,
          },
        }
      )) as Deployed2);

      const leaf = poseidon([source1.identifier, source1Value]);
      console.log(`Adding ${leaf} as a leaf`);
      const tx = await incrementalMerkleTree.addLeaf(leaf);
      const { events } = await tx.wait();

      const root = await incrementalMerkleTree.getLastRoot();
      console.log(root);
    });
  });

  /*************************************************************************************/
  /***************************** GENERATE VALID ATTESTATION ****************************/
  /*************************************************************************************/

  describe('Generate valid attestation', () => {
    it('Should generate a proof with a pythia 1 prover and verify it onchain using the attester', async () => {
      ticketIdentifier = await generateTicketIdentifier(
        hydraS1IncrementalMerkleAttester.address,
        group1.properties.groupIndex
      );

      request = {
        claims: [
          {
            groupId: group1.id,
            claimedValue: source1Value,
            extraData: encodeGroupProperties(group1.properties),
          },
        ],
        destination: BigNumber.from(destination1.identifier).toHexString(),
      };

      proof = await prover.generateSnarkProof({
        source: source1,
        destination: destination1,
        claimedValue: source1Value,
        chainId: chainId,
        accountsTree: accountsTree1,
        ticketIdentifier: ticketIdentifier,
        isStrict: !group1.properties.isScore,
      });

      const tx = await hydraS1IncrementalMerkleAttester.generateAttestations(
        request,
        proof.toBytes()
      );
      const { events } = await tx.wait();
      const args = getEventArgs(events, 'AttestationGenerated');

      expect(args.attestation.issuer).to.equal(hydraS1IncrementalMerkleAttester.address);
      expect(args.attestation.owner).to.equal(
        BigNumber.from(destination1.identifier).toHexString()
      );
      expect(args.attestation.collectionId).to.equal(
        collectionIdFirst.add(group1.properties.groupIndex)
      );
      expect(args.attestation.value).to.equal(0);
      expect(args.attestation.timestamp).to.equal(group1.properties.generationTimestamp);
    });
  });
});
