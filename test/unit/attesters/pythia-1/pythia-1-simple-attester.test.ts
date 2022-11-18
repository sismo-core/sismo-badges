import { expect } from 'chai';
import hre from 'hardhat';
import { AttestationsRegistry, Badges, Pythia1SimpleAttester } from 'types';
import { RequestStruct } from 'types/Attester';

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber } from 'ethers';
import { deploymentsConfig } from '../../../../tasks/deploy-tasks/deployments-config';
import { generateExternalNullifier } from '../../../utils';
import { getEventArgs } from '../../../utils/expectEvent';
import {
  CommitmentSignerTester,
  encodePythia1GroupProperties,
  generatePythia1Group,
  Pythia1Group,
} from '../../../utils/pythia-1';
import {
  DeployedPythia1SimpleAttester,
  DeployPythia1SimpleAttesterArgs,
} from '../../../../tasks/deploy-tasks/unit/attesters/pythia-1/deploy-pythia-1-simple-attester.task';
import { Pythia1Prover, SnarkProof, EddsaSignature, buildPoseidon } from '@sismo-core/pythia-1';

const collectionIdFirst = BigNumber.from(100);
const collectionIdLast = BigNumber.from(1000);

describe('Test pythia 1 standard attester contract, not strict', () => {
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

  before(async () => {
    const signers = await hre.ethers.getSigners();
    [deployer, destination1] = signers;
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

  describe('Deployments', () => {
    it('Should deploy and setup core', async () => {
      const { mockAttestationsRegistry } = await hre.run('deploy-mock-attestations-registry', {
        attestationValue: 1,
        options: {
          behindProxy: false,
        },
      });
      const commitmentSignerPubKey = await commitmentSigner.getPublicKey();
      ({ pythia1SimpleAttester } = (await hre.run('deploy-pythia-1-simple-attester', {
        attestationsRegistryAddress: mockAttestationsRegistry.address,
        commitmentSignerPubKeyX: commitmentSignerPubKey[0].toHexString(),
        commitmentSignerPubKeyY: commitmentSignerPubKey[1].toHexString(),
        collectionIdFirst: collectionIdFirst.toString(),
        collectionIdLast: collectionIdFirst.toString(),
      } as DeployPythia1SimpleAttesterArgs)) as DeployedPythia1SimpleAttester);
    });
  });

  /*************************************************************************************/
  /***************************** GENERATE VALID ATTESTATION ****************************/
  /*************************************************************************************/

  describe('Generate valid attestation', () => {
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
        externalNullifier: externalNullifier,
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
