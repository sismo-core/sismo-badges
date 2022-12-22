import { BigNumber, BigNumberish, ethers } from 'ethers';
import {
  ACCOUNTS_TREE_HEIGHT,
  buildPoseidon,
  KVMerkleTree,
  MerkleTreeData,
  REGISTRY_TREE_HEIGHT,
  SNARK_FIELD,
} from '@sismo-core/hydra-s1';
import { GroupData, RegistryAccountsMerkle } from 'test/utils/hydra-s1';

export type HydraS1AccountboundGroup = {
  data: MerkleTreeData;
  properties: HydraS1AccountboundGroupProperties;
  id: string;
};

export type HydraS1AccountboundGroupProperties = {
  groupIndex: number;
  generationTimestamp: number;
  cooldownDuration: number;
  isScore: boolean;
};

export type AvailableGroupsAccountbound = {
  groups: HydraS1AccountboundGroup[];
  dataFormat: RegistryAccountsMerkle;
};

export type generateHydraS1AccountBoundAttesterGroups = {
  cooldownDuration?;
  generationTimestamp?;
  isScore?;
};

export const generateHydraS1AccountboundAttesterGroups = async (
  allList: GroupData[],
  options: generateHydraS1AccountBoundAttesterGroups = {
    cooldownDuration: 10,
  }
): Promise<AvailableGroupsAccountbound> => {
  let poseidon = await buildPoseidon();

  /*********************** GENERATE GROUPS *********************/

  const groups: HydraS1AccountboundGroup[] = [];
  let generationTimestamp = options.generationTimestamp
    ? options.generationTimestamp
    : Math.round(Date.now() / 1000);

  for (let i = 0; i < allList.length; i++) {
    const properties: HydraS1AccountboundGroupProperties = {
      groupIndex: i,
      generationTimestamp,
      isScore: options.isScore !== undefined ? options.isScore : i % 2 == 1,
      cooldownDuration: options.cooldownDuration,
    };

    groups.push({
      data: allList[i],
      properties,
      id: generateHydraS1AccountboundGroupIdFromProperties(properties).toHexString(),
    });
    generationTimestamp++;
  }

  /************************ FORMAT DATA *********************/

  const accountsTrees: KVMerkleTree[] = [];
  const registryTreeData: MerkleTreeData = {};

  for (let i = 0; i < groups.length; i++) {
    let _accountsTree = new KVMerkleTree(groups[i].data, poseidon, ACCOUNTS_TREE_HEIGHT);
    accountsTrees.push(_accountsTree);
    registryTreeData[_accountsTree.getRoot().toHexString()] = groups[i].id;
  }

  const registryTree = new KVMerkleTree(registryTreeData, poseidon, REGISTRY_TREE_HEIGHT);

  return {
    groups,
    dataFormat: {
      accountsTrees,
      registryTree,
    },
  };
};

export const generateHydraS1AccountboundGroupIdFromProperties = (
  groupProperties: HydraS1AccountboundGroupProperties
): BigNumber => {
  return generateHydraS1AccountboundGroupIdFromEncodedProperties(
    encodeHydraS1AccountboundGroupProperties(groupProperties)
  );
};

export const generateHydraS1AccountboundGroupIdFromEncodedProperties = (
  encodedProperties: string
): BigNumber => {
  return BigNumber.from(ethers.utils.keccak256(encodedProperties)).mod(SNARK_FIELD);
};

export const encodeHydraS1AccountboundGroupProperties = (
  groupProperties: HydraS1AccountboundGroupProperties
): string => {
  return ethers.utils.defaultAbiCoder.encode(
    ['uint128', 'uint32', 'uint32', 'bool'],
    [
      groupProperties.groupIndex,
      groupProperties.generationTimestamp,
      groupProperties.cooldownDuration,
      groupProperties.isScore,
    ]
  );
};

export const encodeAccountBoundAttestationExtraData = ({
  nullifier,
  burnCount,
}: {
  nullifier: BigNumberish | BigInt;
  burnCount: number;
}) => {
  return ethers.utils.defaultAbiCoder.encode(
    ['bytes', 'uint16'],
    [ethers.utils.defaultAbiCoder.encode(['uint256'], [nullifier]), burnCount]
  );
};

export const getNullifierFromExtraData = (extraData: string) => {
  return ethers.utils.defaultAbiCoder.decode(
    ['uint256'],
    ethers.utils.defaultAbiCoder.decode(['bytes', 'uint16'], extraData)[0]
  );
};
