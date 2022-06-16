import hre, { ethers } from 'hardhat';
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
} from '../utils';
import { Deployed0 } from 'tasks/deploy-tasks/full/0-deploy-core-and-hydra-s1-simple-and-soulbound.task';

const config = deploymentsConfig[hre.network.name];

describe('Test E2E Protocol', () => {
  let chainId: number;

  // contracts
  let attestationsRegistry: AttestationsRegistry;
  let hydraS1SoulboundAttester: HydraS1SoulboundAttester;
  let hydraS1SimpleAttester: HydraS1SimpleAttester;
  let availableRootsRegistry: AvailableRootsRegistry;
  let commitmentMapperRegistry: CommitmentMapperRegistry;
  let front: Front;
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
      await availableRootsRegistry.registerRootForAttester(hydraS1SimpleAttester.address, root);
    });
  });

  /*************************************************************************************/
  /***************************** GENERATE VALID ATTESTATION ****************************/
  /*************************************************************************************/

  describe('Generate valid attestation from front', () => {
    it('Should generate an attestation from hydra-s1 simple and receive the early user attestation', async () => {
      ticketIdentifier = await generateTicketIdentifier(
        hydraS1SimpleAttester.address,
        group1.properties.listIndex
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

      const attestationRequested = await hydraS1SimpleAttester.buildAttestations(
        request,
        proof.toBytes()
      );

      const tx = await front.generateAttestations(
        hydraS1SimpleAttester.address,
        request,
        proof.toBytes()
      );
      const { events } = await tx.wait();
      const args = getEventArgs(events, 'EarlyUserAttestationGenerated');

      expect(args.destination).to.equal(request.destination);

      const attestationValue = await attestationsRegistry.getAttestationValue(
        attestationRequested[0].collectionId,
        request.destination
      );

      expect(attestationValue).to.be.equal(attestationRequested[0].value);

      const badgeBalance = await badges.balanceOf(
        request.destination,
        attestationRequested[0].collectionId
      );

      expect(badgeBalance).to.be.equal(attestationRequested[0].value);

      const earlyUserCollectionId = await front.EARLY_USER_COLLECTION();

      const earlyUserAttestationValue = await attestationsRegistry.getAttestationValue(
        earlyUserCollectionId,
        request.destination
      );

      expect(earlyUserAttestationValue).to.be.equal(1);

      const balanceOfEarlyUserBadge = await badges.balanceOf(
        request.destination,
        earlyUserCollectionId
      );

      expect(balanceOfEarlyUserBadge).to.be.equal(1);
    });
  });
});
