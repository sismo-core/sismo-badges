import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import hre, { ethers } from 'hardhat';
import { getImplementation } from 'utils';
import { deploymentsConfig } from '../deployments-config';
import {
  AttestationsRegistry,
  AttestationsRegistry__factory,
  Badges,
  TransparentUpgradeableProxy__factory,
} from '../../../types';
import { formatBytes32String, parseBytes32String } from 'ethers/lib/utils';
import { evmRevert, evmSnapshot, impersonateAddress } from '../../../test/utils';

// Launch with command
// FORK=true FORK_NETWORK=goerli npx hardhat test ./tasks/deploy-tasks/full/4-upgrade-attestations-registry-proxy.test-fork.ts

describe('FORK-Test Upgrade AttestationsRegistry contract with tags', () => {
  let deployer: SignerWithAddress;
  let secondDeployer: SignerWithAddress;
  let notOwner: SignerWithAddress;
  let issuer: SignerWithAddress;

  let attestationsRegistry: AttestationsRegistry;
  let secondAttestationsRegistry: AttestationsRegistry;
  let badges: Badges;

  let snapshotId: string;

  const config = deploymentsConfig[process.env.FORK_NETWORK ?? hre.network.name];

  before(async () => {
    const signers = await ethers.getSigners();
    const config = ([deployer, secondDeployer, notOwner, issuer] = signers);
  });

  describe('Setup fork', () => {
    it('Should retrieve attestationsRegistry contract', async () => {
      // Deploy Sismo Protocol Core contracts
      attestationsRegistry = AttestationsRegistry__factory.connect(
        config.attestationsRegistry.address,
        await impersonateAddress(hre, config.attestationsRegistry.owner)
      ) as AttestationsRegistry;
    });
  });

  describe('Update Implementation', () => {
    it('Should run the upgrade script', async () => {
      await impersonateAddress(
        hre,
        config.deployOptions.proxyAdmin ?? config.attestationsRegistry.owner
      );
      ({ attestationsRegistry } = await hre.run('4-upgrade-attestations-registry-proxy', {
        options: { manualConfirm: false, log: false },
      }));

      snapshotId = await evmSnapshot(hre);
    });

    it('Should check the address of the proxy', async () => {
      expect(attestationsRegistry.address).to.be.eql(config.attestationsRegistry.address);
    });

    it('Should revert with Ownable error', async () => {
      expect(
        attestationsRegistry
          .connect(deployer)
          .createNewTags(
            [0, 1],
            [formatBytes32String('CURATED'), formatBytes32String('SYBIL_RESISTANCE')],
            { gasLimit: 50000 }
          )
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('Should create new tags', async () => {
      const tagsCreated = await attestationsRegistry
        .connect(await impersonateAddress(hre, config.attestationsRegistry.owner, true))
        .createNewTags(
          [0, 1],
          [formatBytes32String('CURATED'), formatBytes32String('SYBIL RESISTANCE')],
          { gasLimit: 100000 }
        );

      await expect(tagsCreated)
        .to.emit(attestationsRegistry, 'NewTagCreated')
        .withArgs(0, formatBytes32String('CURATED'));

      await expect(tagsCreated)
        .to.emit(attestationsRegistry, 'NewTagCreated')
        .withArgs(1, formatBytes32String('SYBIL RESISTANCE'));
    });

    it('Should set new tags to attestationsCollection 11 with powers 1 and 15', async () => {
      const tagsSet = await attestationsRegistry
        .connect(await impersonateAddress(hre, config.attestationsRegistry.owner))
        .setTagsForAttestationsCollection([11, 11], [0, 1], [1, 15], { gasLimit: 100000 });

      await expect(tagsSet)
        .to.emit(attestationsRegistry, 'AttestationsCollectionTagSet')
        .withArgs(11, 0, 1);

      await expect(tagsSet)
        .to.emit(attestationsRegistry, 'AttestationsCollectionTagSet')
        .withArgs(11, 1, 15);
      const res = await attestationsRegistry.getTagsNamesAndPowersForAttestationsCollection(11);
      expect([
        ['CURATED', 'SYBIL RESISTANCE'],
        [1, 15],
      ]).to.be.eql([[parseBytes32String(res[0][0]), parseBytes32String(res[0][1])], res[1]]);
    });
  });
});
