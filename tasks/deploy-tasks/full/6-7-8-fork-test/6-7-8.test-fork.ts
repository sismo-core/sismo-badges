import { expect } from 'chai';
import hre from 'hardhat';
import {
  AddressesProvider,
  AttestationsRegistry,
  AttestationsRegistry__factory,
  AvailableRootsRegistry,
  AvailableRootsRegistry__factory,
  Badges,
  Badges__factory,
  CommitmentMapperRegistry,
  CommitmentMapperRegistry__factory,
  HydraS1AccountboundAttester,
  HydraS1AccountboundAttester__factory,
  Pythia1SimpleAttester,
  Pythia1SimpleAttester__factory,
  ZKBadgeboundERC721,
} from '../../../../types';
import { RequestStruct } from 'types/Attester';

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber } from 'ethers';
import {
  deploymentsConfig,
  SISMO_ADDRESSES_PROVIDER_CONTRACT_ADDRESS,
} from '../../deployments-config';
import {
  Pythia1Prover,
  SnarkProof,
  EddsaSignature,
  buildPoseidon,
  EddsaPublicKey,
} from '@sismo-core/pythia-1';
import {
  evmSnapshot,
  generateExternalNullifier,
  generateProvingData,
  getEventArgs,
  HydraS1SimpleGroup,
  HydraS1ZKPS,
  impersonateAddress,
} from '../../../../test/utils';
import {
  CommitmentSignerTester,
  Pythia1Group,
  generatePythia1Group,
  encodePythia1GroupProperties,
} from '../../../../test/utils/pythia-1';
import { Deployed7 } from 'tasks/deploy-tasks/full/7-upgrade-hydra-s1-accountbound-and-pythia-1-proxies.task';
import { Deployed6 } from 'tasks/deploy-tasks/full/6-deploy-sismo-addresses-provider.task';
import { HydraS1Account, KVMerkleTree } from '@sismo-core/hydra-s1';
import { registerRootForAttester, TestingHelper } from '../../../../test/utils/test-helpers';

const config = deploymentsConfig[process.env.FORK_NETWORK ?? hre.network.name];

const collectionIdFirst = BigNumber.from(config.synapsPythia1SimpleAttester.collectionIdFirst);
const collectionIdLast = BigNumber.from(config.synapsPythia1SimpleAttester.collectionIdLast);

// Launch with command
// FORK=true FORK_NETWORK=goerliStaging npx hardhat test ./tasks/deploy-tasks/full/6-7-8-fork-test/6-7-8.test-fork.ts

