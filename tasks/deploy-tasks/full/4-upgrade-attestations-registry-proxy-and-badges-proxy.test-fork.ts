import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import hre, { ethers } from 'hardhat';
import { getImplementation } from 'utils';
import { deploymentsConfig } from '../deployments-config';
import {
  AttestationsRegistry,
  AttestationsRegistry__factory,
  AvailableRootsRegistry,
  AvailableRootsRegistry__factory,
  Badges,
  HydraS1SimpleAttester__factory,
  TransparentUpgradeableProxy__factory,
} from '../../../types';
import { formatBytes32String, parseBytes32String } from 'ethers/lib/utils';
import { evmSnapshot, impersonateAddress } from '../../../test/utils';
import { BigNumber } from 'ethers';
import { HydraS1SimpleAttester } from 'types/HydraS1SimpleAttester';
import { AttestationStruct } from 'types/AttestationsRegistry';

// Launch with command
// FORK=true FORK_NETWORK=goerli npx hardhat test ./tasks/deploy-tasks/full/4-upgrade-attestations-registry-proxy-and-badges-proxy.test-fork.ts

describe('FORK-Test Upgrade AttestationsRegistry contract with attributes', () => {
  let deployer: SignerWithAddress;
  let randomSigner: SignerWithAddress;
  let secondDeployer: SignerWithAddress;
  let notOwner: SignerWithAddress;
  let issuer: SignerWithAddress;

  let attestationsRegistry: AttestationsRegistry;
  let availableRootsRegistry: AvailableRootsRegistry;
  let hydraS1SimpleAttester: HydraS1SimpleAttester;
  let badges: Badges;

  let firstAuthorizedRange: IssuerRange;
  let secondAuthorizedRange: IssuerRange;
  let attestations: Attestations;

  let snapshotId: string;

  type IssuerRange = {
    min: number;
    max: number;
  };

  type Attestations = {
    first: AttestationStruct;
    second: AttestationStruct;
  };

  const config = deploymentsConfig[process.env.FORK_NETWORK ?? hre.network.name];

  before(async () => {
    const signers = await ethers.getSigners();
    [deployer, secondDeployer, notOwner, issuer, , , randomSigner] = signers;

    firstAuthorizedRange = {
      min: 3,
      max: 6,
    };

    secondAuthorizedRange = {
      min: 9,
      max: 12,
    };

    attestations = {
      first: {
        collectionId: firstAuthorizedRange.min,
        owner: randomSigner.address,
        issuer: issuer.address,
        value: 1,
        timestamp: Math.floor(Date.now() / 1000),
        extraData: [],
      },
      second: {
        collectionId: secondAuthorizedRange.min,
        owner: randomSigner.address,
        issuer: issuer.address,
        value: 1,
        timestamp: Math.floor(Date.now() / 1000),
        extraData: [],
      },
    };
  });

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

      hydraS1SimpleAttester = HydraS1SimpleAttester__factory.connect(
        config.hydraS1SimpleAttester.address,
        await impersonateAddress(hre, randomSigner.address, true)
      ) as HydraS1SimpleAttester;
    });
  });

  describe('Should record attestation', async () => {
    it('Should authorize range for issuer', async () => {
      await attestationsRegistry
        .connect(await impersonateAddress(hre, config.attestationsRegistry.owner, true))
        .authorizeRanges(issuer.address, [firstAuthorizedRange, secondAuthorizedRange], {
          gasLimit: 600000,
        });
    });

    it('Should record the right data', async () => {
      const recordAttestationsTransaction = await attestationsRegistry
        .connect(await impersonateAddress(hre, issuer.address))
        .recordAttestations([attestations.first, attestations.second], { gasLimit: 600000 });

      // 1 - Checks that the transaction emitted the event
      await expect(recordAttestationsTransaction)
        .to.emit(attestationsRegistry, 'AttestationRecorded')
        .withArgs([
          BigNumber.from(attestations.first.collectionId),
          attestations.first.owner,
          attestations.first.issuer,
          BigNumber.from(attestations.first.value),
          attestations.first.timestamp,
          ethers.utils.hexlify(attestations.first.extraData),
        ]);

      await expect(recordAttestationsTransaction)
        .to.emit(attestationsRegistry, 'AttestationRecorded')
        .withArgs([
          BigNumber.from(attestations.second.collectionId),
          attestations.second.owner,
          attestations.second.issuer,
          BigNumber.from(attestations.second.value),
          attestations.second.timestamp,
          ethers.utils.hexlify(attestations.second.extraData),
        ]);
    });
  });

  describe('Get Attestation Data', () => {
    it('Should return the right data from the attestations registry contract', async () => {
      expect(
        await attestationsRegistry.getAttestationData(
          attestations.first.collectionId,
          randomSigner.address
        )
      ).to.be.eql([
        attestations.first.issuer,
        BigNumber.from(attestations.first.value),
        attestations.first.timestamp,
        ethers.utils.hexlify(attestations.first.extraData),
      ]);

      expect(
        await attestationsRegistry.getAttestationData(
          attestations.second.collectionId,
          randomSigner.address
        )
      ).to.be.eql([
        attestations.second.issuer,
        BigNumber.from(attestations.second.value),
        attestations.second.timestamp,
        ethers.utils.hexlify(attestations.second.extraData),
      ]);
    });
  });

  describe('Update Implementation', () => {
    it('Should run the upgrade script', async () => {
      await impersonateAddress(
        hre,
        config.deployOptions.proxyAdmin ?? config.attestationsRegistry.owner
      );

      ({ attestationsRegistry, badges } = await hre.run(
        '4-upgrade-attestations-registry-proxy-and-badges-proxy',
        {
          options: { manualConfirm: false, log: false },
        }
      ));

      snapshotId = await evmSnapshot(hre);
    });

    it('Should check the address of the proxy', async () => {
      expect(attestationsRegistry.address).to.be.eql(config.attestationsRegistry.address);
    });

    it('Should revert with Ownable error', async () => {
      expect(
        attestationsRegistry
          .connect(deployer)
          .createNewAttributes(
            [0, 1],
            [formatBytes32String('CURATED'), formatBytes32String('SYBIL_RESISTANCE')],
            { gasLimit: 50000 }
          )
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('Should create new attributes', async () => {
      const attributesCreated = await attestationsRegistry
        .connect(await impersonateAddress(hre, config.attestationsRegistry.owner, true))
        .createNewAttributes(
          [0, 1],
          [formatBytes32String('CURATED'), formatBytes32String('SYBIL RESISTANCE')],
          { gasLimit: 100000 }
        );

      await expect(attributesCreated)
        .to.emit(attestationsRegistry, 'NewAttributeCreated')
        .withArgs(0, formatBytes32String('CURATED'));

      await expect(attributesCreated)
        .to.emit(attestationsRegistry, 'NewAttributeCreated')
        .withArgs(1, formatBytes32String('SYBIL RESISTANCE'));
    });

    it('Should set new attributes to attestationsCollection 11 with values 1 and 15', async () => {
      const attributesSet = await attestationsRegistry
        .connect(await impersonateAddress(hre, config.attestationsRegistry.owner))
        .setAttributesValuesForAttestationsCollections(
          [attestations.first.collectionId, attestations.second.collectionId],
          [0, 1],
          [1, 15],
          {
            gasLimit: 100000,
          }
        );

      await expect(attributesSet)
        .to.emit(attestationsRegistry, 'AttestationsCollectionAttributeSet')
        .withArgs(attestations.first.collectionId, 0, 1);

      await expect(attributesSet)
        .to.emit(attestationsRegistry, 'AttestationsCollectionAttributeSet')
        .withArgs(attestations.second.collectionId, 1, 15);
      const res = await attestationsRegistry.getAttributesNamesAndValuesForAttestationsCollection(
        attestations.first.collectionId
      );
      expect([['CURATED'], [1]]).to.be.eql([[parseBytes32String(res[0][0])], res[1]]);
    });
  });

  describe('Verify Attestations Data (after proxy update)', () => {
    it('Should return the right data', async () => {
      expect(
        await attestationsRegistry.getAttestationData(
          attestations.first.collectionId,
          randomSigner.address
        )
      ).to.be.eql([
        attestations.first.issuer,
        BigNumber.from(attestations.first.value),
        attestations.first.timestamp,
        ethers.utils.hexlify(attestations.first.extraData),
      ]);

      expect(
        await attestationsRegistry.getAttestationData(
          attestations.second.collectionId,
          randomSigner.address
        )
      ).to.be.eql([
        attestations.second.issuer,
        BigNumber.from(attestations.second.value),
        attestations.second.timestamp,
        ethers.utils.hexlify(attestations.second.extraData),
      ]);
    });

    it('Should update the value when recording again attestations', async () => {
      const recordAttestationsTransaction = await attestationsRegistry
        .connect(await impersonateAddress(hre, issuer.address))
        .recordAttestations([
          {
            ...attestations.first,
            value: 2,
          },
          { ...attestations.second, value: 2 },
        ]);

      // 1 - Checks that the transaction emitted the event
      await expect(recordAttestationsTransaction)
        .to.emit(attestationsRegistry, 'AttestationRecorded')
        .withArgs([
          BigNumber.from(attestations.first.collectionId),
          attestations.first.owner,
          attestations.first.issuer,
          BigNumber.from(2),
          attestations.first.timestamp,
          ethers.utils.hexlify(attestations.first.extraData),
        ]);

      await expect(recordAttestationsTransaction)
        .to.emit(attestationsRegistry, 'AttestationRecorded')
        .withArgs([
          BigNumber.from(attestations.second.collectionId),
          attestations.second.owner,
          attestations.second.issuer,
          BigNumber.from(2),
          attestations.second.timestamp,
          ethers.utils.hexlify(attestations.second.extraData),
        ]);
    });

    it('Should return the right data from attestations registry contract', async () => {
      expect(
        await attestationsRegistry.getAttestationData(
          attestations.first.collectionId,
          randomSigner.address
        )
      ).to.be.eql([
        attestations.first.issuer,
        BigNumber.from(2),
        attestations.first.timestamp,
        ethers.utils.hexlify(attestations.first.extraData),
      ]);

      expect(
        await attestationsRegistry.getAttestationData(
          attestations.second.collectionId,
          randomSigner.address
        )
      ).to.be.eql([
        attestations.second.issuer,
        BigNumber.from(2),
        attestations.second.timestamp,
        ethers.utils.hexlify(attestations.second.extraData),
      ]);
    });

    it('Should return the right data from badges contract', async () => {
      expect(
        await badges.balanceOf(randomSigner.address, attestations.first.collectionId)
      ).to.be.eql(BigNumber.from(2));
      expect(
        await badges.getBadgeIssuer(randomSigner.address, attestations.first.collectionId)
      ).to.be.eql(attestations.first.issuer);

      expect(
        await badges.getBadgeTimestamp(randomSigner.address, attestations.first.collectionId)
      ).to.be.eql(attestations.first.timestamp);

      expect(
        await badges.getBadgeExtraData(randomSigner.address, attestations.first.collectionId)
      ).to.be.eql(ethers.utils.hexlify(attestations.first.extraData));

      expect(await badges.getAttributeValueForBadge(attestations.first.collectionId, 0)).to.be.eql(
        1
      );

      expect(await badges.getAttributeValueForBadge(attestations.second.collectionId, 1)).to.be.eql(
        15
      );
      const res = await badges.getAttributesNamesAndValuesForBadge(
        attestations.second.collectionId
      );
      expect([['SYBIL RESISTANCE'], [15]]).to.be.eql([[parseBytes32String(res[0][0])], res[1]]);
    });
  });
});
