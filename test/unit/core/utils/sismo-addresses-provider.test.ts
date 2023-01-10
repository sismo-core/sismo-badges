import { AvailableRootsRegistry } from './../../../../types/AvailableRootsRegistry';
import { CommitmentMapperRegistry } from './../../../../types/CommitmentMapperRegistry';
import { AddressesProvider } from '../../../../types/AddressesProvider';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import hre, { ethers } from 'hardhat';
import { Deployed0 } from 'tasks/deploy-tasks/full/0-deploy-core-and-hydra-s1-simple-and-accountbound-and-pythia1.task';
import {
  AttestationsRegistry,
  Badges,
  Front,
  HydraS1AccountboundAttester,
  TransparentUpgradeableProxy__factory,
} from '../../../../types';
import { HydraS1Verifier } from '@sismo-core/hydra-s1';
import { toUtf8Bytes } from 'ethers/lib/utils';
import { deploymentsConfig } from '../../../../tasks/deploy-tasks/deployments-config';
import { getImplementation } from '../../../../utils';
import { afterDeployment, beforeDeployment, customDeployContract } from 'tasks/deploy-tasks/utils';

const SismoContractsAddress = '0x3340Ac0CaFB3ae34dDD53dba0d7344C1Cf3EFE05';

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

  before(async () => {
    const signers = await hre.ethers.getSigners();
    [deployer, , proxyAdminSigner, , , , randomSigner] = signers;
    ({
      attestationsRegistry,
      badges,
      hydraS1AccountboundAttester,
      front,
      availableRootsRegistry,
      commitmentMapperRegistry,
      hydraS1Verifier,
    } = (await hre.run('0-deploy-core-and-hydra-s1-simple-and-accountbound-and-pythia1', {
      options: {
        proxyAdmin: proxyAdminSigner.address,
      },
    })) as Deployed0);
  });

  /*************************************************************************************/
  /********************************** DEPLOYMENTS **************************************/
  /*************************************************************************************/
  describe('Deployments', () => {
    it('Should deploy the Sismo Addresses Provider', async () => {
      ({ sismoAddressesProvider } = await hre.run('deploy-sismo-addresses-provider', {
        owner: deployer.address,
        badges: badges.address,
        attestationsRegistry: attestationsRegistry.address,
        front: front.address,
        hydraS1AccountboundAttester: hydraS1AccountboundAttester.address,
        commitmentMapperRegistry: commitmentMapperRegistry.address,
        availableRootsRegistry: availableRootsRegistry.address,
        hydraS1Verifier: hydraS1Verifier.address,
        options: {
          deploymentNamePrefix: 'firstDeployment',
        },
      }));
      expect(sismoAddressesProvider.address).to.be.eql(SismoContractsAddress);
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

  /*************************************************************************************/
  /******************************* UPDATE IMPLEMENTATION *******************************/
  /*************************************************************************************/
  describe('Update implementation', () => {
    it('Should update the implementation', async () => {
      const proxyAdminSigner = await ethers.getSigner(
        deploymentsConfig[hre.network.name].deployOptions.proxyAdmin as string
      );

      const CONTRACT_NAME = 'AddressesProvider';

      const deploymentArgs = [
        badges.address,
        attestationsRegistry.address,
        front.address,
        hydraS1AccountboundAttester.address,
        availableRootsRegistry.address,
        commitmentMapperRegistry.address,
        hydraS1Verifier.address,
        deployer.address,
      ];

      const newSismoAddressesProvider = await hre.deployments.deploy(CONTRACT_NAME, {
        contract: 'contracts/core/utils/AddressesProvider.sol:AddressesProvider',
        from: deployer.address,
        deterministicDeployment: false,
        // note proxyData is the encoded call (i.e initialize(params))
        args: deploymentArgs,
        log: true,
      });

      const AdressesProviderProxy = TransparentUpgradeableProxy__factory.connect(
        sismoAddressesProvider.address,
        proxyAdminSigner
      );

      await (await AdressesProviderProxy.upgradeTo(newSismoAddressesProvider.address)).wait();

      const implementationAddress = await getImplementation(AdressesProviderProxy);
      expect(implementationAddress).to.eql(newSismoAddressesProvider.address);
    });
  });
});
