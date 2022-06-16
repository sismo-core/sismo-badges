import { getOwnershipMsg } from '@sismo-core/commitment-mapper-tester-js';
import {
  ACCOUNTS_TREE_HEIGHT,
  buildPoseidon,
  HydraS1Account,
  KVMerkleTree,
  MerkleTreeData,
  SNARK_FIELD,
  REGISTRY_TREE_HEIGHT,
} from '@sismo-core/hydra-s1';
import { BigNumber, ethers } from 'ethers';

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

export type List = { [address: string]: [value: number] };

export const generateLists = (S1Accounts: HydraS1Account[]): List[] => {
  const List1 = {};
  const List2 = {};
  S1Accounts.forEach((account, index) => {
    Object.assign(List1, { [BigNumber.from(account.identifier).toHexString()]: index });
    Object.assign(List2, { [BigNumber.from(account.identifier).toHexString()]: index + 1000 });
  });
  return [List1, List2];
};

export type Group = {
  data: MerkleTreeData;
  properties: GroupProperties;
  id: string;
};

export type GroupProperties = {
  listIndex: number;
  generationTimestamp: number;
  isScore: boolean;
};

export type RegistryAccountsMerkle = {
  accountsTrees: KVMerkleTree[];
  registryTree: KVMerkleTree;
};

export type AttesterGroups = {
  groups: Group[];
  dataFormat: RegistryAccountsMerkle;
};

export const generateAttesterGroups = async (allList: List[]): Promise<AttesterGroups> => {
  let poseidon = await buildPoseidon();

  /*********************** GENERATE GROUPS *********************/

  const groups: Group[] = [];
  let generationTimestamp = Math.round(Date.now() / 1000);

  for (let i = 0; i < allList.length; i++) {
    const properties = {
      listIndex: i,
      generationTimestamp,
      isScore: i % 2 == 1,
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

export const generateGroupIdFromProperties = (groupProperties: GroupProperties): BigNumber => {
  return generateGroupIdFromEncodedProperties(encodeGroupProperties(groupProperties));
};

export const generateGroupIdFromEncodedProperties = (encodedProperties: string): BigNumber => {
  return BigNumber.from(ethers.utils.keccak256(encodedProperties)).mod(SNARK_FIELD);
};

export const encodeGroupProperties = (groupProperties: GroupProperties): string => {
  return ethers.utils.defaultAbiCoder.encode(
    ['uint128', 'uint32', 'bool'],
    [groupProperties.listIndex, groupProperties.generationTimestamp, groupProperties.isScore]
  );
};

/*************************************************/
/************    PROVING SCHEME     *************/
/*************************************************/

export async function generateTicketIdentifier(attesterAddress: string, listIndex: number) {
  return BigNumber.from(
    ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(['address', 'uint256'], [attesterAddress, listIndex])
    )
  ).mod(BigNumber.from(SNARK_FIELD));
}

export function toBytes(snarkProof: any) {
  return ethers.utils.defaultAbiCoder.encode(
    ['uint256[2]', 'uint256[2][2]', 'uint256[2]', 'uint256[10]'],
    [snarkProof.a, snarkProof.b, snarkProof.c, snarkProof.input]
  );
}
