import { getOwnershipMsg } from '@sismo-core/commitment-mapper-tester-js';
import {
  ACCOUNTS_TREE_HEIGHT,
  buildPoseidon,
  HydraS1Account,
  KVMerkleTree,
  MerkleTreeData,
  REGISTRY_TREE_HEIGHT,
  SnarkProof,
  SNARK_FIELD,
} from '@sismo-core/hydra-s1';
import { BigNumber, ethers } from 'ethers';
import { RequestStruct } from 'types/HydraS1SimpleAttester';

/*************************************************/
/**************    MOCK ACCOUNTS     *************/
/*************************************************/

export const generateHydraS1Accounts = async (
  signers,
  commitmentMapper
): Promise<HydraS1Account[]> => {
  const poseidon = await buildPoseidon();
  const hydraS1Accounts: HydraS1Account[] = [];
  for (const signer of signers) {
    const address = BigNumber.from(signer.address).toHexString();
    const signature = await signer.signMessage(getOwnershipMsg(address));
    const secret = BigNumber.from(address);
    const commitment = poseidon([secret]).toHexString();
    const { commitmentReceipt } = await commitmentMapper.commit(address, signature, commitment);
    hydraS1Accounts.push({
      identifier: address,
      secret,
      commitmentReceipt,
    });
  }
  return hydraS1Accounts;
};

/*************************************************/
/****************    DATA SOURCE     *************/
/*************************************************/

export type GroupData = { [address: string]: [value: number] };

export const generateGroups = (S1Accounts: HydraS1Account[]): GroupData[] => {
  const List1 = {};
  const List2 = {};
  S1Accounts.forEach((account, index) => {
    Object.assign(List1, { [BigNumber.from(account.identifier).toHexString()]: index + 1 });
    Object.assign(List2, { [BigNumber.from(account.identifier).toHexString()]: index + 1000 });
  });
  return [List1, List2];
};

export type HydraS1SimpleGroup = {
  data: MerkleTreeData;
  properties: HydraS1SimpleGroupProperties;
  id: string;
};

export type HydraS1SimpleGroupProperties = {
  groupIndex: number;
  generationTimestamp: number;
  isScore: boolean;
};

export type RegistryAccountsMerkle = {
  accountsTrees: KVMerkleTree[];
  registryTree: KVMerkleTree;
};

export type AttesterGroups = {
  groups: HydraS1SimpleGroup[];
  dataFormat: RegistryAccountsMerkle;
};

export type generateAttesterGroups = {
  generationTimestamp?: number;
  isScore?: boolean;
};

export const generateAttesterGroups = async (
  allList: GroupData[],
  options?: generateAttesterGroups
): Promise<AttesterGroups> => {
  let poseidon = await buildPoseidon();

  /*********************** GENERATE GROUPS *********************/

  const groups: HydraS1SimpleGroup[] = [];
  let generationTimestamp = Math.round(Date.now() / 1000);

  if (options && options.generationTimestamp) {
    generationTimestamp = options.generationTimestamp;
  }

  for (let i = 0; i < allList.length; i++) {
    const properties = {
      groupIndex: i,
      generationTimestamp,
      isScore: options && options.isScore ? options.isScore : i % 2 == 1,
    };

    groups.push({
      data: allList[i],
      properties,
      id: generateGroupIdFromProperties(properties).toHexString(),
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

export const generateGroupIdFromProperties = (
  groupProperties: HydraS1SimpleGroupProperties
): BigNumber => {
  return generateGroupIdFromEncodedProperties(encodeGroupProperties(groupProperties));
};

export const generateGroupIdFromEncodedProperties = (encodedProperties: string): BigNumber => {
  return BigNumber.from(ethers.utils.keccak256(encodedProperties)).mod(SNARK_FIELD);
};

export const encodeGroupProperties = (groupProperties: HydraS1SimpleGroupProperties): string => {
  return ethers.utils.defaultAbiCoder.encode(
    ['uint128', 'uint32', 'bool'],
    [groupProperties.groupIndex, groupProperties.generationTimestamp, groupProperties.isScore]
  );
};

/*************************************************/
/************    PROVING SCHEME     *************/
/*************************************************/

export async function generateExternalNullifier(attesterAddress: string, groupIndex: number) {
  return BigNumber.from(
    ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(['address', 'uint256'], [attesterAddress, groupIndex])
    )
  ).mod(BigNumber.from(SNARK_FIELD));
}

export function toBytes(snarkProof: any) {
  return ethers.utils.defaultAbiCoder.encode(
    ['uint256[2]', 'uint256[2][2]', 'uint256[2]', 'uint256[10]'],
    [snarkProof.a, snarkProof.b, snarkProof.c, snarkProof.input]
  );
}

export const packRequestAndProofToBytes = (request: RequestStruct, proof: SnarkProof) => {
  return ethers.utils.defaultAbiCoder.encode(
    [
      'tuple(uint256 groupId, uint256 claimedValue, bytes extraData)',
      'address destination',
      'bytes',
    ],
    [request.claims[0], request.destination, proof.toBytes()]
  );
};

export const decodeRequestAndProofFromBytes = (data: string) => {
  return ethers.utils.defaultAbiCoder.decode(
    ['tuple(uint256, uint256, bytes)', 'address', 'bytes'],
    data
  );
};
