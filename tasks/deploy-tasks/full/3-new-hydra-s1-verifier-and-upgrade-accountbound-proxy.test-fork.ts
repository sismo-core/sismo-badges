import { getImplementation } from '../../../utils/proxy';
import {
  AttestationStructOutput,
  HydraS1SimpleAttester,
  RequestStruct,
} from '../../../types/HydraS1SimpleAttester';
import { AttestationsRegistry } from '../../../types/AttestationsRegistry';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { config, expect } from 'chai';
import hre, { ethers } from 'hardhat';
import {
  encodeGroupProperties,
  encodeHydraS1AccountboundGroupProperties,
  evmRevert,
  evmSnapshot,
  generateAttesterGroups,
  generateGroups,
  generateHydraS1AccountboundAttesterGroups,
  generateHydraS1Accounts,
  generateExternalNullifier,
  getEventArgs,
  HydraS1AccountboundGroup,
  HydraS1SimpleGroup,
  impersonateAddress,
} from '../../../test/utils';
import { deploymentsConfig } from '../deployments-config';
import {
  AttestationsRegistry__factory,
  AvailableRootsRegistry,
  AvailableRootsRegistry__factory,
  Badges,
  Badges__factory,
  CommitmentMapperRegistry,
  CommitmentMapperRegistry__factory,
  Front,
  Front__factory,
  HydraS1AccountboundAttester,
  HydraS1AccountboundAttester__factory,
  HydraS1SimpleAttester__factory,
  HydraS1Verifier,
  Pythia1SimpleAttester,
  Pythia1SimpleAttester__factory,
  Pythia1Verifier,
  TransparentUpgradeableProxy__factory,
} from '../../../types';
import {
  buildPoseidon,
  EddsaPublicKey,
  HydraS1Account,
  HydraS1Prover,
  KVMerkleTree,
  SnarkProof,
} from '@sismo-core/hydra-s1';
import { HydraS1Prover as HydraS1ProverPrevious } from 'hydra-s1-previous';
import { CommitmentMapperTester } from '@sismo-core/commitment-mapper-tester-js';
import { Pythia1Prover } from '@sismo-core/pythia-1';
import { BigNumber } from 'ethers';

import {
  CommitmentSignerTester,
  encodePythia1GroupProperties,
  generatePythia1Group,
} from '../../../test/utils/pythia-1';

// Launch with command
// FORK=true FORK_NETWORK=polygon npx hardhat test ./tasks/deploy-tasks/full/3-new-hydra-s1-verifier-and-upgrade-accountbound-proxy.test-fork.ts

/*************************************************************************************/
/*********************************** FORK - E2E **************************************/
/*************************************************************************************/

