import { AvailableRootsRegistry } from '../../../../types/AvailableRootsRegistry';
import { CommitmentMapperRegistry } from '../../../../types/CommitmentMapperRegistry';
import { AddressesProvider } from '../../../../types/AddressesProvider';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import hre, { ethers } from 'hardhat';
import {
  AttestationsRegistry,
  AttestationsRegistry__factory,
  AvailableRootsRegistry__factory,
  Badges,
  Badges__factory,
  CommitmentMapperRegistry__factory,
  Front,
  Front__factory,
  HydraS1AccountboundAttester,
  HydraS1AccountboundAttester__factory,
  HydraS1Verifier__factory,
} from '../../../../types';
import { HydraS1Verifier } from '@sismo-core/hydra-s1';
import { toUtf8Bytes } from 'ethers/lib/utils';
import { deploymentsConfig } from '../../deployments-config';
import { evmSnapshot, impersonateAddress } from '../../../../test/utils';
import { Deployed9 } from 'tasks/deploy-tasks/full/9-upgrade-addresses-provider-on-testnets.task';

const config = deploymentsConfig[process.env.FORK_NETWORK ?? hre.network.name];

const SismoContractsAddress = '0x3340Ac0CaFB3ae34dDD53dba0d7344C1Cf3EFE05';

// Launch with command
// FORK=true FORK_NETWORK=goerliTestnet npx hardhat test ./tasks/deploy-tasks/full/9-fork-test/9-upgrade-addresses-provider-on-testnets.test-fork.ts

