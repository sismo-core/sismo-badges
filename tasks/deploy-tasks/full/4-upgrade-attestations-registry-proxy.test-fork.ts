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
import { formatBytes32String } from 'ethers/lib/utils';
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
        config.deployOptions.proxyAdmin ?? config.attestationsRegistry.address
      );
      ({ attestationsRegistry } = await hre.run('4-upgrade-attestations-registry-proxy', {
        options: { manualConfirm: false, log: false },
      }));

      snapshotId = await evmSnapshot(hre);
    });

    it('Should check the address of the proxy', async () => {
      expect(attestationsRegistry.address).to.be.eql(config.attestationsRegistry.address);
    });
  });
});
