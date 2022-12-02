import { expect } from 'chai';
import hre from 'hardhat';
import {
  AttestationsRegistry,
  AttestationsRegistry__factory,
  AvailableRootsRegistry,
  AvailableRootsRegistry__factory,
  Badges,
  Badges__factory,
  HydraS1SimpleAttester,
  HydraS1SimpleAttester__factory,
  Pythia1SimpleAttester,
  Pythia1SimpleAttester__factory,
} from '../../../../types';
import { RequestStruct } from 'types/Attester';

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber, Signer } from 'ethers';
import { deploymentsConfig } from '../../deployments-config';
import {
  DeployedPythia1SimpleAttester,
  DeployPythia1SimpleAttesterArgs,
} from '../../unit/attesters/pythia-1/deploy-pythia-1-simple-attester.task';
import { Pythia1Prover, SnarkProof, EddsaSignature, buildPoseidon } from '@sismo-core/pythia-1';
import {
  evmSnapshot,
  generateExternalNullifier,
  getEventArgs,
  impersonateAddress,
} from '../../../../test/utils';
import {
  CommitmentSignerTester,
  Pythia1Group,
  generatePythia1Group,
  encodePythia1GroupProperties,
} from '../../../../test/utils/pythia-1';
import { Deployed5 } from 'tasks/deploy-tasks/full/5-upgrade-proxies-with-reinitializer.task';

const config = deploymentsConfig[process.env.FORK_NETWORK ?? hre.network.name];

const collectionIdFirst = BigNumber.from(config.synapsPythia1SimpleAttester.collectionIdFirst);
const collectionIdLast = BigNumber.from(config.synapsPythia1SimpleAttester.collectionIdLast);

