import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import hre, { ethers } from 'hardhat';
import { getImplementation } from '../../../../utils';
import { deploymentsConfig } from '../../../../tasks/deploy-tasks/deployments-config';
import {
  AttestationsRegistry,
  Badges,
  TransparentUpgradeableProxy__factory,
} from '../../../../types';
import { formatBytes32String } from 'ethers/lib/utils';
import { evmRevert, evmSnapshot } from '../../../../test/utils';

describe('Test Attestations Registry Config Logic contract', () => {
  let deployer: SignerWithAddress;
  let secondDeployer: SignerWithAddress;
  let notOwner: SignerWithAddress;
  let issuer: SignerWithAddress;

  let attestationsRegistry: AttestationsRegistry;
  let secondAttestationsRegistry: AttestationsRegistry;
  let badges: Badges;

  let snapshotId: string;

  before(async () => {
    const signers = await ethers.getSigners();

    [deployer, secondDeployer, notOwner, issuer] = signers;
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

      snapshotId = await evmSnapshot(hre);
    });
  });

  describe('Singles', async () => {
    const authorizedRangeIndex = 0;
    let authorizedRange: { min: number; max: number };

    before(async () => {
      authorizedRange = {
        min: 3,
        max: 6,
      };
    });

    /*************************************************************************************/
    /********************************** AUTHORIZE RANGE **********************************/
    /*************************************************************************************/
    describe('Authorize Range', async () => {
      it('Should revert when the sender is not the owner of the contract', async () => {
        await expect(
          attestationsRegistry
            .connect(notOwner)
            .authorizeRange(issuer.address, authorizedRange.min, authorizedRange.max)
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });

      it('Should authorize the range for the attester', async () => {
        const authorizeIssuerRangeTransaction = await attestationsRegistry.authorizeRange(
          issuer.address,
          authorizedRange.min,
          authorizedRange.max
        );

        // 1 - Checks that the transaction emitted the event
        await expect(authorizeIssuerRangeTransaction)
          .to.emit(attestationsRegistry, 'IssuerAuthorized')
          .withArgs(issuer.address, authorizedRange.min, authorizedRange.max);

        // 2 - Checks that the issuer is authorized for the range
        expect(await attestationsRegistry.isAuthorized(issuer.address, authorizedRange.min)).to.be
          .true;
        expect(await attestationsRegistry.isAuthorized(issuer.address, authorizedRange.max)).to.be
          .true;

        // 3 - Checks that the issuer is not authorized outside of his boundaries
        expect(await attestationsRegistry.isAuthorized(issuer.address, authorizedRange.min - 1)).to
          .be.false;
        expect(await attestationsRegistry.isAuthorized(issuer.address, authorizedRange.max + 1)).to
          .be.false;

        expect(await attestationsRegistry.isAuthorized(issuer.address, authorizedRange.min + 1)).to
          .be.true;
        expect(await attestationsRegistry.isAuthorized(issuer.address, authorizedRange.max - 1)).to
          .be.true;
      });
    });

    /*************************************************************************************/
    /********************************* UNAUTHORIZE RANGE *********************************/
    /*************************************************************************************/
    describe('Unauthorize range', async () => {
      it('Should revert when the sender is not the owner of the contract', async () => {
        await expect(
          attestationsRegistry
            .connect(notOwner)
            .unauthorizeRange(
              issuer.address,
              authorizedRangeIndex,
              authorizedRange.min,
              authorizedRange.max
            )
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });

      it('Should revert when the collection id is superior than the authorizedRanges of the issuer', async () => {
        const unauthorizedRangeIndex = authorizedRangeIndex + 1;

        await expect(
          attestationsRegistry.unauthorizeRange(
            issuer.address,
            unauthorizedRangeIndex,
            authorizedRange.min,
            authorizedRange.max
          )
        ).to.be.revertedWith(
          `RangeIndexOutOfBounds("${issuer.address}", 1, ${unauthorizedRangeIndex})`
        );
      });

      it('Should revert when the firstCollectionId mismatch the collection min', async () => {
        await expect(
          attestationsRegistry.unauthorizeRange(
            issuer.address,
            authorizedRangeIndex,
            authorizedRange.min - 1,
            authorizedRange.max
          )
        ).to.be.revertedWith(
          `IdsMismatch("${issuer.address}", ${authorizedRangeIndex}, ${authorizedRange.min}, ${
            authorizedRange.max
          }, ${authorizedRange.min - 1}, ${authorizedRange.max})`
        );
      });

      it('Should revert when the lastCollectionId mistmatch the collection max', async () => {
        await expect(
          attestationsRegistry.unauthorizeRange(
            issuer.address,
            authorizedRangeIndex,
            authorizedRange.min,
            authorizedRange.max + 1
          )
        ).to.be.revertedWith(
          `IdsMismatch("${issuer.address}", ${authorizedRangeIndex}, ${authorizedRange.min}, ${
            authorizedRange.max
          }, ${authorizedRange.min}, ${authorizedRange.max + 1})`
        );
      });

      it('Should unauthorize the range for the issuer', async () => {
        const unauthorizeIssuerRangeTransaction = await attestationsRegistry.unauthorizeRange(
          issuer.address,
          authorizedRangeIndex,
          authorizedRange.min,
          authorizedRange.max
        );

        // 1 - Checks that the transaction emitted the event
        await expect(unauthorizeIssuerRangeTransaction)
          .to.emit(attestationsRegistry, 'IssuerUnauthorized')
          .withArgs(issuer.address, authorizedRange.min, authorizedRange.max);

        // 2 - Checks that the issuer is authorized for the range
        expect(await attestationsRegistry.isAuthorized(issuer.address, authorizedRange.min)).to.be
          .false;
        expect(await attestationsRegistry.isAuthorized(issuer.address, authorizedRange.max)).to.be
          .false;
      });
    });
  });

  describe('Batches', () => {
    let authorizedRangeIndexes = [0, 1];
    let authorizedRangeLength = 2;
    let authorizedRanges: { min: number; max: number }[] = [];

    before(async () => {
      authorizedRanges = [
        {
          min: 3,
          max: 6,
        },
        {
          min: 9,
          max: 12,
        },
      ];
    });

    /*************************************************************************************/
    /********************************** AUTHORIZE RANGES *********************************/
    /*************************************************************************************/
    describe('Authorize Ranges', () => {
      it('Should revert when the sender is not the owner of the contract', async () => {
        await expect(
          attestationsRegistry.connect(notOwner).authorizeRanges(issuer.address, authorizedRanges)
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });

      it('Should authorize the ranges', async () => {
        const authorizeIssuerRangeTransaction = await attestationsRegistry.authorizeRanges(
          issuer.address,
          authorizedRanges
        );

        // 1 - Checks that the transaction emitted the event
        // 1.1 - Checks that the transaction emitted the first event
        await expect(authorizeIssuerRangeTransaction)
          .to.emit(attestationsRegistry, 'IssuerAuthorized')
          .withArgs(issuer.address, authorizedRanges[0].min, authorizedRanges[0].max);

        // 1.2 - Checks that the transaction emitted the second event
        await expect(authorizeIssuerRangeTransaction)
          .to.emit(attestationsRegistry, 'IssuerAuthorized')
          .withArgs(issuer.address, authorizedRanges[1].min, authorizedRanges[1].max);

        // 2 - Checks that the issuer is authorized for the range
        // 2.1 - Checks that the issuer is authorized for the first range
        expect(await attestationsRegistry.isAuthorized(issuer.address, authorizedRanges[0].min)).to
          .be.true;
        expect(await attestationsRegistry.isAuthorized(issuer.address, authorizedRanges[0].max)).to
          .be.true;

        // 2.2 - Checks that the issuer is authorized for the second range
        expect(await attestationsRegistry.isAuthorized(issuer.address, authorizedRanges[1].min)).to
          .be.true;
        expect(await attestationsRegistry.isAuthorized(issuer.address, authorizedRanges[1].max)).to
          .be.true;

        // 3 - Checks that the issuer is not authorized outside of his boundaries
        // 3.1 - Checks that the issuer is not authorized outside of the first range
        expect(await attestationsRegistry.isAuthorized(issuer.address, authorizedRanges[0].min - 1))
          .to.be.false;
        expect(await attestationsRegistry.isAuthorized(issuer.address, authorizedRanges[0].max + 1))
          .to.be.false;

        expect(await attestationsRegistry.isAuthorized(issuer.address, authorizedRanges[0].min + 1))
          .to.be.true;
        expect(await attestationsRegistry.isAuthorized(issuer.address, authorizedRanges[0].max - 1))
          .to.be.true;

        // 3.2 - Checks that the issuer is not authorized outside of the first range
        expect(await attestationsRegistry.isAuthorized(issuer.address, authorizedRanges[1].min - 1))
          .to.be.false;
        expect(await attestationsRegistry.isAuthorized(issuer.address, authorizedRanges[1].max + 1))
          .to.be.false;

        expect(await attestationsRegistry.isAuthorized(issuer.address, authorizedRanges[1].min + 1))
          .to.be.true;
        expect(await attestationsRegistry.isAuthorized(issuer.address, authorizedRanges[1].max - 1))
          .to.be.true;
      });
    });

    /*************************************************************************************/
    /********************************* UNAUTHORIZE RANGES ********************************/
    /*************************************************************************************/
    describe('Unauthorize Ranges', async () => {
      it('Should revert when the sender is not the owner of the contract', async () => {
        await expect(
          attestationsRegistry
            .connect(notOwner)
            .unauthorizeRanges(issuer.address, authorizedRanges, authorizedRangeIndexes)
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });

      it('Should revert when one of the collection ids is superior than the authorizedRanges of the issuer', async () => {
        const unauthorizedRangeIndexes = [
          authorizedRangeIndexes[0] + 2,
          authorizedRangeIndexes[1] + 1,
        ];

        await expect(
          attestationsRegistry.unauthorizeRanges(
            issuer.address,
            authorizedRanges,
            unauthorizedRangeIndexes
          )
        ).to.be.revertedWith(
          `RangeIndexOutOfBounds("${issuer.address}", ${authorizedRangeLength}, ${unauthorizedRangeIndexes[1]})`
        );

        unauthorizedRangeIndexes[0] -= 2;

        authorizedRangeLength -= 1;

        await expect(
          attestationsRegistry.unauthorizeRanges(
            issuer.address,
            authorizedRanges,
            unauthorizedRangeIndexes
          )
        ).to.be.revertedWith(
          `RangeIndexOutOfBounds("${issuer.address}", ${authorizedRangeLength}, ${
            unauthorizedRangeIndexes[1] - 1
          })`
        );
      });

      it('Should revert when the firstRangeFirstCollectionId mismatch the first collection min', async () => {
        await expect(
          attestationsRegistry.unauthorizeRanges(
            issuer.address,
            [
              {
                min: authorizedRanges[0].min - 1,
                max: authorizedRanges[0].max,
              },
              authorizedRanges[1],
            ],
            authorizedRangeIndexes
          )
        ).to.be.revertedWith(
          `IdsMismatch("${issuer.address}", ${authorizedRangeIndexes[0]}, ${
            authorizedRanges[0].min
          }, ${authorizedRanges[0].max}, ${authorizedRanges[0].min - 1}, ${
            authorizedRanges[0].max
          })`
        );
      });

      it('Should revert when the firstRangeLastCollectionId mismatch the first collection max', async () => {
        await expect(
          attestationsRegistry.unauthorizeRanges(
            issuer.address,
            [
              {
                min: authorizedRanges[0].min,
                max: authorizedRanges[0].max + 1,
              },
              authorizedRanges[1],
            ],
            authorizedRangeIndexes
          )
        ).to.be.revertedWith(
          `IdsMismatch("${issuer.address}", ${authorizedRangeIndexes[0]}, ${
            authorizedRanges[0].min
          }, ${authorizedRanges[0].max}, ${authorizedRanges[0].min}, ${
            authorizedRanges[0].max + 1
          })`
        );
      });

      it('Should revert when the secondRangeFirstCollectionId mismatch the second collection min', async () => {
        await expect(
          attestationsRegistry.unauthorizeRanges(
            issuer.address,
            [
              authorizedRanges[0],
              {
                min: authorizedRanges[1].min - 1,
                max: authorizedRanges[1].max,
              },
            ],
            authorizedRangeIndexes
          )
        ).to.be.revertedWith(
          `IdsMismatch("${issuer.address}", 0, ${authorizedRanges[1].min}, ${
            authorizedRanges[1].max
          }, ${authorizedRanges[1].min - 1}, ${authorizedRanges[1].max})`
        );
      });

      it('Should revert when the secondRangeLastCollectionId mismatch the second collection max', async () => {
        await expect(
          attestationsRegistry.unauthorizeRanges(
            issuer.address,
            [
              authorizedRanges[0],
              {
                min: authorizedRanges[1].min,
                max: authorizedRanges[1].max + 1,
              },
            ],
            authorizedRangeIndexes
          )
        ).to.be.revertedWith(
          `IdsMismatch("${issuer.address}", 0, ${authorizedRanges[1].min}, ${
            authorizedRanges[1].max
          }, ${authorizedRanges[1].min}, ${authorizedRanges[1].max + 1})`
        );
      });

      it('Should unauthorize the ranges for the issuer', async () => {
        const unauthorizeIssuerRangesTransaction = await attestationsRegistry.unauthorizeRanges(
          issuer.address,
          authorizedRanges,
          authorizedRangeIndexes
        );

        // 1 - Checks that the transaction emitted the events
        // 1.1 - Checks that the transaction emitted the first event
        await expect(unauthorizeIssuerRangesTransaction)
          .to.emit(attestationsRegistry, 'IssuerUnauthorized')
          .withArgs(issuer.address, authorizedRanges[0].min, authorizedRanges[0].max);

        // 1.2 - Checks that the transaction emitted the second event
        await expect(unauthorizeIssuerRangesTransaction)
          .to.emit(attestationsRegistry, 'IssuerUnauthorized')
          .withArgs(issuer.address, authorizedRanges[1].min, authorizedRanges[1].max);

        // 2 - Checks that the issuer is authorized for the range
        // 2.1 - Checks that the issuer is authorized for the first range
        expect(await attestationsRegistry.isAuthorized(issuer.address, authorizedRanges[0].min)).to
          .be.false;
        expect(await attestationsRegistry.isAuthorized(issuer.address, authorizedRanges[0].max)).to
          .be.false;

        // 2.2 - Checks that the issuer is authorized for the second range
        expect(await attestationsRegistry.isAuthorized(issuer.address, authorizedRanges[1].min)).to
          .be.false;
        expect(await attestationsRegistry.isAuthorized(issuer.address, authorizedRanges[1].max)).to
          .be.false;
      });
    });
  });

  /*************************************************************************************/
  /*************************************** PAUSE ***************************************/
  /*************************************************************************************/
  describe('Pause', async () => {
    it('Should revert when the sender is not the owner of the contract', async () => {
      await expect(attestationsRegistry.connect(notOwner).pause()).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });

    it('Should pause the contract', async () => {
      const pauseTransaction = await attestationsRegistry.pause();

      // 1 - Checks that the transaction emitted the event
      await expect(pauseTransaction)
        .to.emit(attestationsRegistry, 'Paused')
        .withArgs(deployer.address);

      expect(await attestationsRegistry.paused()).to.be.true;
    });

    it('Should revert when the contract is already paused', async () => {
      await expect(attestationsRegistry.pause()).to.be.revertedWith('Pausable: paused');
    });
  });

  /*************************************************************************************/
  /************************************** UNPAUSE **************************************/
  /*************************************************************************************/
  describe('Unpause', async () => {
    it('Should revert when the sender is not the owner of the contract', async () => {
      await expect(attestationsRegistry.connect(notOwner).unpause()).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });

    it('Should unpause the contract', async () => {
      const unpauseTransaction = await attestationsRegistry.unpause();

      // 1 - Checks that the transaction emitted the event
      await expect(unpauseTransaction)
        .to.emit(attestationsRegistry, 'Unpaused')
        .withArgs(deployer.address);

      expect(await attestationsRegistry.paused()).to.be.false;
    });

    it('Should revert when the contract is already unpaused', async () => {
      await expect(attestationsRegistry.unpause()).to.be.revertedWith('Pausable: not paused');
    });
  });

  /*************************************************************************************/
  /******************************** TRANSFER OWNERSHIP *********************************/
  /*************************************************************************************/
  describe('Transfer ownership', () => {
    it('Should revert when the sender is not the current owner of the contract', async () => {
      await expect(
        attestationsRegistry.connect(notOwner).transferOwnership(notOwner.address)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('Should revert when the newOwner is a zero address', async () => {
      await expect(
        attestationsRegistry.transferOwnership(ethers.constants.AddressZero)
      ).to.be.revertedWith('Ownable: new owner is the zero address');
    });

    it('Should transfer the ownership', async () => {
      await expect(attestationsRegistry.transferOwnership(secondDeployer.address))
        .to.emit(attestationsRegistry, 'OwnershipTransferred')
        .withArgs(deployer.address, secondDeployer.address);
    });
  });

  /*************************************************************************************/
  /******************************** RENOUNCE OWNERSHIP *********************************/
  /*************************************************************************************/
  describe('Renounce ownership', () => {
    before(async () => {
      await attestationsRegistry.connect(secondDeployer).transferOwnership(deployer.address);
    });

    it('Should revert when the sender is not the current owner of the contract', async () => {
      await expect(attestationsRegistry.connect(notOwner).renounceOwnership()).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });

    it('Should renounce the ownership', async () => {
      await expect(attestationsRegistry.renounceOwnership())
        .to.emit(attestationsRegistry, 'OwnershipTransferred')
        .withArgs(deployer.address, ethers.constants.AddressZero);
    });
  });

  describe('Tags', async () => {
    let TAGS = {
      CURATED: 1,
      SYBIL_RESISTANCE: 2,
      TEST_INSERTION: 10,
      NOT_INSERTED: 50,
    };

    before(async () => {
      await evmRevert(hre, snapshotId);
    });

    describe('Tag insertion', async () => {
      it('Should revert when inserting a new tag as a non-owner', async () => {
        await expect(
          attestationsRegistry
            .connect(notOwner)
            .insertNewTag(TAGS.TEST_INSERTION, formatBytes32String('TEST_INSERTION'))
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });

      it('Should insert a new tag as an owner', async () => {
        const tagInserted = await attestationsRegistry
          .connect(deployer)
          .insertNewTag(TAGS.TEST_INSERTION, formatBytes32String('TEST_INSERTION'));

        await expect(tagInserted)
          .to.emit(attestationsRegistry, 'NewTagInserted')
          .withArgs(TAGS.TEST_INSERTION, formatBytes32String('TEST_INSERTION'));
      });

      it('Should revert when inserting a tag with index > 63', async () => {
        await expect(
          attestationsRegistry.insertNewTag(64, formatBytes32String('TAG_OVERFLOW'))
        ).to.be.revertedWith('TagIndexOutOfBounds(64)');
      });

      it('Should revert when trying to re-insert a tag for the same index', async () => {
        await expect(
          attestationsRegistry.insertNewTag(TAGS.TEST_INSERTION, formatBytes32String('OTHER TAG'))
        ).to.be.revertedWith('TagAlreadyExists(10)');
      });
    });

    describe('Tag update', async () => {
      it('Should revert when updating tag as a non-owner', async () => {
        await expect(
          attestationsRegistry
            .connect(notOwner)
            .updateTagName(TAGS.TEST_INSERTION, formatBytes32String('CURATED2'))
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });

      it('Should revert when trying to update update a tag name that does not exists', async () => {
        await expect(
          attestationsRegistry
            .connect(deployer)
            .updateTagName(TAGS.NOT_INSERTED, formatBytes32String('NOT_INSERTED'))
        ).to.be.revertedWith('TagDoesNotExist(50)');
      });

      it('Should update a tag name', async () => {
        const tagUpdated = await attestationsRegistry
          .connect(deployer)
          .updateTagName(TAGS.TEST_INSERTION, formatBytes32String('CURATED2'));

        await expect(tagUpdated)
          .to.emit(attestationsRegistry, 'TagNameUpdated')
          .withArgs(TAGS.TEST_INSERTION, formatBytes32String('CURATED2'));
      });
    });

    describe('Tag deletion', async () => {
      it('Should revert when deleting a tag as a non-owner', async () => {
        await expect(
          attestationsRegistry.connect(notOwner).deleteTag(TAGS.NOT_INSERTED)
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });

      it('Should revert when trying to update update a tag name that does not exists', async () => {
        await expect(
          attestationsRegistry.connect(notOwner).deleteTag(TAGS.NOT_INSERTED)
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });

      it('Should delete a tag', async () => {
        const tagDeleted = await attestationsRegistry
          .connect(deployer)
          .deleteTag(TAGS.TEST_INSERTION);
        await expect(tagDeleted)
          .to.emit(attestationsRegistry, 'TagDeleted')
          .withArgs(TAGS.TEST_INSERTION);
      });
    });

    describe('Register AttestationsCollection Tags', async () => {
      before(async () => {
        // Register the tag we will use during the tests
        await attestationsRegistry
          .connect(deployer)
          .insertNewTag(TAGS.CURATED, formatBytes32String('CURATED'));
      });

      it('Should revert when registering a tag as a non-owner', async () => {
        await expect(
          attestationsRegistry
            .connect(notOwner)
            .registerAttestationsCollectionTag(1, TAGS.CURATED, 1)
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });

      it('Should revert when registering a tag to an AttestationsCollection and the tag is not already inserted', async () => {
        await expect(
          attestationsRegistry
            .connect(deployer)
            .registerAttestationsCollectionTag(1, TAGS.NOT_INSERTED, 1)
        ).to.be.revertedWith('TagDoesNotExist(50)');
      });

      it('Should register a tag to an AttestationsCollection with power 1', async () => {
        const tagRegistered = await attestationsRegistry
          .connect(deployer)
          .registerAttestationsCollectionTag(1, TAGS.CURATED, 1);

        await expect(tagRegistered)
          .to.emit(attestationsRegistry, 'AttestationsCollectionTagRegistered')
          .withArgs(1, TAGS.CURATED, 1);

        expect(await attestationsRegistry.hasAttestationsCollectionTag(1, TAGS.CURATED)).to.be.true;
        expect(
          await attestationsRegistry.getAttestationsCollectionTagPower(1, TAGS.CURATED)
        ).to.be.eq(1);
      });

      it('Should register a tag to an AttestationsCollection and increase the power', async () => {
        const tagRegistered = await attestationsRegistry
          .connect(deployer)
          .registerAttestationsCollectionTag(1, TAGS.CURATED, 5);

        await expect(tagRegistered)
          .to.emit(attestationsRegistry, 'AttestationsCollectionTagRegistered')
          .withArgs(1, TAGS.CURATED, 5);

        expect(await attestationsRegistry.hasAttestationsCollectionTag(1, TAGS.CURATED)).to.be.true;
        expect(
          await attestationsRegistry.getAttestationsCollectionTagPower(1, TAGS.CURATED)
        ).to.be.eq(5);
      });

      it('Should revert to register a tag to an AttestationsCollection with power > 7', async () => {
        await expect(
          attestationsRegistry
            .connect(deployer)
            .registerAttestationsCollectionTag(1, TAGS.CURATED, 8)
        ).to.be.revertedWith('TagPowerOutOfBounds(8)');
      });

      it('Should revert when unregistering a tag as a non-owner', async () => {
        await expect(
          attestationsRegistry
            .connect(notOwner)
            .unregisterAttestationsCollectionTag(1, TAGS.CURATED)
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });

      it('Should unregister tag to an AttestationsCollection', async () => {
        const tagRegistered = await attestationsRegistry
          .connect(deployer)
          .unregisterAttestationsCollectionTag(1, TAGS.CURATED);

        await expect(tagRegistered)
          .to.emit(attestationsRegistry, 'AttestationsCollectionTagUnregistered')
          .withArgs(1, TAGS.CURATED);

        expect(await attestationsRegistry.hasAttestationsCollectionTag(1, TAGS.CURATED)).to.be
          .false;
        expect(
          await attestationsRegistry.getAttestationsCollectionTagPower(1, TAGS.CURATED)
        ).to.be.eq(0);
      });
    });
  });

  describe('Update Implementation', () => {
    it('Should update implementation', async () => {
      const proxyAdminSigner = await ethers.getSigner(
        deploymentsConfig[hre.network.name].deployOptions.proxyAdmin as string
      );
      const { attestationsRegistry: newImplementation } = await hre.run(
        'deploy-attestations-registry',
        {
          badges: secondDeployer.address,
          owner: secondDeployer.address,
          options: { behindProxy: false },
        }
      );
      const attestationsRegistryProxy = TransparentUpgradeableProxy__factory.connect(
        attestationsRegistry.address,
        proxyAdminSigner
      );
      await (await attestationsRegistryProxy.upgradeTo(newImplementation.address)).wait();

      const implementationAddress = await getImplementation(attestationsRegistryProxy);
      expect(implementationAddress).to.be.eql(newImplementation.address);
    });
  });
});
