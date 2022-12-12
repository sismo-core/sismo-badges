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
  AttestationsRegistry,
  AvailableRootsRegistry,
  Badges,
  CommitmentMapperRegistry,
  HydraS1AccountboundAttester,
  HydraS1Verifier,
  MockGatedERC721,
  ZkBadgeboundERC721,
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
  GroupData,
  generateAttesterGroups,
  HydraS1SimpleGroup,
  encodeGroupProperties,
  generateGroupIdFromProperties,
  packRequestAndProofToBytes,
  generateProvingData,
  GenerateRequestAndProofReturnType,
  generateRequestAndProof,
  ProvingDataStruct,
  getValuesFromAccountsTrees,
} from '../../../utils';
import { formatBytes32String } from 'ethers/lib/utils';

describe('Test ZK Badgebound ERC721 Contract', () => {
  let attestationsRegistry: AttestationsRegistry;
  let hydraS1AccountboundAttester: HydraS1AccountboundAttester;
  let hydraS1Verifier: HydraS1Verifier;
  let commitmentMapperRegistry: CommitmentMapperRegistry;
  let availableRootsRegistry: AvailableRootsRegistry;
  let badges: Badges;
  let zkBadgeboundERC721: ZkBadgeboundERC721;

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
  let accountsTrees: KVMerkleTree[];
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
  let destination1: HydraS1Account;
  let destination2: HydraS1Account;
  let destination3: HydraS1Account;
  let destination4: HydraS1Account;

  let prover: HydraS1Prover;
  let commitmentMapper: CommitmentMapperTester;
  let commitmentMapperPubKey: EddsaPublicKey;

  let evmSnapshotId: string;

  before(async () => {
    chainId = parseInt(await hre.getChainId());

    sourcesSigners = await (await ethers.getSigners()).slice(0, 10);
    destinationsSigners = await (await ethers.getSigners()).slice(10, 20);

    deployer = sourcesSigners[0];

    // create a first groups[0] in the merkle tree with all values 1
    const firstProvingData = await generateProvingData({ groupValue: 1 });

    // create a second groups[0] in the merkle tree with all values 0
    const secondProvingData = await generateProvingData({
      groups: firstProvingData.groups, // reuse all groups from the first proving data
      groupValue: 0,
    });

    // create a third groups[0] in the merkle tree with all values 42
    provingData = await generateProvingData({
      groups: secondProvingData.groups, // reuse all groups from the second proving data
      groupValue: 42,
    });

    accountsTrees = provingData.accountsTrees;
    registryTree = provingData.registryTree;
    groups = provingData.groups;
    sources = provingData.sources;
    destinations = provingData.destinations;

    const values = getValuesFromAccountsTrees(groups, accountsTrees);
    sourcesValues = values.sourcesValues;
    destinationsValues = values.destinationsValues;

    prover = new HydraS1Prover(provingData.registryTree, provingData.commitmentMapperPubKey);

    cooldownDuration = 60 * 60 * 24;

    // data to reuse everywhere

    source1 = sources[1];
    source2 = sources[2];
    source3 = sources[3];
    source4 = sources[4];

    destination1 = destinations[1];
    destination2 = destinations[2];
    destination3 = destinations[3];
    destination4 = destinations[4];

    sourceValue = sourcesValues[1][0];
    sourceValue2;
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
        badges,
        commitmentMapperRegistry,
        availableRootsRegistry,
      } = await hre.run('0-deploy-core-and-hydra-s1-simple-and-accountbound-and-pythia1', {
        options: { deploymentNamePrefix: 'zk-badgebound-erc721' },
      }));

      const root = registryTree.getRoot();
      await availableRootsRegistry.registerRootForAttester(
        hydraS1AccountboundAttester.address,
        root
      );

      expect(await hydraS1AccountboundAttester.owner()).to.be.eql(deployer.address);

      console.log('before');

      ({ zkBadgeboundERC721 } = await hre.run('deploy-zk-badgebound-erc721', {
        badgesLocalAddress: badges.address,
        hydraS1AccountboundLocalAddress: hydraS1AccountboundAttester.address,
      }));

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
  });
});