describe('FORK Test Pythia', () => {
  let chainId: number;
  let poseidon;

  // contracts
  let pythia1SimpleAttester: Pythia1SimpleAttester;
  let attestationsRegistry: AttestationsRegistry;
  let badges: Badges;

  // pythia s1 prover
  let prover: Pythia1Prover;
  let commitmentSigner: CommitmentSignerTester;

  // Test Signers
  let deployer: SignerWithAddress;
  let destination1: SignerWithAddress;
  let randomSigner: SignerWithAddress;

  // Valid request and proof
  let request: RequestStruct;
  let proof: SnarkProof;
  let externalNullifier: BigNumber;

  // Data source test
  let secret: BigNumber;
  let commitment: BigNumber;
  let commitmentReceipt: EddsaSignature;
  let source1Value: BigNumber;
  let group1: Pythia1Group;

  let snapshotId: string;

  before(async () => {
    const signers = await hre.ethers.getSigners();
    [deployer, destination1, , , , , , , randomSigner] = signers;
    chainId = parseInt(await hre.getChainId());

    poseidon = await buildPoseidon();

    // 1 - Init commitment signer
    commitmentSigner = new CommitmentSignerTester();

    // 2 - Generate the group with its properties
    group1 = generatePythia1Group({
      internalCollectionId: 0,
      isScore: false,
    });

    // 3 - Get the commitmentReceipt by passing through the commitment signer
    secret = BigNumber.from('0x123');
    commitment = poseidon([secret]);
    source1Value = BigNumber.from('0x9');
    commitmentReceipt = await commitmentSigner.getCommitmentReceipt(
      commitment,
      source1Value,
      group1.id
    );

    // 4 - Init Proving scheme
    prover = new Pythia1Prover();
  });

  /*************************************************************************************/
  /********************************** DEPLOYMENTS **************************************/
  /*************************************************************************************/

  describe('Setup fork', () => {
    it('Should retrieve core contracts', async () => {
      // Deploy Sismo Protocol Core contracts
      attestationsRegistry = AttestationsRegistry__factory.connect(
        config.attestationsRegistry.address,
        await impersonateAddress(hre, config.attestationsRegistry.owner)
      ) as AttestationsRegistry;

      badges = Badges__factory.connect(
        config.badges.address,
        await impersonateAddress(hre, config.badges.owner)
      ) as Badges;

      pythia1SimpleAttester = Pythia1SimpleAttester__factory.connect(
        config.synapsPythia1SimpleAttester.address,
        await impersonateAddress(hre, config.synapsPythia1SimpleAttester.owner, true)
      ) as Pythia1SimpleAttester;

      const pythiaOwner = await impersonateAddress(hre, await pythia1SimpleAttester.owner(), true);
      const commitmentSignerPubKey = await commitmentSigner.getPublicKey();

      await (
        await pythia1SimpleAttester
          .connect(pythiaOwner)
          .updateCommitmentSignerPubKey(commitmentSignerPubKey, { gasLimit: 600000 })
      ).wait();
    });
  });

  /*************************************************************************************/
  /***************************** GENERATE VALID ATTESTATION ****************************/
  /*************************************************************************************/

  describe('Generate valid attestation (before upgrade)', () => {
    it('Should generate a proof with a pythia 1 prover and verify it onchain using the attester', async () => {
      externalNullifier = await generateExternalNullifier(
        pythia1SimpleAttester.address,
        group1.properties.internalCollectionId
      );

      request = {
        claims: [
          {
            groupId: group1.id,
            claimedValue: source1Value,
            extraData: encodePythia1GroupProperties(group1.properties),
          },
        ],
        destination: BigNumber.from(destination1.address).toHexString(),
      };

      proof = (await prover.generateSnarkProof({
        secret: secret,
        value: source1Value,
        commitmentReceipt: commitmentReceipt,
        commitmentSignerPubKey: await commitmentSigner.getPublicKey(),
        destinationIdentifier: destination1.address,
        claimedValue: source1Value,
        chainId: chainId,
        groupId: group1.id,
        ticketIdentifier: externalNullifier,
        isStrict: !group1.properties.isScore,
      })) as SnarkProof;

      const tx = await pythia1SimpleAttester
        .connect(destination1)
        .generateAttestations(request, await proof.toBytes());
      const { events } = await tx.wait();
      const args = getEventArgs(events, 'AttestationGenerated');
      expect(args.attestation.issuer).to.equal(pythia1SimpleAttester.address);
      expect(args.attestation.owner).to.equal(destination1.address);
      expect(args.attestation.collectionId).to.equal(
        collectionIdFirst.add(group1.properties.internalCollectionId)
      );
      expect(args.attestation.value).to.equal(source1Value);
      // expect(args.attestation.timestamp).to.equal(tx.timestamp);
    }).timeout(60000);
  });

  describe('Update Implementation', () => {
    it('Should run the upgrade script', async () => {
      await impersonateAddress(
        hre,
        config.deployOptions.proxyAdmin ?? config.synapsPythia1SimpleAttester.owner
      );

      ({ pythia1SimpleAttester } = await hre.run('5-upgrade-proxies-with-reinitializer', {
        options: { manualConfirm: false, log: false },
      })) as Deployed5;

      const pythiaOwner = await impersonateAddress(hre, await pythia1SimpleAttester.owner(), true);
      const commitmentSignerPubKey = await commitmentSigner.getPublicKey();

      await (
        await pythia1SimpleAttester
          .connect(pythiaOwner)
          .updateCommitmentSignerPubKey(commitmentSignerPubKey, { gasLimit: 600000 })
      ).wait();

      snapshotId = await evmSnapshot(hre);
    });
  });

  describe('Configuration checks', () => {
    it('Should check the address of the proxy', async () => {
      expect(pythia1SimpleAttester.address).to.be.eql(config.synapsPythia1SimpleAttester.address);
    });

    it('Should have setup the owner correctly', async () => {
      expect(await pythia1SimpleAttester.owner()).to.be.eql(
        config.synapsPythia1SimpleAttester.owner
      );
    });

    it('Should get the owner correctly', async () => {
      expect(await pythia1SimpleAttester.owner()).to.be.eql(
        config.synapsPythia1SimpleAttester.owner
      );
    });

    it('Should get the version correctly', async () => {
      expect(await pythia1SimpleAttester.VERSION()).to.be.eql(3);
    });

    it('Should revert when trying to call initialize again', async () => {
      const commitmentSignerPubKey = await commitmentSigner.getPublicKey();
      await expect(
        pythia1SimpleAttester
          .connect(await impersonateAddress(hre, config.synapsPythia1SimpleAttester.owner))
          .initialize(commitmentSignerPubKey, randomSigner.address, { gasLimit: 600000 })
      ).to.be.revertedWith('Initializable: contract is already initialized');
    });
  });

  describe('Generate valid attestation (after upgrade)', () => {
    it('Should generate a proof with a pythia 1 prover and verify it onchain using the attester', async () => {
      externalNullifier = await generateExternalNullifier(
        pythia1SimpleAttester.address,
        group1.properties.internalCollectionId
      );

      secret = BigNumber.from('0x1234'); // we changed the secret for the commitment
      commitment = poseidon([secret]);
      source1Value = BigNumber.from('0x9');
      commitmentReceipt = await commitmentSigner.getCommitmentReceipt(
        commitment,
        source1Value,
        group1.id
      );

      request = {
        claims: [
          {
            groupId: group1.id,
            claimedValue: source1Value,
            extraData: encodePythia1GroupProperties(group1.properties),
          },
        ],
        destination: BigNumber.from(destination1.address).toHexString(),
      };

      proof = (await prover.generateSnarkProof({
        secret: secret,
        value: source1Value,
        commitmentReceipt: commitmentReceipt,
        commitmentSignerPubKey: await commitmentSigner.getPublicKey(),
        destinationIdentifier: destination1.address,
        claimedValue: source1Value,
        chainId: chainId,
        groupId: group1.id,
        ticketIdentifier: externalNullifier,
        isStrict: !group1.properties.isScore,
      })) as SnarkProof;

      const tx = await pythia1SimpleAttester
        .connect(destination1)
        .generateAttestations(request, await proof.toBytes());
      const { events } = await tx.wait();
      const args = getEventArgs(events, 'AttestationGenerated');
      expect(args.attestation.issuer).to.equal(pythia1SimpleAttester.address);
      expect(args.attestation.owner).to.equal(destination1.address);
      expect(args.attestation.collectionId).to.equal(
        collectionIdFirst.add(group1.properties.internalCollectionId)
      );
      expect(args.attestation.value).to.equal(source1Value);
      // expect(args.attestation.timestamp).to.equal(tx.timestamp);
    }).timeout(60000);
  });
});
