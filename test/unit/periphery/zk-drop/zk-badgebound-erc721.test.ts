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
import { BigNumber, utils } from 'ethers';
import hre, { ethers } from 'hardhat';
import {
  AddressesProvider,
  AttestationsRegistry,
  AvailableRootsRegistry,
  Badges,
  CommitmentMapperRegistry,
  Front,
  HydraS1AccountboundAttester,
  HydraS1Verifier,
  ZKBadgeboundERC721,
} from '../../../../types';
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
  packRequestAndProofToBytes,
  generateProvingData,
  ProvingDataStruct,
  getValuesFromAccountsTrees,
  HydraS1ProofRequest,
  HydraS1ZKPS,
} from '../../../utils';
import { formatBytes32String } from 'ethers/lib/utils';
import { deploymentsConfig } from '../../../../tasks/deploy-tasks/deployments-config';

describe('Test ZK Badgebound ERC721 Contract', async () => {
  let attestationsRegistry: AttestationsRegistry;
  let hydraS1AccountboundAttester: HydraS1AccountboundAttester;
  let hydraS1Verifier: HydraS1Verifier;
  let commitmentMapperRegistry: CommitmentMapperRegistry;
  let availableRootsRegistry: AvailableRootsRegistry;
  let badges: Badges;
  let front: Front;
  let sismoAddressesProvider: AddressesProvider;
  let zkBadgeboundERC721: ZKBadgeboundERC721;

  let deployer: SignerWithAddress;
  let destinationSigner: SignerWithAddress;
  let destination2Signer: SignerWithAddress;
  let randomSigner: SignerWithAddress;

  let hydraS1Accounts: HydraS1Account[];

  let chainId: number;

  let sourceValue: BigNumber;
  let otherSourceValue: BigNumber;
  let sourceValue2: BigNumber;
  let accountsTree: KVMerkleTree;
  let accountsTree2: KVMerkleTree;
  let allAvailableGroups: GroupData[];
  let externalNullifier: BigNumber;
  let externalNullifier2: BigNumber;
  let cooldownDuration: number;
  let userParams;
  let userParams2;
  let inputs: Inputs;
  let inputs2: Inputs;
  let proof: SnarkProof;
  let proof2: SnarkProof;
  let request: RequestStruct;
  let request2: RequestStruct;

  let sourcesSigners: SignerWithAddress[];
  let destinationsSigners: SignerWithAddress[];

  let badgeId: BigNumber;
  let badgeId2: BigNumber;

  let provingData: ProvingDataStruct;
  let accountsTreesWithData: { tree: KVMerkleTree; group: HydraS1SimpleGroup }[];
  let registryTree: KVMerkleTree;
  let groups: HydraS1SimpleGroup[];
  let sources: HydraS1Account[];
  let sourcesValues: BigNumber[][] = [[]];
  let destinations: HydraS1Account[];
  let destinationsValues: BigNumber[][] = [[]];

  let source1: HydraS1Account;
  let source2: HydraS1Account;
  let source3: HydraS1Account;
  let source4: HydraS1Account;
  let source5: HydraS1Account;
  let destination1: HydraS1Account;
  let destination2: HydraS1Account;
  let destination3: HydraS1Account;
  let destination4: HydraS1Account;
  let destination5: HydraS1Account;

  let prover: HydraS1Prover;
  let commitmentMapper: CommitmentMapperTester;
  let commitmentMapperPubKey: EddsaPublicKey;

  let provingScheme: HydraS1ZKPS;

  let evmSnapshotId: string;

  const config = deploymentsConfig[hre.network.name];

  before(async () => {
    chainId = parseInt(await hre.getChainId());

    // create a first group groups[0] in the merkle tree with all values 1
    const firstProvingData = await generateProvingData({ groupValue: 1 });

    // create a second group groups[1] in the merkle tree with all values 0
    const secondProvingData = await generateProvingData({
      groups: firstProvingData.groups, // reuse all groups from the first proving data
      groupValue: 0,
    });

    // create a third groups[0] in the merkle tree with all values 42
    provingData = await generateProvingData({
      groups: secondProvingData.groups, // reuse all groups from the second proving data
      groupValue: 42,
    });

    accountsTreesWithData = provingData.accountsTreesWithData;
    registryTree = provingData.registryTree;
    groups = provingData.groups;

    sources = provingData.sources;
    destinations = provingData.destinations;

    const values = getValuesFromAccountsTrees(groups, accountsTreesWithData);
    sourcesValues = values.sourcesValues;

    provingScheme = new HydraS1ZKPS(provingData.commitmentMapperPubKey, chainId);

    cooldownDuration = 60 * 60 * 24;

    // data to reuse everywhere

    sourcesSigners = (await ethers.getSigners()).slice(0, 10);
    destinationsSigners = (await ethers.getSigners()).slice(10, 20);

    deployer = sourcesSigners[0];

    source1 = sources[1];
    source2 = sources[2];
    source3 = sources[3];
    source4 = sources[4];
    source5 = sources[5];

    destination1 = destinations[1];
    destination2 = destinations[2];
    destination3 = destinations[3];
    destination4 = destinations[4];
    destination5 = destinations[5];
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
        front,
        badges,
        commitmentMapperRegistry,
        availableRootsRegistry,
      } = await hre.run('0-deploy-core-and-hydra-s1-simple-and-accountbound-and-pythia1', {
        options: { deploymentNamePrefix: 'zk-badgebound-erc721' },
      }));

      const code = await hre.network.provider.send('eth_getCode', [
        config.sismoAddressesProvider.address,
      ]);

      if (code === '0x') {
        ({ sismoAddressesProvider } = await hre.run('deploy-sismo-addresses-provider', {
          owner: deployer.address,
          badges: badges.address,
          attestationsRegistry: attestationsRegistry.address,
          front: front.address,
          hydraS1AccountboundAttester: hydraS1AccountboundAttester.address,
          commitmentMapperRegistry: commitmentMapperRegistry.address,
          availableRootsRegistry: availableRootsRegistry.address,
          hydraS1Verifier: hydraS1Verifier.address,
        }));
      }

      const root = registryTree.getRoot();
      await availableRootsRegistry.registerRootForAttester(
        hydraS1AccountboundAttester.address,
        root
      );

      expect(await hydraS1AccountboundAttester.owner()).to.be.eql(deployer.address);

      ({ zkBadgeboundERC721 } = await hre.run('deploy-zk-badgebound-erc721', {}));

      badgeId = (await hydraS1AccountboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()).add(
        groups[0].properties.groupIndex
      );

      badgeId2 = (await hydraS1AccountboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()).add(
        groups[1].properties.groupIndex
      );

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

    it('Should generate a proof with Hydra S1 Prover and verify it onchain using the attester', async () => {
      const proofRequest: HydraS1ProofRequest = {
        sources: [source1],
        destination: destination1,
        value: BigNumber.from(1),
        group: groups[0],
        attesterAddress: hydraS1AccountboundAttester.address,
      };

      const { request, proofData, inputs } = await provingScheme.generateProof(proofRequest, {
        registryTree,
        accountsTreesWithData,
      });

      const generateAttestationsTransaction =
        await hydraS1AccountboundAttester.generateAttestations(request, proofData);

      const extraData = await attestationsRegistry.getAttestationExtraData(
        (
          await hydraS1AccountboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()
        ).add(proofRequest.group.properties.groupIndex),
        BigNumber.from(proofRequest.destination.identifier).toHexString()
      );

      // 0 - Checks that the transaction emitted the event
      await expect(generateAttestationsTransaction)
        .to.emit(hydraS1AccountboundAttester, 'AttestationGenerated')
        .withArgs([
          (
            await hydraS1AccountboundAttester.AUTHORIZED_COLLECTION_ID_FIRST()
          ).add(proofRequest.group.properties.groupIndex),
          request.destination,
          hydraS1AccountboundAttester.address,
          proofRequest.value,
          proofRequest.group.properties.generationTimestamp,
          extraData,
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
          ).add(proofRequest.group.properties.groupIndex),
          request.destination
        )
      ).to.be.true;
    });
  });
});
