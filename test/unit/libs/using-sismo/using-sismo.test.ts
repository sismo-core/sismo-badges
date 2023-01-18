import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { EddsaPublicKey, HydraS1Account, KVMerkleTree } from '@sismo-core/hydra-s1';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import hre, { ethers } from 'hardhat';
import {
  evmRevert,
  evmSnapshot,
  generateProvingData,
  HydraS1SimpleGroup,
  HydraS1ZKPS,
} from '../../../utils';
import {
  AvailableRootsRegistry,
  HydraS1AccountboundAttester,
  MockContractUsingSismoLib,
} from 'types';
import {
  checkAccountHoldsBadge,
  computeBadgeIds,
  deployCoreContracts,
  mintBadge,
  registerRootForAttester,
} from '../../../utils/test-helpers';

describe('Test UsingSismo Lib', async () => {
  let mockContractUsingSismoLib: MockContractUsingSismoLib;
  let hydraS1AccountboundAttester: HydraS1AccountboundAttester;
  let availableRootsRegistry: AvailableRootsRegistry;

  let accountsSigners: SignerWithAddress[];
  let deployer: SignerWithAddress;
  let account1Signer: SignerWithAddress;
  let account2Signer: SignerWithAddress;
  let account3Signer: SignerWithAddress;

  let accounts: HydraS1Account[];
  let account1: HydraS1Account;
  let account2: HydraS1Account;
  let account3: HydraS1Account;

  let provingScheme: HydraS1ZKPS;

  let accountsTreesWithData: { tree: KVMerkleTree; group: HydraS1SimpleGroup }[];
  let registryTree: KVMerkleTree;
  let groups: HydraS1SimpleGroup[];
  let commitmentMapperPubKey: EddsaPublicKey;

  let badgeId: BigNumber;
  let badgeId2: BigNumber;

  let zeroAddress: string;
  let cooldownDuration: number;
  let evmSnapshotId: string;
  let resetStateSnapshotId: string;
  let chainId: number;

  let checkBalanceIncrease: (account: SignerWithAddress, balanceBefore: BigNumber) => Promise<void>;
  let testBalanceIncrease: (
    accountSigner: SignerWithAddress,
    functionName: string,
    args?: any
  ) => Promise<void>;

  before(async () => {
    chainId = parseInt(await hre.getChainId());

    ({ accountsTreesWithData, registryTree, groups, accounts, commitmentMapperPubKey } =
      await generateProvingData({
        nbOfGroups: 2,
      }));

    cooldownDuration = 60 * 60 * 24;

    // data to reuse everywhere

    accountsSigners = await ethers.getSigners();

    deployer = accountsSigners[0];
    account1Signer = accountsSigners[0]; // deployer and account1Signer are the same
    account2Signer = accountsSigners[1];
    account3Signer = accountsSigners[2];

    account1 = accounts[0]; // has a value of 1 in groups
    account2 = accounts[1]; // has a value of 2 in groups
    account3 = accounts[2]; // has a value of 3 in groups

    zeroAddress = '0x0000000000000000000000000000000000000000';
  });

  describe('Deployments', async () => {
    it('Should deploy, setup core and mock', async () => {
      ({ hydraS1AccountboundAttester, availableRootsRegistry } = await deployCoreContracts(
        deployer,
        {
          deploymentNamePrefix: 'mock-contract-using-sismo-lib',
        }
      ));

      // deploy mock contract
      ({ mockContractUsingSismoLib } = await hre.run('deploy-mock-contract-using-sismo-lib', {
        options: {
          deploymentNamePrefix: 'mock-contract-using-sismo-lib',
          behindProxy: false,
        },
      }));

      await registerRootForAttester(
        availableRootsRegistry,
        hydraS1AccountboundAttester,
        registryTree
      );

      await hydraS1AccountboundAttester.setCooldownDurationForGroupIndex(
        groups[0].properties.groupIndex,
        cooldownDuration
      );

      // set up the proving scheme
      provingScheme = new HydraS1ZKPS({
        accountsTreesWithData,
        registryTree,
        groups,
        defaultAttester: hydraS1AccountboundAttester,
        commitmentMapperPubKey,
        chainId,
      });

      [badgeId, badgeId2] = await computeBadgeIds(provingScheme);

      // helpers function

      checkBalanceIncrease = async (account: SignerWithAddress, balanceBefore: BigNumber) => {
        expect(await mockContractUsingSismoLib.balances(account.address)).to.be.eql(
          balanceBefore.add(1)
        );
      };

      testBalanceIncrease = async (
        accountSigner: SignerWithAddress,
        functionName: string,
        args?: any
      ) => {
        const balanceBefore = await mockContractUsingSismoLib.balances(accountSigner.address);
        args
          ? await mockContractUsingSismoLib.connect(accountSigner)[functionName](...args)
          : await mockContractUsingSismoLib.connect(accountSigner)[functionName]();
        await checkBalanceIncrease(accountSigner, balanceBefore);
      };
    });

    it('Should check gated badges ID in mock contract', async () => {
      expect(await mockContractUsingSismoLib.FIRST_GATED_BADGE_ID()).to.be.eql(badgeId);

      expect(await mockContractUsingSismoLib.SECOND_GATED_BADGE_ID()).to.be.eql(badgeId2);
    });
  });

  describe('Mint Badge', async () => {
    it('Should mint a badge (with attester address in args)', async () => {
      let evmSnapshotId = await evmSnapshot(hre);
      await checkAccountHoldsBadge(account2Signer.address, badgeId, false);
      const { request, proofData } = await provingScheme.generateProof({
        sources: [account1],
        destination: account2,
      });

      await mockContractUsingSismoLib.testMintSismoBadgeWithAttester(
        request,
        proofData,
        hydraS1AccountboundAttester.address
      );

      await checkAccountHoldsBadge(account2Signer.address, badgeId);
      await evmRevert(hre, evmSnapshotId);
    });

    it('Should mint a badge (with default attester address)', async () => {
      let evmSnapshotId = await evmSnapshot(hre);
      await checkAccountHoldsBadge(account2Signer.address, badgeId, false);
      const { request, proofData } = await provingScheme.generateProof({
        sources: [account1],
        destination: account2,
      });

      await mockContractUsingSismoLib.testMintSismoBadge(request, proofData);

      await checkAccountHoldsBadge(account2Signer.address, badgeId);
      await evmRevert(hre, evmSnapshotId);
    });

    it('Should mint badges (with attester address in args)', async () => {
      // TODO: test with a future attester issuing multiple attestations
      let evmSnapshotId = await evmSnapshot(hre);
      await checkAccountHoldsBadge(account2Signer.address, badgeId, false);
      const { request, proofData } = await provingScheme.generateProof({
        sources: [account1],
        destination: account2,
      });

      await mockContractUsingSismoLib.testMintSismoBadgesWithAttester(
        request,
        proofData,
        hydraS1AccountboundAttester.address
      );

      await checkAccountHoldsBadge(account2Signer.address, badgeId);
      await evmRevert(hre, evmSnapshotId);
    });

    it('Should mint badges (with default attester address)', async () => {
      // TODO: test with a future attester issuing multiple attestations
      let evmSnapshotId = await evmSnapshot(hre);
      await checkAccountHoldsBadge(account2Signer.address, badgeId, false);
      const { request, proofData } = await provingScheme.generateProof({
        sources: [account1],
        destination: account2,
      });

      await mockContractUsingSismoLib.testMintSismoBadges(request, proofData);

      await checkAccountHoldsBadge(account2Signer.address, badgeId);
      await evmRevert(hre, evmSnapshotId);
    });
  });

  describe('Modifiers', async () => {
    describe('onlyBadgeHoldersModifier', async () => {
      it('should revert if the user has no badge', async () => {
        // 0x2 should not hold badge yet
        await checkAccountHoldsBadge(account2Signer.address, badgeId, false);
        await expect(
          mockContractUsingSismoLib.connect(account2Signer).testOnlyBadgeHoldersModifier()
        ).to.be.revertedWith('UserDoesNotMeetRequirements()');
      });

      it('should pass if user has badge', async () => {
        evmSnapshotId = await evmSnapshot(hre);
        await mintBadge({
          sources: [account1],
          destination: account2,
          provingScheme,
        });

        await testBalanceIncrease(account2Signer, 'testOnlyBadgeHoldersModifier');

        await evmRevert(hre, evmSnapshotId);
      });
    });

    describe('onlyBadgesHoldersWithAllBadgesRequiredModifier', async () => {
      it('should revert if the user has no badge', async () => {
        // 0x2 should not hold badge yet
        await checkAccountHoldsBadge(account2Signer.address, badgeId, false);
        await expect(
          mockContractUsingSismoLib
            .connect(account2Signer)
            .testOnlyBadgesHoldersWithAllBadgesRequiredModifier([badgeId, badgeId2])
        ).to.be.revertedWith(`UserDoesNotMeetAllRequirements(${badgeId}, 1)`);
      });

      it('should revert if the user has only one badge', async () => {
        evmSnapshotId = await evmSnapshot(hre);
        await mintBadge({
          sources: [account1],
          destination: account2,
          provingScheme,
        });

        await expect(
          mockContractUsingSismoLib
            .connect(account2Signer)
            .testOnlyBadgesHoldersWithAllBadgesRequiredModifier([badgeId, badgeId2])
        ).to.be.revertedWith(`UserDoesNotMeetAllRequirements(${badgeId2}, 1)`);
      });

      it('should pass if user has all badges', async () => {
        // 0x2 should only hold badge with badgeId
        await checkAccountHoldsBadge(account2Signer.address, badgeId);
        await mintBadge({
          sources: [account1],
          destination: account2,
          group: groups[1], // we mint badge with badgeId2
          value: BigNumber.from(2), // claimed value for badge with badgeId2
          provingScheme,
        });

        await testBalanceIncrease(
          account2Signer,
          'testOnlyBadgesHoldersWithAllBadgesRequiredModifier',
          [[badgeId, badgeId2]]
        );

        await evmRevert(hre, evmSnapshotId);
      });
    });

    describe('onlyBadgesHoldersWithOnlyOneBadgeRequiredModifier', async () => {
      it('should revert if the user has no badge', async () => {
        // 0x2 should not hold badge yet
        await checkAccountHoldsBadge(account2Signer.address, badgeId, false);
        await checkAccountHoldsBadge(account2Signer.address, badgeId2, false);
        await expect(
          mockContractUsingSismoLib
            .connect(account2Signer)
            .testOnlyBadgesHoldersWithOnlyOneBadgeRequiredModifier([badgeId, badgeId2])
        ).to.be.revertedWith('UserDoesNotMeetRequirements()');
      });

      it('should pass if user has one badge (we test with the second badge)', async () => {
        let evmSnapshotId = await evmSnapshot(hre);
        await mintBadge({
          sources: [account1],
          destination: account2,
          group: groups[1], // we mint badge with badgeId2
          value: BigNumber.from(2), // claimed value for badge with badgeId2
          provingScheme,
        });

        await testBalanceIncrease(
          account2Signer,
          'testOnlyBadgesHoldersWithOnlyOneBadgeRequiredModifier',
          [[badgeId, badgeId2]]
        );

        await evmRevert(hre, evmSnapshotId);
      });
    });

    describe('onlyBadgeHoldersWithGreaterBalanceModifier', async () => {
      it('should revert if the user has no badge', async () => {
        // 0x2 should not hold badge yet
        await checkAccountHoldsBadge(account2Signer.address, badgeId, false);
        await expect(
          mockContractUsingSismoLib
            .connect(account2Signer)
            .testOnlyBadgeHoldersWithGreaterBalanceModifier()
        ).to.be.revertedWith('UserDoesNotMeetRequirements()');
      });

      it('should revert if the user has badge but balance is not greater', async () => {
        evmSnapshotId = await evmSnapshot(hre);
        await mintBadge({
          sources: [account1],
          destination: account2,
          provingScheme,
        });

        await expect(
          mockContractUsingSismoLib
            .connect(account2Signer)
            .testOnlyBadgeHoldersWithGreaterBalanceModifier()
        ).to.be.revertedWith('UserDoesNotMeetRequirements()');
        await evmRevert(hre, evmSnapshotId);
      });

      it('should pass if user has badge and balance is greater', async () => {
        evmSnapshotId = await evmSnapshot(hre);
        await mintBadge({
          sources: [account2], // we mint badge with account2 as source to have balance of 2
          destination: account3,
          provingScheme,
        });

        await testBalanceIncrease(account3Signer, 'testOnlyBadgeHoldersWithGreaterBalanceModifier');

        await evmRevert(hre, evmSnapshotId);
      });
    });

    describe('onlyBadgeHoldersWithLowerBalanceModifier', async () => {
      it('should revert if the user has no badge', async () => {
        // 0x2 should not hold badge yet
        await checkAccountHoldsBadge(account2Signer.address, badgeId, false);
        await expect(
          mockContractUsingSismoLib
            .connect(account2Signer)
            .testOnlyBadgeHoldersWithLowerBalanceModifier()
        ).to.be.revertedWith('UserDoesNotMeetRequirements()');
      });

      it('should revert if the user has badge but balance is not lower', async () => {
        evmSnapshotId = await evmSnapshot(hre);
        await mintBadge({
          sources: [account3], // we mint badge with account3 as source to have balance of 3
          destination: account1,
          provingScheme,
        });

        await expect(
          mockContractUsingSismoLib
            .connect(account1Signer)
            .testOnlyBadgeHoldersWithLowerBalanceModifier()
        ).to.be.revertedWith('UserDoesNotMeetRequirements()');
        await evmRevert(hre, evmSnapshotId);
      });

      it('should pass if user has badge and balance is lower', async () => {
        evmSnapshotId = await evmSnapshot(hre);
        await mintBadge({
          sources: [account2],
          destination: account1,
          provingScheme,
        });

        await testBalanceIncrease(account1Signer, 'testOnlyBadgeHoldersWithLowerBalanceModifier');

        await evmRevert(hre, evmSnapshotId);
      });
    });

    describe('onlyBadgeHoldersWithExactBalanceModifier', async () => {
      it('should revert if the user has no badge', async () => {
        // 0x2 should not hold badge yet
        await checkAccountHoldsBadge(account2Signer.address, badgeId, false);
        await expect(
          mockContractUsingSismoLib
            .connect(account2Signer)
            .testOnlyBadgeHoldersWithExactBalanceModifier()
        ).to.be.revertedWith('UserDoesNotMeetRequirements()');
      });

      it('should revert if the user has badge but balance is not exact', async () => {
        evmSnapshotId = await evmSnapshot(hre);
        await mintBadge({
          sources: [account2], // we mint badge with account2 as source to have balance of 2
          destination: account1,
          provingScheme,
        });

        await expect(
          mockContractUsingSismoLib
            .connect(account1Signer)
            .testOnlyBadgeHoldersWithExactBalanceModifier()
        ).to.be.revertedWith('UserDoesNotMeetRequirements()');
        await evmRevert(hre, evmSnapshotId);
      });

      it('should pass if user has badge and balance is exact', async () => {
        evmSnapshotId = await evmSnapshot(hre);
        await mintBadge({
          sources: [account1], // we mint badge with account1 as source to have balance of 1
          destination: account1,
          provingScheme,
        });

        await testBalanceIncrease(account1Signer, 'testOnlyBadgeHoldersWithExactBalanceModifier');

        await evmRevert(hre, evmSnapshotId);
      });
    });

    describe('onlyBadgesHoldersWithGreaterBalanceAndAllBadgesRequiredModifier', async () => {
      it('should revert if the user has no badge', async () => {
        // 0x2 should not hold badge yet
        await checkAccountHoldsBadge(account2Signer.address, badgeId, false);
        await expect(
          mockContractUsingSismoLib
            .connect(account2Signer)
            .testOnlyBadgesHoldersWithGreaterBalanceAndAllBadgesRequiredModifier(
              [badgeId, badgeId2],
              [2, 2]
            )
        ).to.be.revertedWith(`UserDoesNotMeetAllRequirements(${badgeId}, 2)`);
      });

      it('should revert if the user has only one badge with a valid balance', async () => {
        evmSnapshotId = await evmSnapshot(hre);
        await mintBadge({
          sources: [account2],
          destination: account3,
          provingScheme,
        });

        await expect(
          mockContractUsingSismoLib
            .connect(account3Signer)
            .testOnlyBadgesHoldersWithGreaterBalanceAndAllBadgesRequiredModifier(
              [badgeId, badgeId2],
              [2, 2]
            )
        ).to.be.revertedWith(`UserDoesNotMeetAllRequirements(${badgeId2}, 2)`);
        await evmRevert(hre, evmSnapshotId);
      });

      it('should revert if the user has both badges but one balance is not greater', async () => {
        evmSnapshotId = await evmSnapshot(hre);
        // we mint badge with account2 as source to have balance of 2
        // badgeId is required to have balance of 2 -> should pass
        await mintBadge({
          sources: [account2],
          destination: account3,
          provingScheme,
        });

        // badgeId2 is required to have balance of 2 -> should fail
        await mintBadge({
          sources: [account1],
          destination: account3,
          group: groups[1], // groups[1] refers to badgeId2
          provingScheme,
        });

        await expect(
          mockContractUsingSismoLib
            .connect(account3Signer)
            .testOnlyBadgesHoldersWithGreaterBalanceAndAllBadgesRequiredModifier(
              [badgeId, badgeId2],
              [2, 2]
            )
        ).to.be.revertedWith(`UserDoesNotMeetAllRequirements(${badgeId2}, 2)`);
        await evmRevert(hre, evmSnapshotId);
      });

      it('should pass if user has both badges and both balance is greater', async () => {
        evmSnapshotId = await evmSnapshot(hre);
        // we mint badge with account2 as source to have balance of 2
        // badgeId is required to have balance of 2 -> should pass
        await mintBadge({
          sources: [account2],
          destination: account3,
          provingScheme,
        });

        // badgeId2 is required to have balance of 2 -> should pass
        await mintBadge({
          sources: [account2],
          destination: account3,
          group: groups[1], // groups[1] refers to badgeId2
          provingScheme,
        });

        await testBalanceIncrease(
          account3Signer,
          'testOnlyBadgesHoldersWithGreaterBalanceAndAllBadgesRequiredModifier',
          [
            [badgeId, badgeId2],
            [2, 2],
          ]
        );

        await evmRevert(hre, evmSnapshotId);
      });
    });

    describe('onlyBadgesHoldersWithGreaterBalanceAndOnlyOneBadgeRequiredModifier', async () => {
      it('should revert if the user has no badge', async () => {
        // 0x2 should not hold badge yet
        await checkAccountHoldsBadge(account2Signer.address, badgeId, false);
        await expect(
          mockContractUsingSismoLib
            .connect(account2Signer)
            .testOnlyBadgesHoldersWithGreaterBalanceAndOnlyOneBadgeRequiredModifier(
              [badgeId, badgeId2],
              [2, 2]
            )
        ).to.be.revertedWith('UserDoesNotMeetRequirements()');
      });

      it('should revert if the user has only one badge and the balance is not greater', async () => {
        evmSnapshotId = await evmSnapshot(hre);
        // we mint badge with account1 as source to have balance of 1
        // badgeId is required to have balance of 2 -> should fail
        await mintBadge({
          sources: [account1],
          destination: account3,
          provingScheme,
        });

        await expect(
          mockContractUsingSismoLib
            .connect(account3Signer)
            .testOnlyBadgesHoldersWithGreaterBalanceAndOnlyOneBadgeRequiredModifier(
              [badgeId, badgeId2],
              [2, 2]
            )
        ).to.be.revertedWith(`UserDoesNotMeetRequirements()`);
        await evmRevert(hre, evmSnapshotId);
      });

      it('should revert if the user has both badges but balances are not greater', async () => {
        evmSnapshotId = await evmSnapshot(hre);
        // we mint badge with account1 as source to have balance of 1
        // badgeId is required to have balance of 2 -> should fail
        await mintBadge({
          sources: [account1],
          destination: account3,
          provingScheme,
        });

        // badgeId2 is required to have balance of 2 -> should fail
        await mintBadge({
          sources: [account1],
          destination: account3,
          group: groups[1], // groups[1] refers to badgeId2
          provingScheme,
        });

        await expect(
          mockContractUsingSismoLib
            .connect(account3Signer)
            .testOnlyBadgesHoldersWithGreaterBalanceAndOnlyOneBadgeRequiredModifier(
              [badgeId, badgeId2],
              [2, 2]
            )
        ).to.be.revertedWith('UserDoesNotMeetRequirements()');
        await evmRevert(hre, evmSnapshotId);
      });

      it('should pass if user has one badge and the balance is greater', async () => {
        evmSnapshotId = await evmSnapshot(hre);
        // we mint badge with account2 as source to have balance of 2
        // badgeId is required to have balance of 2 -> should pass
        await mintBadge({
          sources: [account2],
          destination: account3,
          provingScheme,
        });

        await testBalanceIncrease(
          account3Signer,
          'testOnlyBadgesHoldersWithGreaterBalanceAndOnlyOneBadgeRequiredModifier',
          [
            [badgeId, badgeId2],
            [2, 2],
          ]
        );

        await evmRevert(hre, evmSnapshotId);
      });
    });

    describe('onlyBadgesHoldersWithLowerBalanceAndAllBadgesRequiredModifier', async () => {
      it('should revert if the user has no badge', async () => {
        // 0x2 should not hold badge yet
        await checkAccountHoldsBadge(account2Signer.address, badgeId, false);
        await expect(
          mockContractUsingSismoLib
            .connect(account2Signer)
            .testOnlyBadgesHoldersWithLowerBalanceAndAllBadgesRequiredModifier(
              [badgeId, badgeId2],
              [2, 2]
            )
        ).to.be.revertedWith(`UserDoesNotMeetAllRequirements(${badgeId}, 2)`);
      });

      it('should revert if the user has only one badge and the balance is not lower', async () => {
        evmSnapshotId = await evmSnapshot(hre);
        // we mint badge with account3 as source to have balance of 3
        // badgeId is required to have balance of 2 -> should fail
        await mintBadge({
          sources: [account3],
          destination: account3,
          provingScheme,
        });

        await expect(
          mockContractUsingSismoLib
            .connect(account3Signer)
            .testOnlyBadgesHoldersWithLowerBalanceAndAllBadgesRequiredModifier(
              [badgeId, badgeId2],
              [2, 2]
            )
        ).to.be.revertedWith(`UserDoesNotMeetAllRequirements(${badgeId}, 2)`);
        await evmRevert(hre, evmSnapshotId);
      });

      it('should revert if the user has only one badge and the balance is valid', async () => {
        evmSnapshotId = await evmSnapshot(hre);
        // we mint badge with account1 as source to have balance of 1
        await mintBadge({
          sources: [account1],
          destination: account3,
          provingScheme,
        });

        await expect(
          mockContractUsingSismoLib
            .connect(account3Signer)
            .testOnlyBadgesHoldersWithLowerBalanceAndAllBadgesRequiredModifier(
              [badgeId, badgeId2],
              [2, 2]
            )
        ).to.be.revertedWith(`UserDoesNotMeetAllRequirements(${badgeId2}, 2)`);
        await evmRevert(hre, evmSnapshotId);
      });

      it('should revert if the user has both badges but one balance is not lower', async () => {
        evmSnapshotId = await evmSnapshot(hre);
        // we mint badge with account1 as source to have balance of 1
        // badgeId is required to have balance of 2 -> should pass
        await mintBadge({
          sources: [account1],
          destination: account3,
          provingScheme,
        });

        // badgeId2 is required to have balance of 2 -> should fail
        await mintBadge({
          sources: [account3],
          destination: account3,
          group: groups[1], // groups[1] refers to badgeId2
          provingScheme,
        });

        await expect(
          mockContractUsingSismoLib
            .connect(account3Signer)
            .testOnlyBadgesHoldersWithLowerBalanceAndAllBadgesRequiredModifier(
              [badgeId, badgeId2],
              [2, 2]
            )
        ).to.be.revertedWith(`UserDoesNotMeetAllRequirements(${badgeId2}, 2)`);
        await evmRevert(hre, evmSnapshotId);
      });

      it('should pass if user has both badges and the balances are lower', async () => {
        evmSnapshotId = await evmSnapshot(hre);
        // we mint badge with account1 as source to have balance of 1
        // badgeId is required to have balance of 2 -> should pass
        await mintBadge({
          sources: [account1],
          destination: account3,
          provingScheme,
        });

        // badgeId2 is required to have balance of 2 -> should pass
        await mintBadge({
          sources: [account1],
          destination: account3,
          group: groups[1], // groups[1] refers to badgeId2
          provingScheme,
        });

        await testBalanceIncrease(
          account3Signer,
          'testOnlyBadgesHoldersWithLowerBalanceAndAllBadgesRequiredModifier',
          [
            [badgeId, badgeId2],
            [2, 2],
          ]
        );
        await evmRevert(hre, evmSnapshotId);
      });
    });

    describe('onlyBadgesHoldersWithLowerBalanceAndOnlyOneBadgeRequiredModifier', async () => {
      it('should revert if the user has no badge', async () => {
        // 0x2 should not hold badge yet
        await checkAccountHoldsBadge(account2Signer.address, badgeId, false);
        await expect(
          mockContractUsingSismoLib
            .connect(account2Signer)
            .testOnlyBadgesHoldersWithLowerBalanceAndOnlyOneBadgeRequiredModifier(
              [badgeId, badgeId2],
              [2, 2]
            )
        ).to.be.revertedWith('UserDoesNotMeetRequirements()');
      });

      it('should revert if the user has only one badge and the balance is not lower', async () => {
        evmSnapshotId = await evmSnapshot(hre);
        // we mint badge with account3 as source to have balance of 3
        // badgeId is required to have balance of 2 -> should fail
        await mintBadge({
          destination: account3,
          provingScheme,
        });

        await expect(
          mockContractUsingSismoLib
            .connect(account3Signer)
            .testOnlyBadgesHoldersWithLowerBalanceAndOnlyOneBadgeRequiredModifier(
              [badgeId, badgeId2],
              [2, 2]
            )
        ).to.be.revertedWith('UserDoesNotMeetRequirements()');
        await evmRevert(hre, evmSnapshotId);
      });

      it('should revert if the user has both badges and both balances are not lower', async () => {
        evmSnapshotId = await evmSnapshot(hre);
        // we mint badge with account3 as source to have balance of 3
        // badgeId is required to have balance of 2 -> should fail
        await mintBadge({
          destination: account3,
          provingScheme,
        });

        // badgeId2 is required to have balance of 2 -> should fail
        await mintBadge({
          destination: account3,
          group: groups[1], // groups[1] refers to badgeId2
          provingScheme,
        });

        await expect(
          mockContractUsingSismoLib
            .connect(account3Signer)
            .testOnlyBadgesHoldersWithLowerBalanceAndOnlyOneBadgeRequiredModifier(
              [badgeId, badgeId2],
              [2, 2]
            )
        ).to.be.revertedWith('UserDoesNotMeetRequirements()');
        await evmRevert(hre, evmSnapshotId);
      });

      it('should pass if the user has only one badge and the balance is valid', async () => {
        evmSnapshotId = await evmSnapshot(hre);
        // we mint badge with account1 as source to have balance of 1
        await mintBadge({
          sources: [account1],
          destination: account3,
          provingScheme,
        });

        await testBalanceIncrease(
          account3Signer,
          'testOnlyBadgesHoldersWithLowerBalanceAndOnlyOneBadgeRequiredModifier',
          [
            [badgeId, badgeId2],
            [2, 2],
          ]
        );
        await evmRevert(hre, evmSnapshotId);
      });
    });

    describe('onlyBadgesHoldersWithExactBalanceAndAllBadgesRequiredModifier', async () => {
      it('should revert if the user has no badge', async () => {
        // 0x2 should not hold badge yet
        await checkAccountHoldsBadge(account2Signer.address, badgeId, false);
        await expect(
          mockContractUsingSismoLib
            .connect(account2Signer)
            .testOnlyBadgesHoldersWithExactBalanceAndAllBadgesRequiredModifier(
              [badgeId, badgeId2],
              [2, 2]
            )
        ).to.be.revertedWith(`UserDoesNotMeetAllRequirements(${badgeId}, 2)`);
      });

      it('should revert if the user has only one badge and the balance is not exact', async () => {
        evmSnapshotId = await evmSnapshot(hre);
        // we mint badge with account3 as source to have balance of 3
        // badgeId is required to have balance of 2 -> should fail
        await mintBadge({
          destination: account3,
          provingScheme,
        });

        await expect(
          mockContractUsingSismoLib
            .connect(account3Signer)
            .testOnlyBadgesHoldersWithExactBalanceAndAllBadgesRequiredModifier(
              [badgeId, badgeId2],
              [2, 2]
            )
        ).to.be.revertedWith(`UserDoesNotMeetAllRequirements(${badgeId}, 2)`);
        await evmRevert(hre, evmSnapshotId);
      });

      it('should revert if the user has both badges and both balances are not exact', async () => {
        evmSnapshotId = await evmSnapshot(hre);
        // we mint badge with account3 as source to have balance of 3
        // badgeId is required to have balance of 2 -> should fail
        await mintBadge({
          destination: account3,
          provingScheme,
        });

        // badgeId2 is required to have balance of 2 -> should fail
        await mintBadge({
          destination: account3,
          group: groups[1], // groups[1] refers to badgeId2
          provingScheme,
        });

        await expect(
          mockContractUsingSismoLib
            .connect(account3Signer)
            .testOnlyBadgesHoldersWithExactBalanceAndAllBadgesRequiredModifier(
              [badgeId, badgeId2],
              [2, 2]
            )
        ).to.be.revertedWith(`UserDoesNotMeetAllRequirements(${badgeId}, 2)`);
        await evmRevert(hre, evmSnapshotId);
      });

      it('should revert if the user has both badges and one balance is not exact', async () => {
        evmSnapshotId = await evmSnapshot(hre);
        // we mint badge with account3 as source to have balance of 3
        // badgeId is required to have balance of 2 -> should fail
        await mintBadge({
          destination: account3,
          provingScheme,
        });

        // badgeId2 is required to have balance of 2 -> should fail
        await mintBadge({
          destination: account3,
          group: groups[1], // groups[1] refers to badgeId2
          provingScheme,
        });

        await expect(
          mockContractUsingSismoLib
            .connect(account3Signer)
            .testOnlyBadgesHoldersWithExactBalanceAndAllBadgesRequiredModifier(
              [badgeId, badgeId2],
              [2, 2]
            )
        ).to.be.revertedWith(`UserDoesNotMeetAllRequirements(${badgeId}, 2)`);
        await evmRevert(hre, evmSnapshotId);
      });

      it('should pass if the user has both badges and both balances are exact', async () => {
        evmSnapshotId = await evmSnapshot(hre);
        // we mint badge with account2 as source to have balance of 2
        // badgeId is required to have balance of 2 -> should pass
        await mintBadge({
          destination: account2,
          provingScheme,
        });

        // badgeId2 is required to have balance of 2 -> should pass
        await mintBadge({
          destination: account2,
          group: groups[1], // groups[1] refers to badgeId2
          provingScheme,
        });

        await testBalanceIncrease(
          account2Signer,
          'testOnlyBadgesHoldersWithExactBalanceAndAllBadgesRequiredModifier',
          [
            [badgeId, badgeId2],
            [2, 2],
          ]
        );
        await evmRevert(hre, evmSnapshotId);
      });
    });

    describe('onlyBadgesHoldersWithExactBalanceAndOnlyOneBadgeRequiredModifier', async () => {
      it('should revert if the user has no badge', async () => {
        // 0x2 should not hold badge yet
        await checkAccountHoldsBadge(account2Signer.address, badgeId, false);
        await expect(
          mockContractUsingSismoLib
            .connect(account2Signer)
            .testOnlyBadgesHoldersWithExactBalanceAndOnlyOneBadgeRequiredModifier(
              [badgeId, badgeId2],
              [2, 2]
            )
        ).to.be.revertedWith('UserDoesNotMeetRequirements()');
      });

      it('should revert if the user has only one badge and the balance is not exact', async () => {
        evmSnapshotId = await evmSnapshot(hre);
        // we mint badge with account1 as source to have balance of 1
        // badgeId is required to have balance of 2 -> should fail
        await mintBadge({
          destination: account1,
          provingScheme,
        });

        await expect(
          mockContractUsingSismoLib
            .connect(account3Signer)
            .testOnlyBadgesHoldersWithExactBalanceAndOnlyOneBadgeRequiredModifier(
              [badgeId, badgeId2],
              [2, 2]
            )
        ).to.be.revertedWith('UserDoesNotMeetRequirements()');
        await evmRevert(hre, evmSnapshotId);
      });

      it('should pass if the user has only one badge and the balance is exact', async () => {
        evmSnapshotId = await evmSnapshot(hre);
        // we mint badge with account2 as source to have balance of 2
        // badgeId is required to have balance of 2 -> should pass
        await mintBadge({
          destination: account2,
          group: groups[1], // groups[1] refers to badgeId2
          provingScheme,
        });

        await testBalanceIncrease(
          account2Signer,
          'testOnlyBadgesHoldersWithExactBalanceAndOnlyOneBadgeRequiredModifier',
          [
            [badgeId, badgeId2],
            [2, 2],
          ]
        );
        await evmRevert(hre, evmSnapshotId);
      });
    });
  });
});
