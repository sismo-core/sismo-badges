import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import hre, { ethers } from 'hardhat';
import { AttestationsRegistry, Badges } from 'types';
import { AttestationStruct } from 'types/AttestationsRegistry';

type IssuerRange = {
  min: number;
  max: number;
};

type Attestations = {
  first: AttestationStruct;
  second: AttestationStruct;
};

describe('Test Attestations Registry contract', () => {
  let deployer: SignerWithAddress;
  let secondDeployer: SignerWithAddress;
  let user: SignerWithAddress;
  let issuer: SignerWithAddress;

  let attestationsRegistry: AttestationsRegistry;
  let secondAttestationsRegistry: AttestationsRegistry;
  let badges: Badges;

  let firstAuthorizedRange: IssuerRange;
  let secondAuthorizedRange: IssuerRange;
  let attestations: Attestations;

  before(async () => {
    const signers = await ethers.getSigners();

    [deployer, secondDeployer, user, issuer] = signers;

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
        owner: user.address,
        issuer: issuer.address,
        value: 1,
        timestamp: Math.floor(Date.now() / 1000),
        extraData: [],
      },
      second: {
        collectionId: secondAuthorizedRange.min,
        owner: user.address,
        issuer: issuer.address,
        value: 1,
        timestamp: Math.floor(Date.now() / 1000),
        extraData: [],
      },
    };
  });

  /*************************************************************************************/
  /********************************** DEPLOYMENTS **************************************/
  /*************************************************************************************/
  describe('Deployments', () => {
    it('Should deploy, setup and test the constructed values of the contract', async () => {
      ({ attestationsRegistry, badges } = await hre.run('deploy-core', {
        uri: 'https://token_cdn.domain/',
        badgeOwner: deployer.address,
        frontFirstCollectionId: '1',
        frontLastCollectionId: '2',
      }));

      ({ attestationsRegistry: secondAttestationsRegistry } = await hre.run(
        'deploy-attestations-registry',
        {
          badges: secondDeployer.address,
          owner: secondDeployer.address,
        }
      ));

      // 0 - Checks that the owner is set to the deployer address
      expect(await attestationsRegistry.owner()).to.equal(deployer.address);
      expect(await secondAttestationsRegistry.owner()).to.equal(secondDeployer.address);
    });
  });

  describe('Configuration checks', () => {
    it('Should have setup the owner correctly', async () => {
      expect(await attestationsRegistry.owner()).to.be.eql(deployer.address);
    });

    it('Should get the owner correctly', async () => {
      expect(await attestationsRegistry.owner()).to.be.eql(deployer.address);
    });

    it('Should revert when trying to call initialize again', async () => {
      await expect(
        attestationsRegistry.connect(deployer).initialize(deployer.address)
      ).to.be.revertedWith('Initializable: contract is already initialized');
    });
  });

  /*************************************************************************************/
  /****************************** RECORD ATTESTATIONS **********************************/
  /*************************************************************************************/
  describe('Record attestations', () => {
    it('Should revert when the contract is paused', async () => {
      await attestationsRegistry.pause();

      await expect(
        attestationsRegistry.recordAttestations([attestations.first])
      ).to.be.revertedWith('Pausable: paused');

      await attestationsRegistry.unpause();
    });

    it('Should revert when the attester is not authorized in one of the collectionIds provided', async () => {
      await expect(
        attestationsRegistry
          .connect(issuer)
          .recordAttestations([
            { ...attestations.first, collectionId: firstAuthorizedRange.min - 1 },
            attestations.second,
          ])
      ).to.be.revertedWith(
        `IssuerNotAuthorized("${issuer.address}", ${firstAuthorizedRange.min - 1})`
      );

      await attestationsRegistry.authorizeRange(
        issuer.address,
        firstAuthorizedRange.min,
        firstAuthorizedRange.max
      );

      await expect(
        attestationsRegistry
          .connect(issuer)
          .recordAttestations([
            attestations.first,
            { ...attestations.second, collectionId: secondAuthorizedRange.min - 1 },
          ])
      ).to.be.revertedWith(
        `IssuerNotAuthorized("${issuer.address}", ${secondAuthorizedRange.min - 1})`
      );
    });

    it('Should record attestations', async () => {
      await attestationsRegistry.authorizeRanges(issuer.address, [
        firstAuthorizedRange,
        secondAuthorizedRange,
      ]);

      const recordAttestationsTransaction = await attestationsRegistry
        .connect(issuer)
        .recordAttestations([attestations.first, attestations.second]);

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

      // 1.2 - Checks that the events related to the badges are emitted
      await expect(recordAttestationsTransaction)
        .to.emit(badges, 'TransferSingle')
        .withArgs(
          attestationsRegistry.address,
          ethers.constants.AddressZero,
          user.address,
          attestations.first.collectionId,
          attestations.first.value
        );

      await expect(recordAttestationsTransaction)
        .to.emit(badges, 'TransferSingle')
        .withArgs(
          attestationsRegistry.address,
          ethers.constants.AddressZero,
          user.address,
          attestations.second.collectionId,
          attestations.second.value
        );

      // 2 - Checks that the attestations was recorded on the right user
      expect(await attestationsRegistry.hasAttestation(firstAuthorizedRange.min, user.address)).to
        .be.true;
      expect(await attestationsRegistry.hasAttestation(secondAuthorizedRange.min, user.address)).to
        .be.true;
      // 2.2 - Checks that the user has received it's minted badge
      expect(await badges.balanceOf(user.address, attestations.first.collectionId)).to.equal(
        attestations.first.value
      );
      expect(await badges.balanceOf(user.address, attestations.second.collectionId)).to.equal(
        attestations.second.value
      );
    });

    it('Should update the value whe re recording attestations', async () => {
      await attestationsRegistry.authorizeRanges(issuer.address, [
        firstAuthorizedRange,
        secondAuthorizedRange,
      ]);

      const recordAttestationsTransaction = await attestationsRegistry
        .connect(issuer)
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

      // 1.2 - Checks that the events related to the badges are emitted
      await expect(recordAttestationsTransaction)
        .to.emit(badges, 'TransferSingle')
        .withArgs(
          attestationsRegistry.address,
          ethers.constants.AddressZero,
          user.address,
          attestations.first.collectionId,
          BigNumber.from(1)
        );

      await expect(recordAttestationsTransaction)
        .to.emit(badges, 'TransferSingle')
        .withArgs(
          attestationsRegistry.address,
          ethers.constants.AddressZero,
          user.address,
          attestations.second.collectionId,
          BigNumber.from(1)
        );

      // 2 - Checks that the attestations are still owned by the same user
      expect(await attestationsRegistry.hasAttestation(firstAuthorizedRange.min, user.address)).to
        .be.true;
      expect(await attestationsRegistry.hasAttestation(secondAuthorizedRange.min, user.address)).to
        .be.true;
      // 2.2 - Checks that the user has received it's the new minted badges
      expect(await badges.balanceOf(user.address, attestations.first.collectionId)).to.equal(2);
      expect(await badges.balanceOf(user.address, attestations.second.collectionId)).to.equal(2);

      // 3 - Checks that the value of the attestations are recorded
      expect(
        await attestationsRegistry.getAttestationValue(firstAuthorizedRange.min, user.address)
      ).to.be.equal(BigNumber.from(2));

      expect(
        await attestationsRegistry.getAttestationValue(secondAuthorizedRange.min, user.address)
      ).to.be.equal(BigNumber.from(2));
    });
  });

  /*************************************************************************************/
  /******************************* GET ATTESTATION DATA ********************************/
  /*************************************************************************************/
  describe('Get Attestation Data', () => {
    before(async () => {
      await attestationsRegistry
        .connect(issuer)
        .deleteAttestations(
          [attestations.first.owner, attestations.second.owner],
          [attestations.first.collectionId, attestations.second.collectionId]
        );
    });

    it('Should return the right data', async () => {
      await attestationsRegistry
        .connect(issuer)
        .recordAttestations([attestations.first, attestations.second]);

      expect(
        await attestationsRegistry.getAttestationData(attestations.first.collectionId, user.address)
      ).to.be.eql([
        attestations.first.issuer,
        BigNumber.from(attestations.first.value),
        attestations.first.timestamp,
        ethers.utils.hexlify(attestations.first.extraData),
      ]);

      expect(
        await attestationsRegistry.getAttestationData(
          attestations.second.collectionId,
          user.address
        )
      ).to.be.eql([
        attestations.second.issuer,
        BigNumber.from(attestations.second.value),
        attestations.second.timestamp,
        ethers.utils.hexlify(attestations.second.extraData),
      ]);
    });
  });

  /*************************************************************************************/
  /**************************** GET ATTESTATION DATA TUPLE *****************************/
  /*************************************************************************************/
  describe('Get Attestation Data Tuple', () => {
    before(async () => {
      await attestationsRegistry
        .connect(issuer)
        .deleteAttestations(
          [attestations.first.owner, attestations.second.owner],
          [attestations.first.collectionId, attestations.second.collectionId]
        );
    });

    it('Should return the right data', async () => {
      await attestationsRegistry
        .connect(issuer)
        .recordAttestations([attestations.first, attestations.second]);

      expect(
        await attestationsRegistry.getAttestationDataTuple(
          attestations.first.collectionId,
          user.address
        )
      ).to.be.eql([
        attestations.first.issuer,
        BigNumber.from(attestations.first.value),
        attestations.first.timestamp,
        ethers.utils.hexlify(attestations.first.extraData),
      ]);

      expect(
        await attestationsRegistry.getAttestationDataTuple(
          attestations.second.collectionId,
          user.address
        )
      ).to.be.eql([
        attestations.second.issuer,
        BigNumber.from(attestations.second.value),
        attestations.second.timestamp,
        ethers.utils.hexlify(attestations.second.extraData),
      ]);
    });
  });

  /*************************************************************************************/
  /**************************** GET ATTESTATION VALUE **********************************/
  /*************************************************************************************/
  describe('Get Attestation Value', () => {
    before(async () => {
      await attestationsRegistry
        .connect(issuer)
        .deleteAttestations(
          [attestations.first.owner, attestations.second.owner],
          [attestations.first.collectionId, attestations.second.collectionId]
        );
    });

    it('Should return the right data', async () => {
      await attestationsRegistry
        .connect(issuer)
        .recordAttestations([attestations.first, attestations.second]);

      expect(
        await attestationsRegistry.getAttestationValue(firstAuthorizedRange.min, user.address)
      ).to.be.equal(attestations.first.value);

      expect(
        await attestationsRegistry.getAttestationValue(secondAuthorizedRange.min, user.address)
      ).to.be.equal(attestations.second.value);
    });
  });

  /*************************************************************************************/
  /************************** GET ATTESTATION EXTRA DATA *******************************/
  /*************************************************************************************/
  describe('Get Attestation Extra Data', () => {
    before(async () => {
      await attestationsRegistry
        .connect(issuer)
        .deleteAttestations(
          [attestations.first.owner, attestations.second.owner],
          [attestations.first.collectionId, attestations.second.collectionId]
        );
    });

    it('Should return the right data', async () => {
      await attestationsRegistry
        .connect(issuer)
        .recordAttestations([attestations.first, attestations.second]);

      expect(
        await attestationsRegistry.getAttestationExtraData(firstAuthorizedRange.min, user.address)
      ).to.be.equal(ethers.utils.hexlify(attestations.first.extraData));

      expect(
        await attestationsRegistry.getAttestationExtraData(secondAuthorizedRange.min, user.address)
      ).to.be.equal(ethers.utils.hexlify(attestations.second.extraData));
    });
  });

  /*************************************************************************************/
  /**************************** GET ATTESTATION ISSUER *********************************/
  /*************************************************************************************/
  describe('Get Attestation Issuer', () => {
    before(async () => {
      await attestationsRegistry
        .connect(issuer)
        .deleteAttestations(
          [attestations.first.owner, attestations.second.owner],
          [attestations.first.collectionId, attestations.second.collectionId]
        );
    });

    it('Should return the right data', async () => {
      await attestationsRegistry
        .connect(issuer)
        .recordAttestations([attestations.first, attestations.second]);

      expect(
        await attestationsRegistry.getAttestationIssuer(firstAuthorizedRange.min, user.address)
      ).to.be.equal(attestations.first.issuer);

      expect(
        await attestationsRegistry.getAttestationIssuer(secondAuthorizedRange.min, user.address)
      ).to.be.equal(attestations.second.issuer);
    });
  });

  /*************************************************************************************/
  /*************************** GET ATTESTATION TIMESTAMP *******************************/
  /*************************************************************************************/
  describe('Get Attestation Timestamp', () => {
    before(async () => {
      await attestationsRegistry
        .connect(issuer)
        .deleteAttestations(
          [attestations.first.owner, attestations.second.owner],
          [attestations.first.collectionId, attestations.second.collectionId]
        );
    });

    it('Should return the right data', async () => {
      await attestationsRegistry
        .connect(issuer)
        .recordAttestations([attestations.first, attestations.second]);

      expect(
        await attestationsRegistry.getAttestationTimestamp(firstAuthorizedRange.min, user.address)
      ).to.be.equal(attestations.first.timestamp);

      expect(
        await attestationsRegistry.getAttestationTimestamp(secondAuthorizedRange.min, user.address)
      ).to.be.equal(attestations.second.timestamp);
    });
  });

  /*************************************************************************************/
  /**************************** GET ATTESTATION DATA BATCH *****************************/
  /*************************************************************************************/
  describe('Get Attestation Data Batch', () => {
    it('Should return the right data', async () => {
      expect(
        await attestationsRegistry.getAttestationDataBatch(
          [firstAuthorizedRange.min, secondAuthorizedRange.min],
          [user.address, user.address]
        )
      ).to.be.eql([
        [
          attestations.first.issuer,
          BigNumber.from(attestations.first.value),
          attestations.first.timestamp,
          ethers.utils.hexlify(attestations.first.extraData),
        ],
        [
          attestations.second.issuer,
          BigNumber.from(attestations.second.value),
          attestations.second.timestamp,
          ethers.utils.hexlify(attestations.second.extraData),
        ],
      ]);
    });
  });

  /*************************************************************************************/
  /**************************** GET ATTESTATION VALUE BATCH ****************************/
  /*************************************************************************************/
  describe('Get Attestation Value Batch', () => {
    it('Should return the right data', async () => {
      expect(
        await attestationsRegistry.getAttestationValueBatch(
          [firstAuthorizedRange.min, secondAuthorizedRange.min],
          [user.address, user.address]
        )
      ).to.be.eql([
        BigNumber.from(attestations.first.value),
        BigNumber.from(attestations.second.value),
      ]);
    });
  });

  /*************************************************************************************/
  /****************************** DELETE ATTESTATIONS **********************************/
  /*************************************************************************************/
  describe('Delete attestations', () => {
    it('Should revert when the contract is paused', async () => {
      await attestationsRegistry.pause();

      await expect(
        attestationsRegistry.deleteAttestations(
          [attestations.first.owner],
          [attestations.first.collectionId]
        )
      ).to.be.revertedWith('Pausable: paused');

      await attestationsRegistry.unpause();
    });

    it('Should revert when the attester is not authorized in one of the collectionIds provided', async () => {
      await attestationsRegistry.unauthorizeRanges(
        issuer.address,
        [firstAuthorizedRange, secondAuthorizedRange],
        [0, 1]
      );

      await expect(
        attestationsRegistry
          .connect(issuer)
          .deleteAttestations(
            [attestations.first.owner, attestations.second.owner],
            [firstAuthorizedRange.min - 1, attestations.second.collectionId]
          )
      ).to.be.revertedWith(
        `IssuerNotAuthorized("${issuer.address}", ${firstAuthorizedRange.min - 1})`
      );

      await attestationsRegistry.authorizeRange(
        issuer.address,
        firstAuthorizedRange.min,
        firstAuthorizedRange.max
      );

      await expect(
        attestationsRegistry
          .connect(issuer)
          .deleteAttestations(
            [attestations.first.owner, attestations.second.owner],
            [attestations.first.collectionId, secondAuthorizedRange.min - 1]
          )
      ).to.be.revertedWith(
        `IssuerNotAuthorized("${issuer.address}", ${secondAuthorizedRange.min - 1})`
      );
    });

    it('Should delete the attestations', async () => {
      await attestationsRegistry.authorizeRanges(issuer.address, [
        firstAuthorizedRange,
        secondAuthorizedRange,
      ]);

      const deleteAttestationsTransaction = await attestationsRegistry
        .connect(issuer)
        .deleteAttestations(
          [attestations.first.owner, attestations.second.owner],
          [attestations.first.collectionId, attestations.second.collectionId]
        );

      // 1 - Checks that the transaction emitted the event
      // 1.1 - Checks that the events related to the attestations registry are emitted
      await expect(deleteAttestationsTransaction)
        .to.emit(attestationsRegistry, 'AttestationDeleted')
        .withArgs([
          BigNumber.from(attestations.first.collectionId),
          attestations.first.owner,
          attestations.first.issuer,
          BigNumber.from(attestations.first.value),
          attestations.first.timestamp,
          ethers.utils.hexlify(attestations.first.extraData),
        ]);

      await expect(deleteAttestationsTransaction)
        .to.emit(attestationsRegistry, 'AttestationDeleted')
        .withArgs([
          BigNumber.from(attestations.second.collectionId),
          attestations.second.owner,
          attestations.second.issuer,
          BigNumber.from(attestations.second.value),
          attestations.second.timestamp,
          ethers.utils.hexlify(attestations.second.extraData),
        ]);

      // 1.2 - Checks that the events related to the badges are emitted
      await expect(deleteAttestationsTransaction)
        .to.emit(badges, 'TransferSingle')
        .withArgs(
          attestationsRegistry.address,
          user.address,
          ethers.constants.AddressZero,
          attestations.first.collectionId,
          attestations.first.value
        );

      await expect(deleteAttestationsTransaction)
        .to.emit(badges, 'TransferSingle')
        .withArgs(
          attestationsRegistry.address,
          user.address,
          ethers.constants.AddressZero,
          attestations.second.collectionId,
          attestations.second.value
        );

      // 2 - Checks that the attestations was deleted on the right user
      expect(await attestationsRegistry.hasAttestation(firstAuthorizedRange.min, user.address)).to
        .be.false;
      expect(await attestationsRegistry.hasAttestation(secondAuthorizedRange.min, user.address)).to
        .be.false;
      // 2.2 - Checks that the user has not anymore it's badges
      expect(await badges.balanceOf(user.address, attestations.first.collectionId)).to.equal(
        BigNumber.from(0)
      );
      expect(await badges.balanceOf(user.address, attestations.second.collectionId)).to.equal(
        BigNumber.from(0)
      );
    });
  });
});
