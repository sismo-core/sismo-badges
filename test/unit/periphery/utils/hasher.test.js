const { expect } = require('chai');
const hasherContract = require('../../../../build/Hasher.json');

describe('IncrementalMerkleTree contract', () => {
  let Hasher, hasher;

  beforeEach(async () => {
    Hasher = await ethers.getContractFactory(hasherContract.abi, hasherContract.bytecode);
    hasher = await Hasher.deploy();
  });

  describe('Deployment', () => {
    it('should successfully deploy contracts', async () => {
      const address = await hasher.address;

      expect(address).not.to.equal('');
      expect(address).not.to.equal(undefined);
      expect(address).not.to.equal(null);
      expect(address).not.to.equal(0x0);
    });
  });

  describe('Poseidon hash', () => {
    it('should hash correctly some key value pairs', async () => {
      let res = await hasher['poseidon(uint256[2])']([
        '0xa76f290c490c70f2d816d286efe47fd64a35800b',
        '0x01',
      ]);
      expect(res).to.equal('0x1399c190aeeddc5d8b2242ab17f97b42631bb0b7877e92b92c3be2ec5685a6a1');

      res = await hasher['poseidon(uint256[2])']([
        '0x0085560b24769dac4ed057f1b2ae40746aa9aab6',
        '0x01',
      ]);
      expect(res).to.equal('0x0928369eb910e972be21ce00310d5d3544718bb02979f49d13b704759f2d888e');

      res = await hasher['poseidon(uint256[2])']([
        '0x0294350d7cf2c145446358b6461c1610927b3a87',
        '0x01',
      ]);
      expect(res).to.equal('0x086ead858855392bb66e138a5bb841e85aa2bae6cc4feacd41ea1c63c7ae173f');
    });
  });
});
