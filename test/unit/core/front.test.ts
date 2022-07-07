import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import hre, { ethers } from 'hardhat';
import { AttestationsRegistry, Front, MockAttester } from 'types';
import { evmRevert, evmSnapshot, increaseTime } from '../../utils';

describe('Test Front contract', () => {
  let deployer: SignerWithAddress;
  let secondDeployer: SignerWithAddress;
  let userDestination: SignerWithAddress;

  let front: Front;
  let attestationsRegistry: AttestationsRegistry;
  let mockAttester: MockAttester;

  before(async () => {
    [deployer, secondDeployer, userDestination] = await ethers.getSigners();
  });

  describe('Deployments', () => {
    it('Should deploy, setup and test the constructed values of the contract', async () => {
      ({
        front,
        mockAttester: mockAttester,
        attestationsRegistry,
      } = await hre.run('deploy-mock-attester-and-core', {
        uri: 'https://token_cdn.domain/',
        frontFirstCollectionId: '0',
        frontLastCollectionId: '2',
        collectionIdFirst: '3',
        collectionIdLast: '4',
        options: {
          behindProxy: false,
        },
      }));
    });
  });

  describe('Generate attestation', () => {
    let generationTimestamp;
    let request;
    let recordedAttestation;

    before(async () => {
      generationTimestamp = Date.now() / 1000;

      request = {
        claims: [
          {
            groupId: 0,
            claimedValue: 1,
            extraData: [ethers.utils.toUtf8Bytes(generationTimestamp)],
          },
        ],
        destination: userDestination.address,
      };

      recordedAttestation = {
        attester: await mockAttester.ATTESTATION_ID_MIN(),
        owner: userDestination.address,
        issuer: mockAttester.address,
        value: 1,
        timestamp: generationTimestamp,
        extraData: [ethers.utils.toUtf8Bytes('Mock attester v0')],
      };
    });

    it('Should forward generateAttestations call to the attester', async () => {
      const generateAttestationsTransaction = await front.generateAttestations(
        mockAttester.address,
        request,
        ''
      );

      expect(generateAttestationsTransaction)
        .to.emit(attestationsRegistry, 'AttestationRecorded')
        .withArgs(recordedAttestation);

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
      ).to.eql(recordedAttestation);
    });

    it('Should not generate early user attestation if the date is > to Sept 15 2022', async () => {
      const postIncreaseTimeSnapshot = await evmSnapshot(hre);

      await increaseTime(hre, Date.parse('16 Sept 20222 00:00:00 GMT') - Date.now());

      const generateAttestationsTransaction = await front.generateAttestations(
        mockAttester.address,
        request,
        ''
      );

      expect(
        await attestationsRegistry.hasAttestation(
          await front.ATTESTATIONS_REGISTRY(),
          userDestination.address
        )
      ).to.be.false;

      evmRevert(hre, postIncreaseTimeSnapshot);
    });

    it('Should generate early user attestation if the date is < to Sept 15 2022', async () => {
      const generateAttestationsTransaction = await front.generateAttestations(
        mockAttester.address,
        request,
        ''
      );

      const earlyUserGeneratedAttesation = {
        attester: await front.EARLY_USER_COLLECTION(),
        owner: userDestination.address,
        issuer: mockAttester.address,
        value: 1,
        timestamp: generateAttestationsTransaction.timestamp,
        extraData: ['With strong love from Sismo'],
      };

      expect(generateAttestationsTransaction)
        .to.emit(attestationsRegistry, 'AttestationsRecorded')
        .withArgs(earlyUserGeneratedAttesation);

      expect(
        await attestationsRegistry.hasAttestation(
          await front.EARLY_USER_COLLECTION(),
          userDestination.address
        )
      ).to.be.true;

      expect(
        attestationsRegistry.getAttestationData(
          await front.EARLY_USER_COLLECTION(),
          userDestination.address
        )
      ).to.eql(earlyUserGeneratedAttesation);
    });
  });
});
