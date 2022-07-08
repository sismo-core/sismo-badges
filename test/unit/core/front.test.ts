import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import hre, { ethers } from 'hardhat';
import { AttestationsRegistry, Front, MockAttester } from 'types';
import { AttestationStruct, RequestStruct } from 'types/HydraS1SimpleAttester';
import { evmRevert, evmSnapshot, increaseTime } from '../../../test/utils';

type IssuerRange = {
  min: number;
  max: number;
};

type Requests = {
  first: RequestStruct;
  second: RequestStruct;
};

type Attestations = {
  first: AttestationStruct;
  second: AttestationStruct;
};

describe('Test Front contract', () => {
  let userDestination: SignerWithAddress;
  let secondUserDestination: SignerWithAddress;

  let front: Front;
  let attestationsRegistry: AttestationsRegistry;
  let mockAttester: MockAttester;

  let frontAuthorizedRange: IssuerRange;
  let mockAttesterAuthorizedRange: IssuerRange;
  let generationTimestamp: number;
  let requests: Requests;
  let attestations: Attestations;
  let earlyUserGeneratedAttesations: Attestations;

  before(async () => {
    [userDestination, secondUserDestination] = await ethers.getSigners();

    frontAuthorizedRange = {
      min: 0,
      max: 1,
    };

    mockAttesterAuthorizedRange = {
      min: 2,
      max: 3,
    };

    generationTimestamp = Math.floor(Date.now() / 1000);

    requests = {
      first: {
        claims: [
          {
            groupId: 0,
            claimedValue: 1,
            extraData: ethers.utils.defaultAbiCoder.encode(['uint32'], [generationTimestamp]),
          },
        ],
        destination: userDestination.address,
      },
      second: {
        claims: [
          {
            groupId: 1,
            claimedValue: 1,
            extraData: ethers.utils.defaultAbiCoder.encode(['uint32'], [generationTimestamp]),
          },
        ],
        destination: userDestination.address,
      },
    };
  });

  describe('Deployments', () => {
    it('Should deploy, setup and test the constructed values of the contract', async () => {
      ({
        front,
        mockAttester: mockAttester,
        attestationsRegistry,
      } = await hre.run('deploy-mock-attester-and-core', {
        uri: 'https://token_cdn.domain/',
        frontFirstCollectionId: frontAuthorizedRange.min.toString(),
        frontLastCollectionId: frontAuthorizedRange.max.toString(),
        collectionIdFirst: mockAttesterAuthorizedRange.min.toString(),
        collectionIdLast: mockAttesterAuthorizedRange.max.toString(),
        options: {
          behindProxy: false,
        },
      }));

      attestations = {
        first: {
          collectionId: mockAttesterAuthorizedRange.min,
          owner: userDestination.address,
          issuer: mockAttester.address,
          value: 1,
          timestamp: generationTimestamp,
          extraData: ethers.utils.toUtf8Bytes('Mock Attester v0'),
        },
        second: {
          collectionId: mockAttesterAuthorizedRange.max,
          owner: userDestination.address,
          issuer: mockAttester.address,
          value: 1,
          timestamp: generationTimestamp,
          extraData: ethers.utils.toUtf8Bytes('Mock Attester v0'),
        },
      };

      earlyUserGeneratedAttesations = {
        first: {
          collectionId: await front.EARLY_USER_COLLECTION(),
          owner: userDestination.address,
          issuer: front.address,
          value: 1,
          timestamp: 0,
          extraData: ethers.utils.toUtf8Bytes('With strong love from Sismo'),
        },
        second: {
          collectionId: await front.EARLY_USER_COLLECTION(),
          owner: userDestination.address,
          issuer: front.address,
          value: 1,
          timestamp: 0,
          extraData: ethers.utils.toUtf8Bytes('With strong love from Sismo'),
        },
      };
    });
  });

  describe('Generate attestations', () => {
    let evmPostOperationSnapshot;

    beforeEach(async () => {
      evmPostOperationSnapshot = await evmSnapshot(hre);
    });

    afterEach(async () => {
      evmRevert(hre, evmPostOperationSnapshot);
    });

    it('Should forward generateAttestations call to the attester', async () => {
      const generateAttestationsTransaction = await front.generateAttestations(
        mockAttester.address,
        requests.first,
        '0x'
      );

      await expect(generateAttestationsTransaction)
        .to.emit(attestationsRegistry, 'AttestationRecorded')
        .withArgs([
          BigNumber.from(attestations.first.collectionId),
          attestations.first.owner,
          attestations.first.issuer,
          BigNumber.from(attestations.first.value),
          attestations.first.timestamp,
          ethers.utils.hexlify(attestations.first.extraData),
        ]);

      expect(
        await attestationsRegistry.hasAttestation(
          await mockAttester.ATTESTATION_ID_MIN(),
          userDestination.address
        )
      ).to.be.true;

      expect(
        await attestationsRegistry.getAttestationData(
          await mockAttester.ATTESTATION_ID_MIN(),
          userDestination.address
        )
      ).to.eql([
        attestations.first.issuer,
        BigNumber.from(attestations.first.value),
        attestations.first.timestamp,
        ethers.utils.hexlify(attestations.first.extraData),
      ]);
    });
    it('Should not generate early user attestation if the date is > to Sept 15 2022', async () => {
      await increaseTime(hre, Date.parse('16 Sept 20222 00:00:00 GMT') - Date.now());

      const generateAttestationsTransaction = await front.generateAttestations(
        mockAttester.address,
        requests.first,
        '0x'
      );

      expect(generateAttestationsTransaction).to.not.emit(front, 'EarlyUserAttestationGenerated');

      expect(
        await attestationsRegistry.hasAttestation(
          await front.ATTESTATIONS_REGISTRY(),
          userDestination.address
        )
      ).to.be.false;
    });

    it('Should generate early user attestation if the date is < to Sept 15 2022', async () => {
      if (Date.now() > Date.parse('15 Sept 2022 00:00:00 GMT')) {
        return;
      }

      const generateAttestationsTransaction = await front.generateAttestations(
        mockAttester.address,
        requests.first,
        '0x'
      );

      earlyUserGeneratedAttesations.first.timestamp = await (
        await ethers.provider.getBlock('latest')
      ).timestamp;

      await expect(generateAttestationsTransaction)
        .to.emit(attestationsRegistry, 'AttestationRecorded')
        .withArgs([
          BigNumber.from(earlyUserGeneratedAttesations.first.collectionId),
          earlyUserGeneratedAttesations.first.owner,
          earlyUserGeneratedAttesations.first.issuer,
          BigNumber.from(earlyUserGeneratedAttesations.first.value),
          earlyUserGeneratedAttesations.first.timestamp,
          ethers.utils.hexlify(earlyUserGeneratedAttesations.first.extraData),
        ]);

      await expect(generateAttestationsTransaction)
        .to.emit(front, 'EarlyUserAttestationGenerated')
        .withArgs(earlyUserGeneratedAttesations.first.owner);

      expect(
        await attestationsRegistry.hasAttestation(
          await front.EARLY_USER_COLLECTION(),
          userDestination.address
        )
      ).to.be.true;

      expect(
        await attestationsRegistry.getAttestationData(
          await front.EARLY_USER_COLLECTION(),
          userDestination.address
        )
      ).to.eql([
        earlyUserGeneratedAttesations.first.issuer,
        BigNumber.from(earlyUserGeneratedAttesations.first.value),
        earlyUserGeneratedAttesations.first.timestamp,
        ethers.utils.hexlify(earlyUserGeneratedAttesations.first.extraData),
      ]);
    });
  });

  describe('Batch generate attestations', () => {
    let evmPostOperationSnapshot;

    beforeEach(async () => {
      evmPostOperationSnapshot = await evmSnapshot(hre);
    });

    afterEach(async () => {
      evmRevert(hre, evmPostOperationSnapshot);
    });

    it('Should revert when one address of the request destinations are not the same', async () => {
      await expect(
        front.batchGenerateAttestations(
          [mockAttester.address, mockAttester.address],
          [requests.first, { ...requests.second, destination: secondUserDestination.address }],
          ['0x', '0x']
        )
      ).to.be.revertedWith('DifferentRequestsDestinations()');
    });

    it('Should forward generationAttestations call to the attester', async () => {
      const generateAttestationsTransaction = await front.batchGenerateAttestations(
        [mockAttester.address, mockAttester.address],
        [requests.first, requests.second],
        ['0x', '0x']
      );

      await expect(generateAttestationsTransaction)
        .to.emit(attestationsRegistry, 'AttestationRecorded')
        .withArgs([
          BigNumber.from(attestations.first.collectionId),
          attestations.first.owner,
          attestations.first.issuer,
          BigNumber.from(attestations.first.value),
          attestations.first.timestamp,
          ethers.utils.hexlify(attestations.first.extraData),
        ]);

      await expect(generateAttestationsTransaction)
        .to.emit(attestationsRegistry, 'AttestationRecorded')
        .withArgs([
          BigNumber.from(attestations.second.collectionId),
          attestations.second.owner,
          attestations.second.issuer,
          BigNumber.from(attestations.second.value),
          attestations.second.timestamp,
          ethers.utils.hexlify(attestations.second.extraData),
        ]);

      expect(
        await attestationsRegistry.hasAttestation(
          await mockAttester.ATTESTATION_ID_MIN(),
          userDestination.address
        )
      ).to.be.true;

      expect(
        await attestationsRegistry.hasAttestation(
          await mockAttester.ATTESTATION_ID_MAX(),
          userDestination.address
        )
      ).to.be.true;

      expect(
        await attestationsRegistry.getAttestationData(
          await mockAttester.ATTESTATION_ID_MIN(),
          userDestination.address
        )
      ).to.eql([
        attestations.first.issuer,
        BigNumber.from(attestations.first.value),
        attestations.first.timestamp,
        ethers.utils.hexlify(attestations.first.extraData),
      ]);
    });

    it('Should not generate early user attestation if the date is > to Sept 15 2022', async () => {
      await increaseTime(hre, Date.parse('16 Sept 20222 00:00:00 GMT') - Date.now());

      const generateAttestationsTransaction = await front.batchGenerateAttestations(
        [mockAttester.address, mockAttester.address],
        [requests.first, requests.second],
        ['0x', '0x']
      );

      expect(generateAttestationsTransaction).to.not.emit(front, 'EarlyUserAttestationGenerated');

      expect(
        await attestationsRegistry.hasAttestation(
          await front.ATTESTATIONS_REGISTRY(),
          userDestination.address
        )
      ).to.be.false;
    });

    it('Should generate early user attestation if the date is < to Sept 15 2022', async () => {
      if (Date.now() > Date.parse('15 Sept 2022 00:00:00 GMT')) {
        return;
      }

      const batchGenerateAttestationsTransaction = await front.batchGenerateAttestations(
        [mockAttester.address, mockAttester.address],
        [requests.first, requests.second],
        ['0x', '0x']
      );

      earlyUserGeneratedAttesations.first.timestamp,
        (earlyUserGeneratedAttesations.second.timestamp = await (
          await ethers.provider.getBlock('latest')
        ).timestamp);

      await expect(batchGenerateAttestationsTransaction)
        .to.emit(attestationsRegistry, 'AttestationRecorded')
        .withArgs([
          BigNumber.from(earlyUserGeneratedAttesations.first.collectionId),
          earlyUserGeneratedAttesations.first.owner,
          earlyUserGeneratedAttesations.first.issuer,
          BigNumber.from(earlyUserGeneratedAttesations.first.value),
          earlyUserGeneratedAttesations.first.timestamp,
          ethers.utils.hexlify(earlyUserGeneratedAttesations.first.extraData),
        ]);

      await expect(batchGenerateAttestationsTransaction)
        .to.emit(attestationsRegistry, 'AttestationRecorded')
        .withArgs([
          BigNumber.from(earlyUserGeneratedAttesations.second.collectionId),
          earlyUserGeneratedAttesations.second.owner,
          earlyUserGeneratedAttesations.second.issuer,
          BigNumber.from(earlyUserGeneratedAttesations.second.value),
          earlyUserGeneratedAttesations.second.timestamp,
          ethers.utils.hexlify(earlyUserGeneratedAttesations.second.extraData),
        ]);

      await expect(batchGenerateAttestationsTransaction)
        .to.emit(front, 'EarlyUserAttestationGenerated')
        .withArgs(earlyUserGeneratedAttesations.first.owner);

      expect(
        await attestationsRegistry.hasAttestation(
          earlyUserGeneratedAttesations.first.collectionId,
          userDestination.address
        )
      ).to.be.true;

      expect(
        await attestationsRegistry.getAttestationData(
          earlyUserGeneratedAttesations.first.collectionId,
          userDestination.address
        )
      ).to.eql([
        earlyUserGeneratedAttesations.first.issuer,
        BigNumber.from(earlyUserGeneratedAttesations.first.value),
        earlyUserGeneratedAttesations.first.timestamp,
        ethers.utils.hexlify(earlyUserGeneratedAttesations.first.extraData),
      ]);

      expect(
        await attestationsRegistry.getAttestationData(
          earlyUserGeneratedAttesations.second.collectionId,
          userDestination.address
        )
      ).to.eql([
        earlyUserGeneratedAttesations.second.issuer,
        BigNumber.from(earlyUserGeneratedAttesations.second.value),
        earlyUserGeneratedAttesations.second.timestamp,
        ethers.utils.hexlify(earlyUserGeneratedAttesations.second.extraData),
      ]);
    });
  });

  describe('Build attestations', async () => {
    it('Should forward buildAttestations call to the attester', async () => {
      const buildAttestationsTransaction = await front.buildAttestations(
        mockAttester.address,
        requests.first,
        ethers.utils.toUtf8Bytes('')
      );

      expect(buildAttestationsTransaction).to.eql([
        [
          BigNumber.from(attestations.first.collectionId),
          attestations.first.owner,
          attestations.first.issuer,
          BigNumber.from(attestations.first.value),
          attestations.first.timestamp,
          ethers.utils.hexlify(attestations.first.extraData),
        ],
      ]);
    });
  });

  describe('Batch build attestations', async () => {
    it('Should forward buildAttestations to the attesters', async () => {
      const buildAttestationsTransaction = await front.batchBuildAttestations(
        [mockAttester.address, mockAttester.address],
        [requests.first, requests.second],
        ['0x', '0x']
      );

      expect(buildAttestationsTransaction).to.eql([
        [
          [
            BigNumber.from(attestations.first.collectionId),
            attestations.first.owner,
            attestations.first.issuer,
            BigNumber.from(attestations.first.value),
            attestations.first.timestamp,
            ethers.utils.hexlify(attestations.first.extraData),
          ],
        ],
        [
          [
            BigNumber.from(attestations.second.collectionId),
            attestations.second.owner,
            attestations.second.issuer,
            BigNumber.from(attestations.second.value),
            attestations.second.timestamp,
            ethers.utils.hexlify(attestations.second.extraData),
          ],
        ],
      ]);
    });
  });
});
