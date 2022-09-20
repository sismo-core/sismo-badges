const { expect } = require('chai');
const hasherContract = require('../../../../build/Hasher.json');

const NUMBER_OF_LEVEL = 4;
const NUMBER_OF_HISTORICAL_ROOTS = 3;

describe('IncrementalMerkleTree contract', () => {
  let IncrementalMerkleTree, incrementalMerkleTree;
  let Hasher, hasher;

  beforeEach(async () => {
    Hasher = await ethers.getContractFactory(hasherContract.abi, hasherContract.bytecode);
    hasher = await Hasher.deploy();
    IncrementalMerkleTree = await ethers.getContractFactory('IncrementalMerkleTree');
    incrementalMerkleTree = await IncrementalMerkleTree.deploy(
      NUMBER_OF_LEVEL,
      NUMBER_OF_HISTORICAL_ROOTS,
      hasher.address
    );
  });

  describe('Deployment', () => {
    it('should successfully deploy contracts', async () => {
      const address = await incrementalMerkleTree.address;

      expect(address).not.to.equal('');
      expect(address).not.to.equal(undefined);
      expect(address).not.to.equal(null);
      expect(address).not.to.equal(0x0);
    });

    it('should set the number of levels passed in the constructor', async () => {
      const nbLevels = await incrementalMerkleTree.levels();
      expect(nbLevels).to.equal(NUMBER_OF_LEVEL);
    });

    it('should set the number of historical roots passed in the constructor', async () => {
      const rootHistorySize = await incrementalMerkleTree.rootHistorySize();
      expect(rootHistorySize).to.equal(NUMBER_OF_HISTORICAL_ROOTS);
    });

    it('should revert when passing wrong values to the constructor', async () => {
      // levels should be between 1 and 32
      await expect(
        IncrementalMerkleTree.deploy(0, NUMBER_OF_HISTORICAL_ROOTS, hasher.address)
      ).to.be.revertedWith('_levels should be greater than zero');
      await expect(
        IncrementalMerkleTree.deploy(33, NUMBER_OF_HISTORICAL_ROOTS, hasher.address)
      ).to.be.revertedWith('_levels should be equal to or less than 32');

      // number of historical root should be between 1 and 2^32
      await expect(
        IncrementalMerkleTree.deploy(NUMBER_OF_LEVEL, 0, hasher.address)
      ).to.be.revertedWith('_rootHistorySize should be greater than zero');
    });
  });

  describe('Leaves and roots', () => {
    it('should add leaves and emit events', async () => {
      const tx = await incrementalMerkleTree.addLeaf(123);
      await expect(tx).to.emit(incrementalMerkleTree, 'LeafAdded').withArgs(0);
      const tx2 = await incrementalMerkleTree.addLeaf(456);
      await expect(tx2).to.emit(incrementalMerkleTree, 'LeafAdded').withArgs(1);
    });

    it('should revert when adding more leaves than authorized', async () => {
      for (let i = 0; i < 2 ** NUMBER_OF_LEVEL; i++) {
        await incrementalMerkleTree.addLeaf(123);
      }
      await expect(incrementalMerkleTree.addLeaf(123)).to.be.revertedWith(
        'Merkle tree is full. No more leaves can be added'
      );
    });

    it("should not find a root that isn't in the history", async () => {
      const isKnownRoot = await incrementalMerkleTree.isKnownRoot('0x123');
      expect(isKnownRoot).to.be.false;
    });

    it('should keep in the history exactly NUMBER_OF_HISTORICAL_ROOTS roots', async () => {
      const dummyLeafValue = 0x123;
      const roots = [];
      let i;
      for (i = 0; i < NUMBER_OF_HISTORICAL_ROOTS; i++) {
        await incrementalMerkleTree.addLeaf(dummyLeafValue);
        roots.push(await incrementalMerkleTree.getLastRoot());
      }

      for (i = 0; i < roots.length; i++) {
        const isKnownRoot = await incrementalMerkleTree.isKnownRoot(roots[i]);
        expect(isKnownRoot).to.be.true;
      }

      await incrementalMerkleTree.addLeaf(dummyLeafValue);
      roots.push(await incrementalMerkleTree.getLastRoot());

      isKnownRoot = await incrementalMerkleTree.isKnownRoot(roots[0]);
      expect(isKnownRoot).to.be.false;

      for (i = 1; i < roots.length; i++) {
        const isKnownRoot = await incrementalMerkleTree.isKnownRoot(roots[i]);
        expect(isKnownRoot).to.be.true;
      }
    });

    it('should initialize the tree with leaves equal to 0x0', async () => {
      let prevLevelHash = await hasher['poseidon(uint256[2])'](['0x0', '0x0']);
      // we deploy contracts with levels that go from 1 to 32, and we check that the tree is initialized as expected.
      for (let i = 1; i <= 32; i++) {
        incrementalMerkleTree = await IncrementalMerkleTree.deploy(
          i,
          NUMBER_OF_HISTORICAL_ROOTS,
          hasher.address
        );
        const root = await incrementalMerkleTree.getLastRoot();
        expect(root).to.equal(prevLevelHash);
        prevLevelHash = await hasher['poseidon(uint256[2])']([prevLevelHash, prevLevelHash]);
      }
    });

    it("should not accept a leaf which isn't inside the scalar field", async () => {
      const aboveScalarField =
        '21888242871839275222246405745257275088548364400416034343698204186575808495618';
      const belowScalarField =
        '21888242871839275222246405745257275088548364400416034343698204186575808495616';
      await expect(incrementalMerkleTree.addLeaf(aboveScalarField)).to.be.revertedWith(
        '_left should be inside the SNARK field'
      );

      // then, we add a leaf that is above the scalar field
      await incrementalMerkleTree.addLeaf(belowScalarField);

      await expect(incrementalMerkleTree.addLeaf(aboveScalarField)).to.be.revertedWith(
        '_right should be inside the SNARK field'
      );
    });
  });
});
