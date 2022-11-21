import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BigNumber, BigNumberish, ContractTransaction } from 'ethers';
import hre, { ethers } from 'hardhat';
import { AttestationsRegistry, Front, MockAttester } from 'types';
import { AttestationStruct, RequestStruct } from 'types/HydraS1SimpleAttester';
import { evmRevert, evmSnapshot, increaseTime } from '../../../test/utils';

type IssuerRange = {
  first: number;
  last: number;
};

type Requests = {
  first: RequestStruct;
  second: RequestStruct;
};

type Attestations = {
  first: AttestationStruct;
  second: AttestationStruct;
};

type AttestationArray = [BigNumber, string, string, BigNumber, BigNumberish, string];

async function assertAttestationRecordedEventEmitted(
  transaction: ContractTransaction,
  attestationsRegistry: AttestationsRegistry,
  attesation: AttestationStruct
) {
  await expect(transaction)
    .to.emit(attestationsRegistry, 'AttestationRecorded')
    .withArgs([
      BigNumber.from(attesation.collectionId),
      attesation.owner,
      attesation.issuer,
      BigNumber.from(attesation.value),
      attesation.timestamp,
      ethers.utils.hexlify(attesation.extraData),
    ]);
}

async function assertAttestationDataIsValid(
  attestationsRegistry: AttestationsRegistry,
  attestation: AttestationStruct,
  destination: SignerWithAddress
) {
  expect(
    await attestationsRegistry.getAttestationData(attestation.collectionId, destination.address)
  ).to.eql([
    attestation.issuer,
    BigNumber.from(attestation.value),
    attestation.timestamp,
    ethers.utils.hexlify(attestation.extraData),
  ]);
}

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
  let attestationsArray: AttestationArray[][];
  let earlyUserGeneratedAttesation: AttestationStruct;

  before(async () => {
    [userDestination, secondUserDestination] = await ethers.getSigners();

    frontAuthorizedRange = {
      first: 0,
      last: 1,
    };

    mockAttesterAuthorizedRange = {
      first: 2,
      last: 3,
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

  /*************************************************************************************/
  /********************************** DEPLOYMENTS **************************************/
  /*************************************************************************************/
  describe('Deployments', () => {
    it('Should deploy, setup and test the constructed values of the contract', async () => {
      ({
        front,
        mockAttester: mockAttester,
        attestationsRegistry,
      } = await hre.run('deploy-mock-attester-and-core', {
        uri: 'https://token_cdn.domain/',
        frontFirstCollectionId: frontAuthorizedRange.first.toString(),
        frontLastCollectionId: frontAuthorizedRange.last.toString(),
        collectionIdFirst: mockAttesterAuthorizedRange.first.toString(),
        collectionIdLast: mockAttesterAuthorizedRange.last.toString(),
        options: {
          behindProxy: false,
        },
      }));

      attestations = {
        first: {
          collectionId: mockAttesterAuthorizedRange.first,
          owner: userDestination.address,
          issuer: mockAttester.address,
          value: 1,
          timestamp: generationTimestamp,
          extraData: ethers.utils.toUtf8Bytes('Mock Attester v0'),
        },
        second: {
          collectionId: mockAttesterAuthorizedRange.last,
          owner: userDestination.address,
          issuer: mockAttester.address,
          value: 1,
          timestamp: generationTimestamp,
          extraData: ethers.utils.toUtf8Bytes('Mock Attester v0'),
        },
      };

      earlyUserGeneratedAttesation = {
        collectionId: await front.EARLY_USER_COLLECTION(),
        owner: userDestination.address,
        issuer: front.address,
        value: 1,
        timestamp: 0,
        extraData: ethers.utils.toUtf8Bytes('With strong love from Sismo'),
      };

      attestationsArray = [
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
      ];
    });
  });

  /*************************************************************************************/
  /***************************** GENERATE ATTESTATIONS *********************************/
  /*************************************************************************************/
  describe('Generate attestations', () => {
    let evmPreOperationSnapshot;

    beforeEach(async () => {
      evmPreOperationSnapshot = await evmSnapshot(hre);
    });

    afterEach(async () => {
      evmRevert(hre, evmPreOperationSnapshot);
    });

    it('Should forward generateAttestations call to the attester', async () => {
      const generateAttestationsTransaction = await front.generateAttestations(
        mockAttester.address,
        requests.first,
        '0x'
      );

      // 1 - Checks that the transaction emitted the event
      await assertAttestationRecordedEventEmitted(
        generateAttestationsTransaction,
        attestationsRegistry,
        attestations.first
      );

      // 2 - Checks that forwarded attestations was recorded on the user
      expect(
        await attestationsRegistry.hasAttestation(
          await mockAttester.ATTESTATION_ID_MIN(),
          userDestination.address
        )
      ).to.be.true;

      await assertAttestationDataIsValid(attestationsRegistry, attestations.first, userDestination);
    });
    it('Should not generate early user attestation if the date is > to Sept 15 2022', async () => {
      if (Date.now() > Date.parse('15 Sept 2022 00:00:00 GMT')) {
        return;
      }
      await increaseTime(hre, Date.parse('16 Sept 20222 00:00:00 GMT') - Date.now());

      const generateAttestationsTransaction = await front.generateAttestations(
        mockAttester.address,
        requests.first,
        '0x'
      );

      // 1 - Checks that the transaction didn't emitted the event
      expect(generateAttestationsTransaction).to.not.emit(front, 'EarlyUserAttestationGenerated');

      // 2 - Checks that early user attestation was not recorded on the user
      expect(
        await attestationsRegistry.hasAttestation(
          await front.EARLY_USER_COLLECTION(),
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

      earlyUserGeneratedAttesation.timestamp = await (
        await ethers.provider.getBlock('latest')
      ).timestamp;

      // 1 - Checks that the transaction emitted the events
      await assertAttestationRecordedEventEmitted(
        generateAttestationsTransaction,
        attestationsRegistry,
        earlyUserGeneratedAttesation
      );

      await expect(generateAttestationsTransaction)
        .to.emit(front, 'EarlyUserAttestationGenerated')
        .withArgs(earlyUserGeneratedAttesation.owner);

      // 2 - Checks that early user attestation was recorded on the user
      expect(
        await attestationsRegistry.hasAttestation(
          await front.EARLY_USER_COLLECTION(),
          userDestination.address
        )
      ).to.be.true;

      await assertAttestationDataIsValid(
        attestationsRegistry,
        earlyUserGeneratedAttesation,
        userDestination
      );
    });

    it('Should return the builded attestations', async () => {
      expect(
        await front.callStatic.generateAttestations(mockAttester.address, requests.first, '0x')
      ).to.eql(attestationsArray[0]);

      expect(
        await front.callStatic.generateAttestations(mockAttester.address, requests.first, '0x')
      ).to.eql(
        await front.callStatic.buildAttestations(mockAttester.address, requests.first, '0x')
      );
    });
  });

  /*************************************************************************************/
  /************************** BATCH GENERATE ATTESTATIONS ******************************/
  /*************************************************************************************/
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

      // 1 - Checks that the transaction emitted the events
      await assertAttestationRecordedEventEmitted(
        generateAttestationsTransaction,
        attestationsRegistry,
        attestations.first
      );
      await assertAttestationRecordedEventEmitted(
        generateAttestationsTransaction,
        attestationsRegistry,
        attestations.second
      );

      // 2 - Checks that batch forwarded attestations was recorded on the user
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

      await assertAttestationDataIsValid(attestationsRegistry, attestations.first, userDestination);
      await assertAttestationDataIsValid(
        attestationsRegistry,
        attestations.second,
        userDestination
      );
    });

    it('Should not generate early user attestation if the date is > to Sept 15 2022', async () => {
      if (Date.now() < Date.parse('15 Sept 2022 00:00:00 GMT')) {
        await increaseTime(hre, Date.parse('15 Sept 20222 00:00:00 GMT') - Date.now());
      }

      const generateAttestationsTransaction = await front.batchGenerateAttestations(
        [mockAttester.address, mockAttester.address],
        [requests.first, requests.second],
        ['0x', '0x']
      );

      // 1 - Checks that the transaction didn't emitted the event
      expect(generateAttestationsTransaction).to.not.emit(front, 'EarlyUserAttestationGenerated');

      // 2 - Checks that early user attestation was not recorded on the user
      expect(
        await attestationsRegistry.hasAttestation(
          await front.EARLY_USER_COLLECTION(),
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

      earlyUserGeneratedAttesation.timestamp = await (
        await ethers.provider.getBlock('latest')
      ).timestamp;

      // 1 - Checks that the transaction emitted the events
      await assertAttestationRecordedEventEmitted(
        batchGenerateAttestationsTransaction,
        attestationsRegistry,
        earlyUserGeneratedAttesation
      );

      await expect(batchGenerateAttestationsTransaction)
        .to.emit(front, 'EarlyUserAttestationGenerated')
        .withArgs(userDestination.address);

      // 2 - Checks that early user attestation was recorded on the user
      expect(
        await attestationsRegistry.hasAttestation(
          await front.EARLY_USER_COLLECTION(),
          userDestination.address
        )
      ).to.be.true;

      await assertAttestationDataIsValid(
        attestationsRegistry,
        earlyUserGeneratedAttesation,
        userDestination
      );
    });

    it('Should return the batch builded attestations', async () => {
      expect(
        await front.callStatic.batchGenerateAttestations(
          [mockAttester.address, mockAttester.address],
          [requests.first, requests.second],
          ['0x', '0x']
        )
      ).to.eql(attestationsArray);

      expect(
        await front.callStatic.batchGenerateAttestations(
          [mockAttester.address, mockAttester.address],
          [requests.first, requests.second],
          ['0x', '0x']
        )
      ).to.eql(
        await front.callStatic.batchBuildAttestations(
          [mockAttester.address, mockAttester.address],
          [requests.first, requests.second],
          ['0x', '0x']
        )
      );
    });
  });

  /*************************************************************************************/
  /****************************** BUILD ATTESTATIONS ***********************************/
  /*************************************************************************************/
  describe('Build attestations', async () => {
    it('Should forward buildAttestations call to the attester', async () => {
      const buildAttestationsTransaction = await front.buildAttestations(
        mockAttester.address,
        requests.first,
        ethers.utils.toUtf8Bytes('')
      );

      expect(buildAttestationsTransaction).to.eql(attestationsArray[0]);
    });
  });

  /*************************************************************************************/
  /*************************** BATCH BUILD ATTESTATIONS ********************************/
  /*************************************************************************************/
  describe('Batch build attestations', async () => {
    it('Should forward buildAttestations to the attesters', async () => {
      const buildAttestationsTransaction = await front.batchBuildAttestations(
        [mockAttester.address, mockAttester.address],
        [requests.first, requests.second],
        ['0x', '0x']
      );

      expect(buildAttestationsTransaction).to.eql(attestationsArray);
    });
  });
});