describe('Test Sismo Addresses Provider', () => {
  let deployer: SignerWithAddress;
  let proxyAdminSigner: SignerWithAddress;
  let randomSigner: SignerWithAddress;

  let attestationsRegistry: AttestationsRegistry;
  let badges: Badges;
  let front: Front;
  let hydraS1AccountboundAttester: HydraS1AccountboundAttester;
  let commitmentMapperRegistry: CommitmentMapperRegistry;
  let availableRootsRegistry: AvailableRootsRegistry;
  let hydraS1Verifier: HydraS1Verifier;

  let sismoAddressesProvider: AddressesProvider;
  let newSismoAddressesProvider: AddressesProvider;

  let evmSnapshotId: string;

  before(async () => {
    const signers = await hre.ethers.getSigners();
    [deployer, , proxyAdminSigner, , , , randomSigner] = signers;
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

      hydraS1Verifier = HydraS1Verifier__factory.connect(
        config.hydraS1Verifier.address,
        await impersonateAddress(hre, config.hydraS1AccountboundAttester.owner)
      ) as HydraS1Verifier;

      front = Front__factory.connect(
        config.front.address,
        await impersonateAddress(hre, config.hydraS1AccountboundAttester.owner)
      ) as Front;
    });
  });

  describe('Update AddressesProvider implem', () => {
    it('Should run the upgrade script', async () => {
      let network: string;
      if (process.env.FORK_NETWORK === 'goerliTestnet') {
        network = 'goerliStaging';
      } else if (process.env.FORK_NETWORK === 'mumbaiTestnet') {
        network = 'mumbaiStaging';
      } else {
        throw new Error('Invalid network');
      }

      const proxyAdmin = await impersonateAddress(
        hre,
        deploymentsConfig[network].deployOptions.proxyAdmin ?? config.sismoAddressesProvider.owner
      );

      ({ sismoAddressesProvider } = await hre.run('9-upgrade-addresses-provider-on-testnets', {
        options: { manualConfirm: false, log: false },
      })) as Deployed9;

      const owner = await impersonateAddress(
        hre,
        deploymentsConfig[network].sismoAddressesProvider.owner
      );

      await hre.run('set-batch', {
        signer: owner,
        contractAddressesAsString: `${config.badges.address},${config.attestationsRegistry.address},${config.front.address},${config.hydraS1AccountboundAttester.address},${config.availableRootsRegistry.address},${config.commitmentMapper.address},${config.hydraS1Verifier.address}`,
        contractNamesAsString: `Badges,AttestationsRegistry,Front,HydraS1AccountboundAttester,AvailableRootsRegistry,CommitmentMapperRegistry,HydraS1Verifier`,
      });

      evmSnapshotId = await evmSnapshot(hre);
    });

    it('should have correct contracts as immutables', async () => {
      expect(await sismoAddressesProvider.BADGES()).to.be.equal(config.badges.address);
      expect(await sismoAddressesProvider.ATTESTATIONS_REGISTRY()).to.be.equal(
        config.attestationsRegistry.address
      );
      expect(await sismoAddressesProvider.FRONT()).to.be.equal(config.front.address);
      expect(await sismoAddressesProvider.HYDRA_S1_ACCOUNTBOUND_ATTESTER()).to.be.equal(
        config.hydraS1AccountboundAttester.address
      );
      expect(await sismoAddressesProvider.COMMITMENT_MAPPER_REGISTRY()).to.be.equal(
        config.commitmentMapper.address
      );
      expect(await sismoAddressesProvider.AVAILABLE_ROOTS_REGISTRY()).to.be.equal(
        config.availableRootsRegistry.address
      );
      expect(await sismoAddressesProvider.HYDRA_S1_VERIFIER()).to.be.equal(
        config.hydraS1Verifier.address
      );
    });
  });

  describe('Getters', () => {
    it('Should get the sismo contracts addresses via get (string)', async () => {
      const badgesAddress = await sismoAddressesProvider['get(string)']('Badges');
      const attestationsRegistryAddress = await sismoAddressesProvider['get(string)'](
        'AttestationsRegistry'
      );
      const frontAddress = await sismoAddressesProvider['get(string)']('Front');
      const hydraS1AccountboundAttesterAddress = await sismoAddressesProvider['get(string)'](
        'HydraS1AccountboundAttester'
      );
      const commitmentMapperRegistryAddress = await sismoAddressesProvider['get(string)'](
        'CommitmentMapperRegistry'
      );
      const availableRootsRegistryAddress = await sismoAddressesProvider['get(string)'](
        'AvailableRootsRegistry'
      );
      const hydraS1VerifierAddress = await sismoAddressesProvider['get(string)']('HydraS1Verifier');

      expect(badgesAddress).to.be.eql(badges.address);
      expect(attestationsRegistryAddress).to.be.eql(attestationsRegistry.address);
      expect(frontAddress).to.be.eql(front.address);
      expect(hydraS1AccountboundAttesterAddress).to.be.eql(hydraS1AccountboundAttester.address);
      expect(commitmentMapperRegistryAddress).to.be.eql(commitmentMapperRegistry.address);
      expect(availableRootsRegistryAddress).to.be.eql(availableRootsRegistry.address);
      expect(hydraS1VerifierAddress).to.be.eql(hydraS1Verifier.address);
    });

    it('Should get the sismo contracts addresses via get (bytes)', async () => {
      const badgesAddress = await sismoAddressesProvider['get(bytes32)'](
        ethers.utils.keccak256(toUtf8Bytes('Badges'))
      );
      const attestationsRegistryAddress = await sismoAddressesProvider['get(bytes32)'](
        ethers.utils.keccak256(toUtf8Bytes('AttestationsRegistry'))
      );
      const frontAddress = await sismoAddressesProvider['get(bytes32)'](
        ethers.utils.keccak256(toUtf8Bytes('Front'))
      );
      const hydraS1AccountboundAttesterAddress = await sismoAddressesProvider['get(bytes32)'](
        ethers.utils.keccak256(toUtf8Bytes('HydraS1AccountboundAttester'))
      );
      const commitmentMapperRegistryAddress = await sismoAddressesProvider['get(bytes32)'](
        ethers.utils.keccak256(toUtf8Bytes('CommitmentMapperRegistry'))
      );
      const availableRootsRegistryAddress = await sismoAddressesProvider['get(bytes32)'](
        ethers.utils.keccak256(toUtf8Bytes('AvailableRootsRegistry'))
      );
      const hydraS1VerifierAddress = await sismoAddressesProvider['get(bytes32)'](
        ethers.utils.keccak256(toUtf8Bytes('HydraS1Verifier'))
      );

      expect(badgesAddress).to.be.eql(badges.address);
      expect(attestationsRegistryAddress).to.be.eql(attestationsRegistry.address);
      expect(frontAddress).to.be.eql(front.address);
      expect(hydraS1AccountboundAttesterAddress).to.be.eql(hydraS1AccountboundAttester.address);
      expect(commitmentMapperRegistryAddress).to.be.eql(commitmentMapperRegistry.address);
      expect(availableRootsRegistryAddress).to.be.eql(availableRootsRegistry.address);
      expect(hydraS1VerifierAddress).to.be.eql(hydraS1Verifier.address);
    });

    it('Should get the sismo contracts addresses via getAll', async () => {
      const allContractInfos = await sismoAddressesProvider.getAll();
      const [allNames, allNamesHash, allAddresses] = allContractInfos;

      expect(allNames).to.be.eql([
        'Badges',
        'AttestationsRegistry',
        'Front',
        'HydraS1AccountboundAttester',
        'AvailableRootsRegistry',
        'CommitmentMapperRegistry',
        'HydraS1Verifier',
      ]);

      expect(allNamesHash).to.be.eql([
        ethers.utils.keccak256(toUtf8Bytes('Badges')),
        ethers.utils.keccak256(toUtf8Bytes('AttestationsRegistry')),
        ethers.utils.keccak256(toUtf8Bytes('Front')),
        ethers.utils.keccak256(toUtf8Bytes('HydraS1AccountboundAttester')),
        ethers.utils.keccak256(toUtf8Bytes('AvailableRootsRegistry')),
        ethers.utils.keccak256(toUtf8Bytes('CommitmentMapperRegistry')),
        ethers.utils.keccak256(toUtf8Bytes('HydraS1Verifier')),
      ]);

      expect(allAddresses).to.be.eql([
        badges.address,
        attestationsRegistry.address,
        front.address,
        hydraS1AccountboundAttester.address,
        availableRootsRegistry.address,
        commitmentMapperRegistry.address,
        hydraS1Verifier.address,
      ]);
    });

    it('Should get specific sismo contracts addresses via getBatch (string)', async () => {
      const contractAddresses = await sismoAddressesProvider['getBatch(string[])']([
        'Badges',
        'AttestationsRegistry',
      ]);
      expect(contractAddresses).to.be.eql([badges.address, attestationsRegistry.address]);
    });

    it('Should get specific sismo contracts addresses via getBatch (bytes32)', async () => {
      const contractAddresses = await sismoAddressesProvider['getBatch(bytes32[])']([
        ethers.utils.keccak256(toUtf8Bytes('Badges')),
        ethers.utils.keccak256(toUtf8Bytes('AttestationsRegistry')),
      ]);
      expect(contractAddresses).to.be.eql([badges.address, attestationsRegistry.address]);
    });
  });

  describe('Setters', () => {
    it('Should set a contract address', async () => {
      const newBadgesAddress = '0x0000000000000000000000000000000000000001';
      const setTx = await sismoAddressesProvider.set(newBadgesAddress, 'newBadgesContract');

      await expect(setTx)
        .emit(sismoAddressesProvider, 'ContractAddressSet')
        .withArgs(newBadgesAddress, 'newBadgesContract');

      const newBadgesContract = await sismoAddressesProvider['get(string)']('newBadgesContract');
      expect(newBadgesContract).to.be.eql(newBadgesAddress);
    });

    it('Should revert if caller is not owner', async () => {
      const newBadgesAddress = '0x0000000000000000000000000000000000000001';
      await expect(
        sismoAddressesProvider.connect(randomSigner).set(newBadgesAddress, 'newBadgesContract')
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('Should set several contract addresses via setBatch', async () => {
      const newBadgesAddress = '0x0000000000000000000000000000000000000001';
      const newAttestationsRegistryAddress = '0x0000000000000000000000000000000000000002';

      const setBatchTx = await sismoAddressesProvider.setBatch(
        [newBadgesAddress, newAttestationsRegistryAddress],
        ['newBadgesContract', 'newAttestationsRegistryContract']
      );

      await expect(setBatchTx)
        .emit(sismoAddressesProvider, 'ContractAddressSet')
        .withArgs(newBadgesAddress, 'newBadgesContract');

      await expect(setBatchTx)
        .emit(sismoAddressesProvider, 'ContractAddressSet')
        .withArgs(newAttestationsRegistryAddress, 'newAttestationsRegistryContract');

      const newBadgesContract = await sismoAddressesProvider['get(string)']('newBadgesContract');
      expect(newBadgesContract).to.be.eql(newBadgesAddress);

      const newAttestationsRegistryContract = await sismoAddressesProvider['get(string)'](
        'newAttestationsRegistryContract'
      );
      expect(newAttestationsRegistryContract).to.be.eql(newAttestationsRegistryAddress);
    });
  });
});
