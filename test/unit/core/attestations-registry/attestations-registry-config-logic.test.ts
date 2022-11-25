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

  /***********************************************************************/
  /******************************** TAGS *********************************/
  /***********************************************************************/

  describe('Tags', async () => {
    let TAGS = {
      CURATED: 1,
      SYBIL_RESISTANCE: 2,
      TEST_INSERTION: 10,
      NOT_CREATED: 50,
    };

    before(async () => {
      await evmRevert(hre, snapshotId);
    });

    describe('Tag creation', async () => {
      it('Should revert when creating a new tag as a non-owner', async () => {
        await expect(
          attestationsRegistry
            .connect(notOwner)
            .createNewTag(TAGS.TEST_INSERTION, formatBytes32String('TEST_INSERTION'))
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });

      it('Should revert when creating new tags as a non-owner', async () => {
        await expect(
          attestationsRegistry
            .connect(notOwner)
            .createNewTags(
              [TAGS.TEST_INSERTION, TAGS.CURATED],
              [formatBytes32String('TEST_INSERTION'), formatBytes32String('CURATED')]
            )
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });

      it('Should revert when creating new tags with different arguments length', async () => {
        await expect(
          attestationsRegistry.connect(deployer).createNewTags(
            [TAGS.TEST_INSERTION], // missing one argument
            [formatBytes32String('TEST_INSERTION'), formatBytes32String('CURATED')]
          )
        ).to.be.revertedWith('ArgsLengthDoesNotMatch()');
      });

      it('Should revert when creating a tag with index > 63', async () => {
        await expect(
          attestationsRegistry
            .connect(deployer)
            .createNewTag(64, formatBytes32String('TAG_OVERFLOW'))
        ).to.be.revertedWith('TagIndexOutOfBounds(64)');
      });

      it('Should revert when creating new tags with index of one of them > 63', async () => {
        await expect(
          attestationsRegistry
            .connect(deployer)
            .createNewTags(
              [TAGS.CURATED, 64],
              [formatBytes32String('CURATED'), formatBytes32String('TAG_OVERFLOW')]
            )
        ).to.be.revertedWith('TagIndexOutOfBounds(64)');
      });

      it('Should create a new tag as an owner', async () => {
        const tagInserted = await attestationsRegistry
          .connect(deployer)
          .createNewTag(TAGS.TEST_INSERTION, formatBytes32String('TEST_INSERTION'));

        await expect(tagInserted)
          .to.emit(attestationsRegistry, 'NewTagCreated')
          .withArgs(TAGS.TEST_INSERTION, formatBytes32String('TEST_INSERTION'));
      });

      it('Should revert when trying to create again a tag for the same index', async () => {
        await expect(
          attestationsRegistry.createNewTag(TAGS.TEST_INSERTION, formatBytes32String('OTHER TAG'))
        ).to.be.revertedWith('TagAlreadyExists(10)');
      });

      it('Should revert when creating new tags with one of them already existing', async () => {
        await expect(
          attestationsRegistry.connect(deployer).createNewTags(
            [TAGS.CURATED, TAGS.TEST_INSERTION], // TEST_INSERTION already created
            [formatBytes32String('CURATED'), formatBytes32String('TEST_INSERTION')]
          )
        ).to.be.revertedWith('TagAlreadyExists(10)');
      });

      it('Should create new tags as an owner', async () => {
        const tagsInserted = await attestationsRegistry
          .connect(deployer)
          .createNewTags(
            [TAGS.CURATED, TAGS.SYBIL_RESISTANCE],
            [formatBytes32String('CURATED'), formatBytes32String('SYBIL_RESISTANCE')]
          );

        await expect(tagsInserted)
          .to.emit(attestationsRegistry, 'NewTagCreated')
          .withArgs(TAGS.CURATED, formatBytes32String('CURATED'));

        await expect(tagsInserted)
          .to.emit(attestationsRegistry, 'NewTagCreated')
          .withArgs(TAGS.SYBIL_RESISTANCE, formatBytes32String('SYBIL_RESISTANCE'));
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

      it('Should revert when updating tags as a non-owner', async () => {
        await expect(
          attestationsRegistry
            .connect(notOwner)
            .updateTagsName(
              [TAGS.TEST_INSERTION, TAGS.CURATED],
              [formatBytes32String('TEST_INSERTION2'), formatBytes32String('CURATED2')]
            )
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });

      it('Should revert when updating new tags with different arguments length', async () => {
        await expect(
          attestationsRegistry.connect(deployer).updateTagsName(
            [TAGS.TEST_INSERTION], // missing one argument
            [formatBytes32String('TEST_INSERTION2'), formatBytes32String('CURATED2')]
          )
        ).to.be.revertedWith('ArgsLengthDoesNotMatch()');
      });

      it('Should revert when updating a tag with index > 63', async () => {
        await expect(
          attestationsRegistry
            .connect(deployer)
            .updateTagName(64, formatBytes32String('TAG_OVERFLOW'))
        ).to.be.revertedWith('TagIndexOutOfBounds(64)');
      });

      it('Should revert when updating new tags with index of one of them > 63', async () => {
        await expect(
          attestationsRegistry
            .connect(deployer)
            .updateTagsName(
              [TAGS.CURATED, 64],
              [formatBytes32String('CURATED2'), formatBytes32String('TAG_OVERFLOW')]
            )
        ).to.be.revertedWith('TagIndexOutOfBounds(64)');
      });

      it('Should revert when trying to update a tag name that does not exists', async () => {
        await expect(
          attestationsRegistry
            .connect(deployer)
            .updateTagName(TAGS.NOT_CREATED, formatBytes32String('NOT_INSERTED'))
        ).to.be.revertedWith('TagDoesNotExist(50)');
      });

      it('Should revert when trying to update tags name with one of them that does not exists', async () => {
        await expect(
          attestationsRegistry
            .connect(deployer)
            .updateTagsName(
              [TAGS.CURATED, TAGS.NOT_CREATED],
              [formatBytes32String('CURATED2'), formatBytes32String('NOT_INSERTED')]
            )
        ).to.be.revertedWith('TagDoesNotExist(50)');
      });

      it('Should update a tag name', async () => {
        const tagUpdated = await attestationsRegistry
          .connect(deployer)
          .updateTagName(TAGS.TEST_INSERTION, formatBytes32String('TEST_INSERTION2'));

        await expect(tagUpdated)
          .to.emit(attestationsRegistry, 'TagNameUpdated')
          .withArgs(
            TAGS.TEST_INSERTION,
            formatBytes32String('TEST_INSERTION2'),
            formatBytes32String('TEST_INSERTION')
          );
      });

      it('Should update tags name', async () => {
        const tagsUpdated = await attestationsRegistry
          .connect(deployer)
          .updateTagsName(
            [TAGS.CURATED, TAGS.SYBIL_RESISTANCE],
            [formatBytes32String('CURATED2'), formatBytes32String('SYBIL_RESISTANCE2')]
          );

        await expect(tagsUpdated)
          .to.emit(attestationsRegistry, 'TagNameUpdated')
          .withArgs(TAGS.CURATED, formatBytes32String('CURATED2'), formatBytes32String('CURATED'));

        await expect(tagsUpdated)
          .to.emit(attestationsRegistry, 'TagNameUpdated')
          .withArgs(
            TAGS.SYBIL_RESISTANCE,
            formatBytes32String('SYBIL_RESISTANCE2'),
            formatBytes32String('SYBIL_RESISTANCE')
          );
      });
    });

    describe('Tag deletion', async () => {
      it('Should revert when deleting a tag as a non-owner', async () => {
        await expect(
          attestationsRegistry.connect(notOwner).deleteTag(TAGS.NOT_CREATED)
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });

      it('Should revert when deleting tags as a non-owner', async () => {
        await expect(
          attestationsRegistry.connect(notOwner).deleteTags([TAGS.NOT_CREATED, TAGS.TEST_INSERTION])
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });

      it('Should revert when trying to delete a tag with index > 63', async () => {
        await expect(attestationsRegistry.connect(deployer).deleteTag(64)).to.be.revertedWith(
          'TagIndexOutOfBounds(64)'
        );
      });

      it('Should revert when trying to delete tags with index of one of them > 63', async () => {
        await expect(
          attestationsRegistry.connect(deployer).deleteTags([TAGS.CURATED, 64])
        ).to.be.revertedWith('TagIndexOutOfBounds(64)');
      });

      it('Should revert when trying to delete a tag that does not exists', async () => {
        await expect(
          attestationsRegistry.connect(deployer).deleteTag(TAGS.NOT_CREATED)
        ).to.be.revertedWith('TagDoesNotExist(50)');
      });

      it('Should revert when trying to delete tags with one of them that does not exists', async () => {
        await expect(
          attestationsRegistry.connect(deployer).deleteTags([TAGS.CURATED, TAGS.NOT_CREATED])
        ).to.be.revertedWith('TagDoesNotExist(50)');
      });

      it('Should delete a tag', async () => {
        const tagDeleted = await attestationsRegistry
          .connect(deployer)
          .deleteTag(TAGS.TEST_INSERTION);
        await expect(tagDeleted)
          .to.emit(attestationsRegistry, 'TagDeleted')
          .withArgs(TAGS.TEST_INSERTION, formatBytes32String('TEST_INSERTION2'));
      });

      it('Should delete tags', async () => {
        const tagsDeleted = await attestationsRegistry
          .connect(deployer)
          .deleteTags([TAGS.CURATED, TAGS.SYBIL_RESISTANCE]);

        await expect(tagsDeleted)
          .to.emit(attestationsRegistry, 'TagDeleted')
          .withArgs(TAGS.CURATED, formatBytes32String('CURATED2'));

        await expect(tagsDeleted)
          .to.emit(attestationsRegistry, 'TagDeleted')
          .withArgs(TAGS.SYBIL_RESISTANCE, formatBytes32String('SYBIL_RESISTANCE2'));
      });
    });

    describe('Create AttestationsCollection Tags', async () => {
      before(async () => {
        // Register the tag we will use during the tests
        await attestationsRegistry
          .connect(deployer)
          .createNewTags(
            [TAGS.CURATED, TAGS.SYBIL_RESISTANCE],
            [formatBytes32String('CURATED'), formatBytes32String('SYBIL_RESISTANCE')]
          );
      });

      it('Should revert when setting a tag as a non-owner', async () => {
        await expect(
          attestationsRegistry.connect(notOwner).setTagForAttestationsCollection(1, TAGS.CURATED, 1)
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });

      it('Should revert when setting tags as a non-owner', async () => {
        await expect(
          attestationsRegistry
            .connect(notOwner)
            .setTagsForAttestationsCollection([1, 1], [TAGS.CURATED, TAGS.SYBIL_RESISTANCE], [1, 2])
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });

      it('Should revert when setting tags with invalid args length', async () => {
        await expect(
          attestationsRegistry.connect(deployer).setTagsForAttestationsCollection(
            [1], //missing arg
            [TAGS.CURATED, TAGS.SYBIL_RESISTANCE],
            [1, 2]
          )
        ).to.be.revertedWith('ArgsLengthDoesNotMatch');
      });

      it('Should revert when setting a tag with an index > 63', async () => {
        await expect(
          attestationsRegistry.connect(deployer).setTagForAttestationsCollection(1, 64, 1)
        ).to.be.revertedWith('TagIndexOutOfBounds(64)');
      });

      it('Should revert when setting tags with one of them having an index > 63', async () => {
        await expect(
          attestationsRegistry
            .connect(deployer)
            .setTagsForAttestationsCollection([1, 1], [TAGS.CURATED, 64], [1, 2])
        ).to.be.revertedWith('TagIndexOutOfBounds(64)');
      });

      it('Should revert when setting a tag to an AttestationsCollection and the tag is not already created', async () => {
        await expect(
          attestationsRegistry
            .connect(deployer)
            .setTagForAttestationsCollection(1, TAGS.NOT_CREATED, 1)
        ).to.be.revertedWith('TagDoesNotExist(50)');
      });

      it('Should revert when setting tags to an AttestationsCollection and one of the tags is not already created', async () => {
        await expect(
          attestationsRegistry
            .connect(deployer)
            .setTagsForAttestationsCollection([1, 1], [TAGS.CURATED, TAGS.NOT_CREATED], [1, 2])
        ).to.be.revertedWith('TagDoesNotExist(50)');
      });

      it('Should set a tag to an AttestationsCollection with power 1', async () => {
        const tagSet = await attestationsRegistry
          .connect(deployer)
          .setTagForAttestationsCollection(1, TAGS.CURATED, 1);

        await expect(tagSet)
          .to.emit(attestationsRegistry, 'AttestationsCollectionTagSet')
          .withArgs(1, TAGS.CURATED, 1);

        expect(await attestationsRegistry.attestationsCollectionHasTag(1, TAGS.CURATED)).to.be.true;
        expect(
          await attestationsRegistry.getTagPowerForAttestationsCollection(1, TAGS.CURATED)
        ).to.be.eq(1);
      });

      it('Should set a tag to an AttestationsCollection and change the power', async () => {
        const tagSet = await attestationsRegistry
          .connect(deployer)
          .setTagForAttestationsCollection(1, TAGS.CURATED, 5);

        await expect(tagSet)
          .to.emit(attestationsRegistry, 'AttestationsCollectionTagSet')
          .withArgs(1, TAGS.CURATED, 5);

        expect(await attestationsRegistry.attestationsCollectionHasTag(1, TAGS.CURATED)).to.be.true;
        expect(
          await attestationsRegistry.getTagPowerForAttestationsCollection(1, TAGS.CURATED)
        ).to.be.eq(5);
      });

      it('Should revert to set a tag to an AttestationsCollection with power > 15', async () => {
        await expect(
          attestationsRegistry
            .connect(deployer)
            .setTagForAttestationsCollection(1, TAGS.CURATED, 16)
        ).to.be.revertedWith('TagPowerOutOfBounds(16)');
      });

      it('Should revert when removing a tag as a non-owner', async () => {
        await expect(
          attestationsRegistry.connect(notOwner).setTagForAttestationsCollection(1, TAGS.CURATED, 0)
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });

      it('Should remove tag to an AttestationsCollection', async () => {
        const tagRemoved = await attestationsRegistry
          .connect(deployer)
          .setTagForAttestationsCollection(1, TAGS.CURATED, 0);

        await expect(tagRemoved)
          .to.emit(attestationsRegistry, 'AttestationsCollectionTagSet')
          .withArgs(1, TAGS.CURATED, 0);

        expect(await attestationsRegistry.attestationsCollectionHasTag(1, TAGS.CURATED)).to.be
          .false;
        expect(
          await attestationsRegistry.getTagPowerForAttestationsCollection(1, TAGS.CURATED)
        ).to.be.eq(0);
      });

      it('Should set tags to two AttestationsCollection with power 1 and 2', async () => {
        const tagsSet = await attestationsRegistry
          .connect(deployer)
          .setTagsForAttestationsCollection([1, 1], [TAGS.CURATED, TAGS.SYBIL_RESISTANCE], [1, 2]);

        await expect(tagsSet)
          .to.emit(attestationsRegistry, 'AttestationsCollectionTagSet')
          .withArgs(1, TAGS.CURATED, 1);

        await expect(tagsSet)
          .to.emit(attestationsRegistry, 'AttestationsCollectionTagSet')
          .withArgs(1, TAGS.SYBIL_RESISTANCE, 2);

        expect(
          await attestationsRegistry.attestationsCollectionHasTags(1, [
            TAGS.CURATED,
            TAGS.SYBIL_RESISTANCE,
          ])
        ).to.be.true;

        expect(
          await attestationsRegistry.getTagsPowerForAttestationsCollection(1, [
            TAGS.CURATED,
            TAGS.SYBIL_RESISTANCE,
          ])
        ).to.be.eql([1, 2]);
      });

      it('Should set tags to AttestationsCollection and change the power', async () => {
        const tagsSet = await attestationsRegistry
          .connect(deployer)
          .setTagsForAttestationsCollection([1, 1], [TAGS.CURATED, TAGS.SYBIL_RESISTANCE], [6, 11]);

        await expect(tagsSet)
          .to.emit(attestationsRegistry, 'AttestationsCollectionTagSet')
          .withArgs(1, TAGS.CURATED, 6);

        await expect(tagsSet)
          .to.emit(attestationsRegistry, 'AttestationsCollectionTagSet')
          .withArgs(1, TAGS.SYBIL_RESISTANCE, 11);

        expect(
          await attestationsRegistry.attestationsCollectionHasTags(1, [
            TAGS.CURATED,
            TAGS.SYBIL_RESISTANCE,
          ])
        ).to.be.true;
        expect(
          await attestationsRegistry.getTagsPowerForAttestationsCollection(1, [
            TAGS.CURATED,
            TAGS.SYBIL_RESISTANCE,
          ])
        ).to.be.eql([6, 11]);
      });

      it('Should revert to set tags to an AttestationsCollection with one of them having a power > 15', async () => {
        await expect(
          attestationsRegistry
            .connect(deployer)
            .setTagsForAttestationsCollection(
              [1, 1],
              [TAGS.CURATED, TAGS.SYBIL_RESISTANCE],
              [6, 16]
            )
        ).to.be.revertedWith('TagPowerOutOfBounds(16)');
      });

      it('Should revert when removing tags as a non-owner', async () => {
        await expect(
          attestationsRegistry
            .connect(notOwner)
            .setTagsForAttestationsCollection([1, 1], [TAGS.CURATED, TAGS.SYBIL_RESISTANCE], [0, 0])
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });

      it('Should remove tags to an AttestationsCollection', async () => {
        const tagsRemoved = await attestationsRegistry
          .connect(deployer)
          .setTagsForAttestationsCollection([1, 1], [TAGS.CURATED, TAGS.SYBIL_RESISTANCE], [0, 0]);

        await expect(tagsRemoved)
          .to.emit(attestationsRegistry, 'AttestationsCollectionTagSet')
          .withArgs(1, TAGS.CURATED, 0);

        await expect(tagsRemoved)
          .to.emit(attestationsRegistry, 'AttestationsCollectionTagSet')
          .withArgs(1, TAGS.SYBIL_RESISTANCE, 0);

        expect(
          await attestationsRegistry.attestationsCollectionHasTags(1, [
            TAGS.CURATED,
            TAGS.SYBIL_RESISTANCE,
          ])
        ).to.be.false;

        expect(
          await attestationsRegistry.getTagsPowerForAttestationsCollection(1, [
            TAGS.CURATED,
            TAGS.SYBIL_RESISTANCE,
          ])
        ).to.be.eql([0, 0]);
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
