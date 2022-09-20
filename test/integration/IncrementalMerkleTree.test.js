const { expect } = require('chai');
const hasherContract = require('../../build/Hasher.json');

const NUMBER_OF_HISTORICAL_ROOTS = 1;

// this object contains the test data obtained via the sismo kv-merkle-tree implementation. You can find it here:
// https://github.com/sismo-core/sismo-utils/tree/main/packages/kv-merkle-tree
const dataMerkleTree = {
  emptyTree: {
    numberOfLevels: 2,
    root: '0x1069673dcdb12263df301a6ff584a7ec261a44cb9dc68df067a4774460b1f1e1',
  },
  partiallyFilledTree: {
    numberOfLevels: 2,
    leaves: {
      '0xa76f290c490c70f2d816d286efe47fd64a35800b': 1,
      '0x0085560b24769dac4ed057f1b2ae40746aa9aab6': 1,
      '0x0294350d7cf2c145446358b6461c1610927b3a87': 1,
    },
    root: '0x093052a99724638958f7952ca891283840d60496c76970e60dde029a3448b668',
  },
  filledTree: {
    numberOfLevels: 4,
    leaves: {
      '0xa76f290c490c70f2d816d286efe47fd64a35800b': 1,
      '0x0085560b24769dac4ed057f1b2ae40746aa9aab6': 1,
      '0x0294350d7cf2c145446358b6461c1610927b3a87': 1,
      '0x4f9c798553d207536b79e886b54f169264a7a155': 1,
      '0xa1b04c9cbb449d13c4fc29c7e6be1f810e6f35e9': 1,
      '0xad9fbd38281f615e7df3def2aad18935a9e0ffee': 1,
      '0x0783094aadfb8ae9915fd712d28664c8d7d26afa': 1,
      '0xe860947813c207abf9bf6722c49cda515d24971a': 1,
      '0x8bffc896d42f07776561a5814d6e4240950d6d3a': 1,
      '0x4a9a2f31e2009045950df5aab36950609de93c78': 1,
      '0x8ab1760889f26cbbf33a75fd2cf1696bfccdc9e6': 1,
      '0xf61cabba1e6fc166a66bca0fcaa83762edb6d4bd': 1,
      '0x97d0bc262dfc2fbe2e6c62883a669e765fe3d83e': 1,
      '0x74184bff3cf29e82e4d8cb3b7f1d5a89fdd0eb15': 1,
      '0x26bbec292e5080ecfd36f38ff1619ff35826b113': 1,
      '0x8867c12738f4ca3b530afe7efc7ac4ee1d286cbc': 1,
    },
    root: '4047207450062892694258929318783786787130166100928326367429339529679014639025',
  },
};

describe('IncrementalMerkleTree contract', () => {
  let IncrementalMerkleTree, incrementalMerkleTree;
  let Hasher, hasher;

  beforeEach(async () => {
    Hasher = await ethers.getContractFactory(hasherContract.abi, hasherContract.bytecode);
    hasher = await Hasher.deploy();
    IncrementalMerkleTree = await ethers.getContractFactory('IncrementalMerkleTree');
  });

  // it should be compliant with this library: https://github.com/sismo-core/sismo-utils/tree/main/packages/kv-merkle-tree
  describe('kv-merkle-tree compliancy', () => {
    it('should return the same root as the library for an empty tree with 2 levels', async () => {
      incrementalMerkleTree = await IncrementalMerkleTree.deploy(
        dataMerkleTree.emptyTree.numberOfLevels,
        NUMBER_OF_HISTORICAL_ROOTS,
        hasher.address
      );

      // we retrieve the root and compare it to the one we got from the kv-merkle-tree library
      const root = await incrementalMerkleTree.getLastRoot();
      expect(root).to.equal(dataMerkleTree.emptyTree.root);
    });

    it('should return the same root as the library for a partially filled tree with 2 levels', async () => {
      incrementalMerkleTree = await IncrementalMerkleTree.deploy(
        dataMerkleTree.partiallyFilledTree.numberOfLevels,
        NUMBER_OF_HISTORICAL_ROOTS,
        hasher.address
      );

      await addKeyValuesToTheIncrementalMerkleTree(dataMerkleTree.partiallyFilledTree.leaves);

      // we retrieve the root and compare it to the one we got from the kv-merkle-tree library
      const root = await incrementalMerkleTree.getLastRoot();
      expect(root).to.equal(dataMerkleTree.partiallyFilledTree.root);
    });

    it('should return the same root as the library when filling the tree', async () => {
      incrementalMerkleTree = await IncrementalMerkleTree.deploy(
        dataMerkleTree.filledTree.numberOfLevels,
        NUMBER_OF_HISTORICAL_ROOTS,
        hasher.address
      );

      await addKeyValuesToTheIncrementalMerkleTree(dataMerkleTree.filledTree.leaves);

      // we retrieve the root and compare it to the one we got from the kv-merkle-tree library
      const root = await incrementalMerkleTree.getLastRoot();
      expect(root).to.equal(dataMerkleTree.filledTree.root);
    });
  });

  /**
   * Add the key value leaves passed in param to the incremental merkle tree contract
   * @param {{key: string, value: string}[]} kvLeaves
   */
  const addKeyValuesToTheIncrementalMerkleTree = async (kvLeaves) => {
    const leaves = [];

    // we compute the key values hashes of the dataMerkleTree
    await Promise.all(
      Object.keys(kvLeaves).map(async (account) => {
        leaves.push(await hasher['poseidon(uint256[2])']([account, kvLeaves[account]]));
      })
    );

    // we add all the computed values in the incremental merkle tree
    await Promise.all(
      leaves.map(async (leaf) => {
        await incrementalMerkleTree.addLeaf(leaf);
      })
    );
  };
});