describe('FORK Test AddressesProvider and ZKBadgeboundERC7221', () => {
  let chainId: number;
  let poseidon;

  // contracts
  let pythia1SimpleAttester: Pythia1SimpleAttester;
  let hydraS1AccountboundAttester: HydraS1AccountboundAttester;
  let sismoAddressesProvider: AddressesProvider;
  let availableRootsRegistry: AvailableRootsRegistry;
  let commitmentMapperRegistry: CommitmentMapperRegistry;
  let zkBadgeboundERC721: ZKBadgeboundERC721;
  let attestationsRegistry: AttestationsRegistry;
  let badges: Badges;

  let provingScheme: HydraS1ZKPS;
  let accountsTreesWithData: { tree: KVMerkleTree; group: HydraS1SimpleGroup }[];
  let registryTree: KVMerkleTree;
  let groups: HydraS1SimpleGroup[];
  let commitmentMapperPubKey: EddsaPublicKey;

  let accountsSigners: SignerWithAddress[];
  let account1Signer: SignerWithAddress;
  let account2Signer: SignerWithAddress;

  let accounts: HydraS1Account[];
  let account1: HydraS1Account;
  let account2: HydraS1Account;

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

  let sismo: TestingHelper;

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

    /////////////////////////////////////////////
    // HYDRAS1 PROVING DATA SETUP
    /////////////////////////////////////////////

    // create two groups in the merkle tree with respectively all values of 1 and 2
    ({ accountsTreesWithData, registryTree, groups, accounts, commitmentMapperPubKey } =
      await generateProvingData({
        groupValues: [1, 2],
      }));

    accountsSigners = signers;

    deployer = accountsSigners[0];
    account1Signer = accountsSigners[1];
    account2Signer = accountsSigners[2];

    account1 = accounts[1];
    account2 = accounts[2];
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

      availableRootsRegistry = AvailableRootsRegistry__factory.connect(
        config.availableRootsRegistry.address,
        await impersonateAddress(hre, config.availableRootsRegistry.owner)
      ) as AvailableRootsRegistry;

      commitmentMapperRegistry = CommitmentMapperRegistry__factory.connect(
        config.commitmentMapper.address,
        await impersonateAddress(hre, config.commitmentMapper.owner)
      ) as CommitmentMapperRegistry;

      badges = Badges__factory.connect(
        config.badges.address,
        await impersonateAddress(hre, config.badges.owner)
      ) as Badges;

      hydraS1AccountboundAttester = HydraS1AccountboundAttester__factory.connect(
        config.hydraS1AccountboundAttester.address,
        await impersonateAddress(hre, config.hydraS1AccountboundAttester.owner)
      ) as HydraS1AccountboundAttester;

      pythia1SimpleAttester = Pythia1SimpleAttester__factory.connect(
        config.synapsPythia1SimpleAttester.address,
        await impersonateAddress(hre, config.synapsPythia1SimpleAttester.owner, true)
      ) as Pythia1SimpleAttester;

      await (
        await commitmentMapperRegistry.updateCommitmentMapperEdDSAPubKey(commitmentMapperPubKey, {
          gasLimit: 600000,
        })
      ).wait();

      const pythiaOwner = await impersonateAddress(hre, await pythia1SimpleAttester.owner(), true);
      const commitmentSignerPubKey = await commitmentSigner.getPublicKey();

      await (
        await pythia1SimpleAttester
          .connect(pythiaOwner)
          .updateCommitmentSignerPubKey(commitmentSignerPubKey, { gasLimit: 600000 })
      ).wait();

      //setup Proving Scheme
      provingScheme = new HydraS1ZKPS({
        accountsTreesWithData,
        registryTree,
        groups,
        defaultAttesterAddress: hydraS1AccountboundAttester.address,
        commitmentMapperPubKey,
        chainId,
      });

      sismo = new TestingHelper();
    });
  });

  describe('Update Implementation and deploy contracts', () => {
    it('should deploy the contracts', async () => {
      // deploy addresses provider
      ({ sismoAddressesProvider } = await hre.run('6-deploy-sismo-addresses-provider', {
        options: {
          manualConfirm: false,
          log: false,
        },
      })) as Deployed6;

      // deploy zkBadgeboundERC721
      ({ zkBadgeboundERC721 } = await hre.run('8-deploy-zk-badgebound-erc721', {
        options: {
          manualConfirm: false,
          log: false,
        },
      }));
    });

    it('Should run the upgrade script', async () => {
      await impersonateAddress(
        hre,
        config.deployOptions.proxyAdmin ?? config.synapsPythia1SimpleAttester.owner
      );

      ({ pythia1SimpleAttester, hydraS1AccountboundAttester } = await hre.run(
        '7-upgrade-hydra-s1-accountbound-and-pythia-1-proxies',
        {
          options: { manualConfirm: false, log: false },
        }
      )) as Deployed7;

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
    it('Should check the address of contracts and proxies', async () => {
      expect(sismoAddressesProvider.address).to.be.eql(SISMO_ADDRESSES_PROVIDER_CONTRACT_ADDRESS);
      expect(pythia1SimpleAttester.address).to.be.eql(config.synapsPythia1SimpleAttester.address);
      expect(hydraS1AccountboundAttester.address).to.be.eql(
        config.hydraS1AccountboundAttester.address
      );
    });

    it('Should have setup the owner correctly', async () => {
      expect(await pythia1SimpleAttester.owner()).to.be.eql(
        config.synapsPythia1SimpleAttester.owner
      );
      expect(await hydraS1AccountboundAttester.owner()).to.be.eql(
        config.hydraS1AccountboundAttester.owner
      );
    });

    it('Should get the owner correctly', async () => {
      expect(await pythia1SimpleAttester.owner()).to.be.eql(
        config.synapsPythia1SimpleAttester.owner
      );
      expect(await pythia1SimpleAttester.owner()).to.be.eql(
        config.synapsPythia1SimpleAttester.owner
      );
    });

    it('Should get the version correctly', async () => {
      expect(await pythia1SimpleAttester.IMPLEMENTATION_VERSION()).to.be.eql(4);
      expect(await hydraS1AccountboundAttester.IMPLEMENTATION_VERSION()).to.be.eql(5);
    });

    it('Should revert when trying to call initialize again', async () => {
      const commitmentSignerPubKey = await commitmentSigner.getPublicKey();
      await expect(
        pythia1SimpleAttester
          .connect(await impersonateAddress(hre, config.synapsPythia1SimpleAttester.owner))
          .initialize(commitmentSignerPubKey, randomSigner.address, { gasLimit: 600000 })
      ).to.be.revertedWith('Initializable: contract is already initialized');
      await expect(
        hydraS1AccountboundAttester
          .connect(await impersonateAddress(hre, config.hydraS1AccountboundAttester.owner))
          .initialize(randomSigner.address, { gasLimit: 600000 })
      ).to.be.revertedWith('Initializable: contract is already initialized');
    });
  });

  describe('Mint a NFT and a badge (after upgrade)', () => {
    it('Should mint a NFT', async () => {
      await registerRootForAttester(
        availableRootsRegistry,
        hydraS1AccountboundAttester,
        registryTree
      );

      const { request, proofData, inputs } = await provingScheme.generateProof({
        sources: [account1],
        destination: account2,
      });

      const generateAttestationsTransaction =
        await hydraS1AccountboundAttester.generateAttestations(request, proofData);

      await sismo.checkAttestationIsWellRegistered({
        request,
        nullifier: BigNumber.from(inputs.publicInputs.nullifier),
        accountAddress: account2Signer.address,
        tx: generateAttestationsTransaction,
      });

      await sismo.checkAccountHoldsBadge(account2Signer.address, BigNumber.from(10000002), true);

      expect(await zkBadgeboundERC721.balanceOf(account2Signer.address)).to.be.eql(
        BigNumber.from(0)
      );

      await zkBadgeboundERC721.connect(account2Signer).claim();

      expect(await zkBadgeboundERC721.balanceOf(account2Signer.address)).to.be.eql(
        BigNumber.from(1)
      );
    });

    it('Should revert because NFT has been already minted', async () => {
      await sismo.checkAccountHoldsBadge(account2Signer.address, BigNumber.from(10000002), true);

      expect(await zkBadgeboundERC721.balanceOf(account2Signer.address)).to.be.eql(
        BigNumber.from(1)
      );

      await expect(zkBadgeboundERC721.connect(account2Signer).claim()).to.be.revertedWith(
        'ERC721: token already minted'
      );
    });

    it('Should mint with a proof', async () => {
      const { request, proofData, inputs } = await provingScheme.generateProof({
        sources: [account2],
        destination: account1,
      });

      const mintNftTx = await zkBadgeboundERC721
        .connect(account2Signer)
        .claimWithSismo(request, proofData);
      await sismo.checkAttestationIsWellRegistered({
        request,
        nullifier: BigNumber.from(inputs.publicInputs.nullifier),
        accountAddress: account1Signer.address,
        tx: mintNftTx,
      });
    });
  });

  describe('Generate valid attestation for Pythia1SimpleAttester (after upgrade)', () => {
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