describe('FORK-Test New Hydra S1 Verifier and Upgrade Accountbound proxy', () => {
  let chainId: number;
  let snapshotId: string;

  // contracts
  let attestationsRegistry: AttestationsRegistry;
  let hydraS1Verifier: HydraS1Verifier;
  let hydraS1AccountboundAttester: HydraS1AccountboundAttester;
  let hydraS1SimpleAttester: HydraS1SimpleAttester;
  let pythia1Verifier: Pythia1Verifier;
  let pythia1SimpleAttester: Pythia1SimpleAttester;
  let availableRootsRegistry: AvailableRootsRegistry;
  let commitmentMapperRegistry: CommitmentMapperRegistry;
  let front: Front;
  let badges: Badges;
  let earlyUserCollectionId;

  // hydra s1 prover
  let hydraS1Prover1: HydraS1Prover;
  let hydraS1ProverPrevious: HydraS1ProverPrevious;
  let hydraS1Prover2: HydraS1Prover;
  let hydraS1ProverAccountBound: HydraS1ProverPrevious;
  let commitmentMapper: CommitmentMapperTester;
  let commitmentMapperPubKey: EddsaPublicKey;
  let registryTree1: KVMerkleTree;
  let registryTree2: KVMerkleTree;
  let registryTreeAccountBound: KVMerkleTree;

  // pythia 1 prover
  let pythia1Prover: Pythia1Prover;
  let commitmentSigner: CommitmentSignerTester;

  // Test Signers
  let deployer: SignerWithAddress;
  let proxyAdminSigner: SignerWithAddress;
  let pythia1destinationSigner: SignerWithAddress;
  let randomSigner: SignerWithAddress;

  // Test accounts
  let source1: HydraS1Account;
  let source2: HydraS1Account;
  let source3: HydraS1Account;
  let source4: HydraS1Account;
  let destination1: HydraS1Account;
  let destination2: HydraS1Account;

  // Data source test
  let source1Value: BigNumber;
  let source2Value: BigNumber;
  let source3Value: BigNumber;
  let source4Value: BigNumber;
  let accountsTree1: KVMerkleTree;
  let accountsTree2: KVMerkleTree;
  let accountsTreeAccountBound: KVMerkleTree;
  let group1: HydraS1SimpleGroup;
  let group2: HydraS1SimpleGroup;
  let groupAccountBound: HydraS1AccountboundGroup;

  // Valid request and proof
  let request1: RequestStruct;
  let request2: RequestStruct;
  let request3: RequestStruct;
  let request4: RequestStruct;
  let proofRequest1: string;
  let proofRequest2: string;
  let proofRequest3: string;
  let proofRequest4: string;
  let externalNullifier1: BigNumber;
  let externalNullifier2: BigNumber;
  let externalNullifierAccountBound: BigNumber;
  let attestationsRequested1: AttestationStructOutput[];
  let attestationsRequested2: AttestationStructOutput[];
  let attestationsRequested3: AttestationStructOutput[];
  let attestationsRequested4: AttestationStructOutput[];
  let poseidon;

  const config = deploymentsConfig[process.env.FORK_NETWORK ?? hre.network.name];

  const oldAttestersAddressesConfig = {
    polygon: {
      hydraS1SimpleAttester: {
        address: '0x10b27d9efa4A1B65412188b6f4F29e64Cf5e0146',
      },
      hydraS1AccountboundAttester: {
        address: '0x095590C542571Df14c6220c3163112286a5f7518',
      },
    },
  };

  const oldConfig = oldAttestersAddressesConfig[process.env.FORK_NETWORK ?? hre.network.name];

  before(async () => {
    const signers = await hre.ethers.getSigners();
    [deployer, , proxyAdminSigner, pythia1destinationSigner, randomSigner] = signers;
    // impersonate address for the fork test
    await impersonateAddress(hre, config.deployOptions.proxyAdmin!, true);

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
    source2 = hydraS1Accounts[5];
    source3 = hydraS1Accounts[6];
    source4 = hydraS1Accounts[7];
    destination1 = hydraS1Accounts[1];
    destination2 = hydraS1Accounts[3];

    // 3 - Generate data source
    const allList = generateGroups(hydraS1Accounts);
    const { dataFormat, groups } = await generateAttesterGroups(allList);
    const { dataFormat: dataFormat2, groups: groups2 } = await generateAttesterGroups(allList);
    const { dataFormat: dataFormatAccountBound, groups: groupsAccountBound } =
      await generateHydraS1AccountboundAttesterGroups(allList);

    registryTree1 = dataFormat.registryTree;
    registryTree2 = dataFormat2.registryTree;
    registryTreeAccountBound = dataFormatAccountBound.registryTree;
    accountsTree1 = dataFormat.accountsTrees[0];
    accountsTree2 = dataFormat2.accountsTrees[0];
    accountsTreeAccountBound = dataFormatAccountBound.accountsTrees[0];
    group1 = groups[0];
    group2 = groups2[0];
    groupAccountBound = groupsAccountBound[0];
    source1Value = accountsTree1.getValue(BigNumber.from(source1.identifier).toHexString());
    source2Value = accountsTree2.getValue(BigNumber.from(source2.identifier).toHexString());
    source3Value = accountsTree1.getValue(BigNumber.from(source3.identifier).toHexString());
    source4Value = accountsTreeAccountBound.getValue(
      BigNumber.from(source4.identifier).toHexString()
    );

    // 4 - Init Proving scheme
    hydraS1ProverPrevious = new HydraS1ProverPrevious(registryTree1, commitmentMapperPubKey);
    hydraS1Prover1 = new HydraS1Prover(registryTree1, commitmentMapperPubKey);
    hydraS1Prover2 = new HydraS1Prover(registryTree2, commitmentMapperPubKey);
    hydraS1ProverAccountBound = new HydraS1ProverPrevious(
      registryTreeAccountBound,
      commitmentMapperPubKey
    );
    pythia1Prover = new Pythia1Prover();
  });

  /*************************************************************************************/
  /********************************** SETUP ********************************************/
  /*************************************************************************************/

  describe('Deployments, setup contracts and prepare test requests', () => {
    it('Should retrieve core contracts and update roots for attester', async () => {
      // Deploy Sismo Protocol Core contracts
      availableRootsRegistry = AvailableRootsRegistry__factory.connect(
        config.availableRootsRegistry.address,
        await impersonateAddress(hre, config.availableRootsRegistry.owner)
      ) as AvailableRootsRegistry;

      badges = Badges__factory.connect(
        config.badges.address,
        await impersonateAddress(hre, config.badges.owner)
      ) as Badges;

      front = Front__factory.connect(
        config.front.address,
        await impersonateAddress(hre, randomSigner.address, true)
      ) as Front;

      hydraS1SimpleAttester = HydraS1SimpleAttester__factory.connect(
        oldConfig.hydraS1SimpleAttester.address,
        await impersonateAddress(hre, randomSigner.address, true)
      ) as HydraS1SimpleAttester;

      hydraS1AccountboundAttester = HydraS1AccountboundAttester__factory.connect(
        oldConfig.hydraS1AccountboundAttester.address,
        await impersonateAddress(hre, randomSigner.address, true)
      );

      attestationsRegistry = AttestationsRegistry__factory.connect(
        config.attestationsRegistry.address,
        await impersonateAddress(hre, config.attestationsRegistry.owner)
      ) as AttestationsRegistry;

      pythia1SimpleAttester = Pythia1SimpleAttester__factory.connect(
        config.synapsPythia1SimpleAttester.address,
        await impersonateAddress(hre, config.synapsPythia1SimpleAttester.owner, true)
      ) as Pythia1SimpleAttester;

      commitmentMapperRegistry = CommitmentMapperRegistry__factory.connect(
        config.commitmentMapper.address,
        await impersonateAddress(hre, config.commitmentMapper.owner, true)
      ) as CommitmentMapperRegistry;

      await (
        await commitmentMapperRegistry.updateCommitmentMapperEdDSAPubKey(commitmentMapperPubKey, {
          gasLimit: 600000,
        })
      ).wait();

      await (
        await availableRootsRegistry.registerRootForAttester(
          hydraS1SimpleAttester.address,
          registryTree1.getRoot(),
          { gasLimit: 600000 }
        )
      ).wait();

      await (
        await availableRootsRegistry.registerRootForAttester(
          hydraS1AccountboundAttester.address,
          registryTreeAccountBound.getRoot(),
          { gasLimit: 600000 }
        )
      ).wait();

      earlyUserCollectionId = await front.EARLY_USER_COLLECTION();

      const pythiaOwner = await impersonateAddress(hre, await pythia1SimpleAttester.owner(), true);
      const commitmentSignerPubKey = await commitmentSigner.getPublicKey();

      await (
        await pythia1SimpleAttester
          .connect(pythiaOwner)
          .updateCommitmentSignerPubKey(commitmentSignerPubKey, { gasLimit: 600000 })
      ).wait();
    });
  });

  /*******************************************************************************************************/
  /************************ ATTESTATIONS AND BADGES GENERATIONS (BEFORE UPDATE) **************************/
  /*******************************************************************************************************/

  describe('Test attestations generations (before proxy update)', () => {
    it('Should prepare test requests', async () => {
      externalNullifier1 = await generateExternalNullifier(
        hydraS1SimpleAttester.address,
        group1.properties.groupIndex
      );

      externalNullifierAccountBound = await generateExternalNullifier(
        hydraS1AccountboundAttester.address,
        groupAccountBound.properties.groupIndex
      );

      request3 = {
        claims: [
          {
            groupId: group1.id,
            claimedValue: source3Value,
            extraData: encodeGroupProperties(group1.properties),
          },
        ],
        destination: BigNumber.from(destination1.identifier).toHexString(),
      };

      proofRequest3 = (
        await hydraS1ProverPrevious.generateSnarkProof({
          source: source3,
          destination: destination1,
          claimedValue: source3Value,
          chainId: chainId,
          accountsTree: accountsTree1,
          ticketIdentifier: externalNullifier1,
          isStrict: !group1.properties.isScore,
        })
      ).toBytes();

      request4 = {
        claims: [
          {
            groupId: groupAccountBound.id,
            claimedValue: source4Value,
            extraData: encodeHydraS1AccountboundGroupProperties(groupAccountBound.properties),
          },
        ],
        destination: BigNumber.from(destination1.identifier).toHexString(),
      };

      proofRequest4 = (
        await hydraS1ProverAccountBound.generateSnarkProof({
          source: source4,
          destination: destination1,
          claimedValue: source4Value,
          chainId: chainId,
          accountsTree: accountsTreeAccountBound,
          ticketIdentifier: externalNullifierAccountBound,
          isStrict: !groupAccountBound.properties.isScore,
        })
      ).toBytes();

      [attestationsRequested3, attestationsRequested4] = await front.batchBuildAttestations(
        [hydraS1SimpleAttester.address, hydraS1AccountboundAttester.address],
        [request3, request4],
        [proofRequest3, proofRequest4]
      );

      snapshotId = await evmSnapshot(hre);
    });

    it('Should generate attestations from hydra s1 simple and hydra s1 accountbound via batch', async () => {
      const tx = await front.batchGenerateAttestations(
        [hydraS1SimpleAttester.address, hydraS1AccountboundAttester.address],
        [request3, request4],
        [proofRequest3, proofRequest4],
        { gasLimit: 1200000 }
      );
      const { events } = await tx.wait();

      const attestationsValues = await attestationsRegistry.getAttestationValueBatch(
        [attestationsRequested3[0].collectionId, attestationsRequested4[0].collectionId],
        [request3.destination, request4.destination]
      );

      const expectedAttestationsValues = [
        attestationsRequested3[0].value,
        attestationsRequested4[0].value,
      ];

      expect(attestationsValues).to.be.eql(expectedAttestationsValues);

      const balances = await badges.balanceOfBatch(
        [request3.destination, request4.destination],
        [attestationsRequested3[0].collectionId, attestationsRequested4[0].collectionId]
      );

      const expectedBalances = expectedAttestationsValues;

      expect(balances).to.be.eql(expectedBalances);
    });

    it('Should reset contracts', async () => {
      await evmRevert(hre, snapshotId);

      const attestationsValues = await attestationsRegistry.getAttestationValueBatch(
        [attestationsRequested3[0].collectionId, attestationsRequested4[0].collectionId],
        [request3.destination, request4.destination]
      );

      const expectedAttestationsValues = [BigNumber.from(0), BigNumber.from(0)];

      expect(attestationsValues).to.be.eql(expectedAttestationsValues);

      const balances = await badges.balanceOfBatch(
        [request3.destination, request4.destination],
        [attestationsRequested3[0].collectionId, attestationsRequested4[0].collectionId]
      );

      const expectedBalances = expectedAttestationsValues;

      expect(balances).to.be.eql(expectedBalances);
    });
    it('Should generate attestations from hydra s1 simple and hydra s1 accountbound via front contract and two separate txs', async () => {
      const tx = await front.generateAttestations(
        hydraS1SimpleAttester.address,
        request3,
        proofRequest3,
        { gasLimit: 600000 }
      );
      await front.generateAttestations(
        hydraS1AccountboundAttester.address,
        request4,
        proofRequest4,
        {
          gasLimit: 600000,
        }
      );
      const { events } = await tx.wait();

      const attestationsValues = await attestationsRegistry.getAttestationValueBatch(
        [attestationsRequested3[0].collectionId, attestationsRequested4[0].collectionId],
        [request3.destination, request4.destination]
      );

      const expectedAttestationsValues = [
        attestationsRequested3[0].value,
        attestationsRequested4[0].value,
      ];

      expect(attestationsValues).to.be.eql(expectedAttestationsValues);

      const balances = await badges.balanceOfBatch(
        [request3.destination, request4.destination],
        [attestationsRequested3[0].collectionId, attestationsRequested4[0].collectionId]
      );

      const expectedBalances = expectedAttestationsValues;

      expect(balances).to.be.eql(expectedBalances);
    });

    it('Should revert because HydraS1SimpleAttester is not accountbound', async () => {
      // change destination in the request
      const request3bis = {
        ...request3,
        destination: BigNumber.from(destination2.identifier).toHexString(),
      };

      const proofRequest3bis = (
        await hydraS1Prover1.generateSnarkProof({
          source: source3,
          destination: destination2, // we change the destination also in the proof
          claimedValue: source3Value,
          chainId: chainId,
          accountsTree: accountsTree1,
          externalNullifier: externalNullifier1,
          isStrict: !group1.properties.isScore,
        })
      ).toBytes();

      await expect(
        front.generateAttestations(hydraS1SimpleAttester.address, request3bis, proofRequest3bis, {
          gasLimit: 800000,
        })
      ).to.be.reverted;
    });
  });

  /**********************************************************************************************/
  /********************************** PROXIES UPDATE ********************************************/
  /**********************************************************************************************/

  describe('Update Implementation', () => {
    it('Should run the upgrade script', async () => {
      // deploy new verifiers for hydraS1 and Pythia1 and upgrade attester proxies
      ({ hydraS1Verifier, hydraS1AccountboundAttester } = await hre.run(
        '3-new-hydra-s1-verifier-and-upgrade-accountbound-proxy',
        {
          options: { manualConfirm: false, log: false },
        }
      ));

      await (
        await availableRootsRegistry.registerRootForAttester(
          hydraS1AccountboundAttester.address,
          registryTree2.getRoot()
        )
      ).wait();

      snapshotId = await evmSnapshot(hre);
    });

    it('should test the Hydra-S1 AccountBound Attester contract address', async () => {
      // should be the same that the old hydraS1SimpleAttester
      expect(hydraS1AccountboundAttester.address).to.be.equal(
        oldConfig.hydraS1SimpleAttester.address
      );
    });

    it('should test the collectionIds of the Hydra S1 Accountbound attester', async () => {
      // should be the same that the old hydraS1SimpleAttester
      expect(await hydraS1AccountboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()).to.be.equal(
        await hydraS1SimpleAttester.AUTHORIZED_COLLECTION_ID_FIRST()
      );
      expect(await hydraS1AccountboundAttester.AUTHORIZED_COLLECTION_ID_LAST()).to.be.equal(
        await hydraS1SimpleAttester.AUTHORIZED_COLLECTION_ID_LAST()
      );
    });
  });

  describe('prepare test requests (group properties encoding has changed)', () => {
    it('Should prepare test requests', async () => {
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

      // change destination in the request
      request2 = {
        ...request1,
        destination: BigNumber.from(destination2.identifier).toHexString(),
      };

      proofRequest2 = (
        await hydraS1Prover1.generateSnarkProof({
          source: source1,
          destination: destination2, // we change the destination also in the proof
          claimedValue: source1Value,
          chainId: chainId,
          accountsTree: accountsTree1,
          externalNullifier: externalNullifier1,
          isStrict: !group1.properties.isScore,
        })
      ).toBytes();

      // same proofs and requests but with different destinations
      [attestationsRequested1, attestationsRequested2] = await front.batchBuildAttestations(
        [hydraS1AccountboundAttester.address, hydraS1AccountboundAttester.address],
        [request1, request2],
        [proofRequest1, proofRequest2]
      );
    });
  });

  /*************************************************************************************/
  /************************ATTESTATIONS AND BADGES GENERATIONS**************************/
  /*************************************************************************************/

  describe('Test attestations generations', () => {
    it('Should generate attestations hydra s1 accountbound via batch', async () => {
      const tx = await front.batchGenerateAttestations(
        [hydraS1AccountboundAttester.address],
        [request1],
        [proofRequest1],
        { gasLimit: 600000 }
      );

      const { events } = await tx.wait();

      const attestationsValues = await attestationsRegistry.getAttestationValueBatch(
        [attestationsRequested1[0].collectionId],
        [request1.destination]
      );

      const expectedAttestationsValues = [attestationsRequested1[0].value];

      expect(attestationsValues).to.be.eql(expectedAttestationsValues);

      const balances = await badges.balanceOfBatch(
        [request1.destination],
        [attestationsRequested1[0].collectionId]
      );

      const expectedBalances = expectedAttestationsValues;

      expect(balances).to.be.eql(expectedBalances);
    });

    it('Should reset contracts to the proxy updates', async () => {
      await evmRevert(hre, snapshotId);

      const attestationsValues = await attestationsRegistry.getAttestationValueBatch(
        [attestationsRequested1[0].collectionId],
        [request1.destination]
      );

      const expectedAttestationsValues = [BigNumber.from(7)];

      expect(attestationsValues).to.be.eql(expectedAttestationsValues);

      const balances = await badges.balanceOfBatch(
        [request1.destination],
        [attestationsRequested1[0].collectionId]
      );

      const expectedBalances = expectedAttestationsValues;

      expect(balances).to.be.eql(expectedBalances);
    });

    it('Should generate attestations from hydra s1 accountbound via front', async () => {
      const tx = await front.generateAttestations(
        hydraS1AccountboundAttester.address,
        request1,
        proofRequest1,
        { gasLimit: 800000 }
      );

      const { events } = await tx.wait();

      const attestationsValues = await attestationsRegistry.getAttestationValueBatch(
        [attestationsRequested1[0].collectionId],
        [request1.destination]
      );

      const expectedAttestationsValues = [attestationsRequested1[0].value];

      expect(attestationsValues).to.be.eql(expectedAttestationsValues);

      const balances = await badges.balanceOfBatch(
        [request1.destination],
        [attestationsRequested1[0].collectionId]
      );

      const expectedBalances = expectedAttestationsValues;

      expect(balances).to.be.eql(expectedBalances);
    });

    it('Should revert because no cooldown duration has been set for the groupId', async () => {
      await expect(
        front.generateAttestations(hydraS1AccountboundAttester.address, request2, proofRequest2, {
          gasLimit: 800000,
        })
      ).to.be.revertedWith(`CooldownDurationNotSetForGroupId(${BigNumber.from(group1.id)}`);
    });

    it('Should set the cooldown duration for the groupId', async () => {
      const cooldownDuration = 1; // 1 sec

      await hydraS1AccountboundAttester.setCooldownDurationForgroupId(
        BigNumber.from(group1.id),
        BigNumber.from(cooldownDuration)
      );

      expect(
        await hydraS1AccountboundAttester.getCooldownDurationForGroupId(BigNumber.from(group1.id))
      ).to.be.eql(cooldownDuration);
    });

    it('Should allow the minting of the attestation on another destination address (accountbound property)', async () => {
      const tx = await front.generateAttestations(
        hydraS1AccountboundAttester.address,
        request2,
        proofRequest2,
        { gasLimit: 800000 }
      );

      const attestationsValues = await attestationsRegistry.getAttestationValueBatch(
        [attestationsRequested1[0].collectionId, attestationsRequested2[0].collectionId],
        [request1.destination, request2.destination]
      );

      const expectedAttestationsValues = [
        BigNumber.from(0), // the attestation should be removed
        attestationsRequested2[0].value,
      ];

      expect(attestationsValues).to.be.eql(expectedAttestationsValues);

      const balances = await badges.balanceOfBatch(
        [request1.destination, request2.destination],
        [attestationsRequested1[0].collectionId, attestationsRequested2[0].collectionId]
      );

      const expectedBalances = expectedAttestationsValues;

      expect(balances).to.be.eql(expectedBalances);
    });
  });
});
