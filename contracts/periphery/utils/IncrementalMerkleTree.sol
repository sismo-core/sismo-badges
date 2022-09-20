// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IIncrementalMerkleTree} from './interfaces/IIncrementalMerkleTree.sol';

interface IHasher {
  function poseidon(uint256[2] memory) external pure returns (uint256);
}

contract IncrementalMerkleTree is IIncrementalMerkleTree {
  uint256 public constant SNARK_SCALAR_FIELD =
    21888242871839275222246405745257275088548364400416034343698204186575808495617;

  // The tree depth
  uint32 public immutable levels;

  // The Merkle root
  uint256 public root;

  // The number of historical roots we want to keep
  uint32 public immutable rootHistorySize;

  // hasher contract instance that computes poseidon hashes
  IHasher public immutable hasher;

  // filledSubtrees and roots could be bytes32[size], but using mappings makes it cheaper because
  // it removes index range check on every interaction
  // filledSubtrees allows you to compute the new merkle root each time a leaf is added
  mapping(uint256 => uint256) public filledSubtrees;
  // contains the latest historical roots (capped to rootHistorySize)
  mapping(uint256 => uint256) public roots;

  // The number of inserted leaves
  uint32 private nextLeafIndex = 0;

  // The index of the current root in the roots mapping
  uint32 private currentRootIndex;

  constructor(
    uint32 _levels,
    uint32 _rootHistorySize,
    address _hasherAddress
  ) {
    require(_levels > 0, '_levels should be greater than zero');
    require(_levels <= 32, '_levels should be equal to or less than 32');
    require(_rootHistorySize > 0, '_rootHistorySize should be greater than zero');

    levels = _levels;
    rootHistorySize = _rootHistorySize;
    hasher = IHasher(_hasherAddress);

    // we initialize values as if the tree was filled with zeros
    for (uint32 i = 0; i < _levels; i++) {
      filledSubtrees[i] = zeros(i);
    }

    roots[0] = zeros(_levels);
  }

  /**
   * Hash the two values passed in param using the poseidon hash function. The values need to be less than the
   * SNARK_SCALAR_FIELD.
   * @param _left - the left value that to hash
   * @param _right - the right value that to hash
   * @return The value of hash(_left, _right)
   */
  function hashLeftRight(uint256 _left, uint256 _right) internal view returns (uint256) {
    require(_left < SNARK_SCALAR_FIELD, '_left should be inside the SNARK field');
    require(_right < SNARK_SCALAR_FIELD, '_right should be inside the SNARK field');
    uint256[2] memory inputs;
    inputs[0] = _left;
    inputs[1] = _right;

    return hasher.poseidon(inputs);
  }

  /**
   * Inserts a leaf to the incremental merkle tree
   * @param _leaf - The value to insert. It must be less than the snark scalar field or this function will throw.
   * @return The leaf index
   */
  function addLeaf(uint256 _leaf) public returns (uint256) {
    uint32 currentIndex = nextLeafIndex;

    require(currentIndex < uint32(2)**levels, 'Merkle tree is full. No more leaves can be added');

    uint256 currentLevelHash = _leaf;
    uint256 left;
    uint256 right;

    // compute the new merkle root
    for (uint32 i = 0; i < levels; i++) {
      if (currentIndex % 2 == 0) {
        left = currentLevelHash;
        right = zeros(i);
        filledSubtrees[i] = currentLevelHash;
      } else {
        left = filledSubtrees[i];
        right = currentLevelHash;
      }
      currentLevelHash = hashLeftRight(left, right);
      currentIndex /= 2;
    }

    currentRootIndex = (currentRootIndex + 1) % rootHistorySize;
    roots[currentRootIndex] = currentLevelHash;

    emit LeafAdded(nextLeafIndex);

    nextLeafIndex += 1;

    return currentIndex;
  }

  /**
   * Checks if a given root is in the recent history
   * @param _root - The root we are looking for
   * @return true if the _root is present in the root history, false otherwise
   */
  function isKnownRoot(uint256 _root) public view returns (bool) {
    if (_root == 0) {
      return false;
    }

    uint32 _currentRootIndex = currentRootIndex;
    uint32 i = _currentRootIndex;

    do {
      if (_root == roots[i]) {
        return true;
      }
      if (i == 0) {
        i = rootHistorySize;
      }
      i--;
    } while (i != _currentRootIndex);

    return false;
  }

  /**
   * @return the last root
   */
  function getLastRoot() public view returns (uint256) {
    return roots[currentRootIndex];
  }

  /**
   * @param i - The level of the hash we want
   * @return the value of the level hash if all the leaves are zeros.
   * e.g if i = 2, we return the root of this tree:
   *               VALUE_TO_RETURN = hash(x, y)
   *                 /         \
   *     x=hash(0x0, 0x0)  y=hash(0x0, 0x0)
   *          /     \         /     \
   *        0x0    0x0       0x0    0x0
   */
  function zeros(uint256 i) public pure returns (uint256) {
    if (i == 0) return uint256(0x0);
    else if (i == 1)
      return uint256(0x2098f5fb9e239eab3ceac3f27b81e481dc3124d55ffed523a839ee8446b64864);
    else if (i == 2)
      return uint256(0x1069673dcdb12263df301a6ff584a7ec261a44cb9dc68df067a4774460b1f1e1);
    else if (i == 3)
      return uint256(0x18f43331537ee2af2e3d758d50f72106467c6eea50371dd528d57eb2b856d238);
    else if (i == 4)
      return uint256(0x07f9d837cb17b0d36320ffe93ba52345f1b728571a568265caac97559dbc952a);
    else if (i == 5)
      return uint256(0x2b94cf5e8746b3f5c9631f4c5df32907a699c58c94b2ad4d7b5cec1639183f55);
    else if (i == 6)
      return uint256(0x2dee93c5a666459646ea7d22cca9e1bcfed71e6951b953611d11dda32ea09d78);
    else if (i == 7)
      return uint256(0x078295e5a22b84e982cf601eb639597b8b0515a88cb5ac7fa8a4aabe3c87349d);
    else if (i == 8)
      return uint256(0x2fa5e5f18f6027a6501bec864564472a616b2e274a41211a444cbe3a99f3cc61);
    else if (i == 9)
      return uint256(0x0e884376d0d8fd21ecb780389e941f66e45e7acce3e228ab3e2156a614fcd747);
    else if (i == 10)
      return uint256(0x1b7201da72494f1e28717ad1a52eb469f95892f957713533de6175e5da190af2);
    else if (i == 11)
      return uint256(0x1f8d8822725e36385200c0b201249819a6e6e1e4650808b5bebc6bface7d7636);
    else if (i == 12)
      return uint256(0x2c5d82f66c914bafb9701589ba8cfcfb6162b0a12acf88a8d0879a0471b5f85a);
    else if (i == 13)
      return uint256(0x14c54148a0940bb820957f5adf3fa1134ef5c4aaa113f4646458f270e0bfbfd0);
    else if (i == 14)
      return uint256(0x190d33b12f986f961e10c0ee44d8b9af11be25588cad89d416118e4bf4ebe80c);
    else if (i == 15)
      return uint256(0x22f98aa9ce704152ac17354914ad73ed1167ae6596af510aa5b3649325e06c92);
    else if (i == 16)
      return uint256(0x2a7c7c9b6ce5880b9f6f228d72bf6a575a526f29c66ecceef8b753d38bba7323);
    else if (i == 17)
      return uint256(0x2e8186e558698ec1c67af9c14d463ffc470043c9c2988b954d75dd643f36b992);
    else if (i == 18)
      return uint256(0x0f57c5571e9a4eab49e2c8cf050dae948aef6ead647392273546249d1c1ff10f);
    else if (i == 19)
      return uint256(0x1830ee67b5fb554ad5f63d4388800e1cfe78e310697d46e43c9ce36134f72cca);
    else if (i == 20)
      return uint256(0x2134e76ac5d21aab186c2be1dd8f84ee880a1e46eaf712f9d371b6df22191f3e);
    else if (i == 21)
      return uint256(0x19df90ec844ebc4ffeebd866f33859b0c051d8c958ee3aa88f8f8df3db91a5b1);
    else if (i == 22)
      return uint256(0x18cca2a66b5c0787981e69aefd84852d74af0e93ef4912b4648c05f722efe52b);
    else if (i == 23)
      return uint256(0x2388909415230d1b4d1304d2d54f473a628338f2efad83fadf05644549d2538d);
    else if (i == 24)
      return uint256(0x27171fb4a97b6cc0e9e8f543b5294de866a2af2c9c8d0b1d96e673e4529ed540);
    else if (i == 25)
      return uint256(0x2ff6650540f629fd5711a0bc74fc0d28dcb230b9392583e5f8d59696dde6ae21);
    else if (i == 26)
      return uint256(0x120c58f143d491e95902f7f5277778a2e0ad5168f6add75669932630ce611518);
    else if (i == 27)
      return uint256(0x1f21feb70d3f21b07bf853d5e5db03071ec495a0a565a21da2d665d279483795);
    else if (i == 28)
      return uint256(0x24be905fa71335e14c638cc0f66a8623a826e768068a9e968bb1a1dde18a72d2);
    else if (i == 29)
      return uint256(0x0f8666b62ed17491c50ceadead57d4cd597ef3821d65c328744c74e553dac26d);
    else if (i == 30)
      return uint256(0x0918d46bf52d98b034413f4a1a1c41594e7a7a3f6ae08cb43d1a2a230e1959ef);
    else if (i == 31)
      return uint256(0x1bbeb01b4c479ecde76917645e404dfa2e26f90d0afc5a65128513ad375c5ff2);
    else if (i == 32)
      return uint256(0x2f68a1c58e257e42a17a6c61dff5551ed560b9922ab119d5ac8e184c9734ead9);
    else revert('Index out of bounds');
  }
}
