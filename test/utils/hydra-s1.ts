import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { CommitmentMapperTester, getOwnershipMsg } from '@sismo-core/commitment-mapper-tester-js';
import {
  ACCOUNTS_TREE_HEIGHT,
  buildPoseidon,
  HydraS1Account,
  HydraS1Prover,
  KVMerkleTree,
  MerkleTreeData,
  REGISTRY_TREE_HEIGHT,
  SnarkProof,
  SNARK_FIELD,
  Inputs,
  EddsaPublicKey,
} from '@sismo-core/hydra-s1';
import { BigNumber, Bytes, BytesLike, ethers } from 'ethers';
import hre from 'hardhat';
import { HydraS1AccountboundAttester } from 'types';
import { ClaimStruct } from 'types/HydraS1Base';
import { HydraS1SimpleAttester, RequestStruct } from 'types/HydraS1SimpleAttester';

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

export type GroupData = { [address: string]: number };

export const generateGroup = (S1Accounts: HydraS1Account[], value: number): GroupData => {
  const List = {};
  S1Accounts.forEach((account, index) => {
    Object.assign(List, {
      [BigNumber.from(account.identifier).toHexString()]: value ?? 0,
    });
  });
  return List;
};

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

export const decodeGroupProperties = (
  encodedProperties: BytesLike
): HydraS1SimpleGroupProperties => {
  const [groupIndex, generationTimestamp, isScore] = ethers.utils.defaultAbiCoder.decode(
    ['uint128', 'uint32', 'bool'],
    encodedProperties
  );

  return { groupIndex, generationTimestamp, isScore };
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

/*************************************************
 ************ PROVING DATA GENERATION  ************
 * ***********************************************/

export type GenerateAttesterGroup = {
  groupValues: number[];
  generationTimestamp?: number;
  isScore?: boolean;
  groupIndex?: number;
  groups?: HydraS1SimpleGroup[];
};

export type ProvingDataStruct = {
  accountsTreesWithData: { tree: KVMerkleTree; group: HydraS1SimpleGroup }[];
  registryTree: KVMerkleTree;
  groups: HydraS1SimpleGroup[];
  commitmentMapperPubKey: EddsaPublicKey;
  accounts: HydraS1Account[];
};

export const generateProvingData = async (options?: GenerateAttesterGroup) => {
  const signers: SignerWithAddress[] = await hre.ethers.getSigners();

  const commitmentMapper = await CommitmentMapperTester.generate();
  const commitmentMapperPubKey = await commitmentMapper.getPubKey();

  const accounts: HydraS1Account[] = await generateHydraS1Accounts(signers, commitmentMapper);

  // create group
  const groups = options?.groups ?? [];
  let generationTimestamp = options?.generationTimestamp ?? Math.round(Date.now() / 1000);

  for (const groupValue of options?.groupValues ?? [1]) {
    const availableGroup = generateGroup(accounts, groupValue);

    const properties = {
      groupIndex: groups.length + 1,
      generationTimestamp,
      isScore: options?.isScore ?? false,
    };

    groups.push({
      data: availableGroup,
      properties,
      id: generateGroupIdFromProperties(properties).toHexString(),
    });
  }

  // format data
  const accountsTreesWithData: { tree: KVMerkleTree; group: HydraS1SimpleGroup }[] = [];
  const registryTreeData: MerkleTreeData = {};

  let poseidon = await buildPoseidon();

  for (let i = 0; i < groups.length; i++) {
    let _accountsTree = new KVMerkleTree(groups[i].data, poseidon, ACCOUNTS_TREE_HEIGHT);
    accountsTreesWithData.push({ tree: _accountsTree, group: groups[i] });
    registryTreeData[_accountsTree.getRoot().toHexString()] = groups[i].id;
  }

  const registryTree = new KVMerkleTree(registryTreeData, poseidon, REGISTRY_TREE_HEIGHT);

  return {
    accountsTreesWithData,
    registryTree,
    groups,
    commitmentMapperPubKey,
    accounts,
  };
};

/******************************************
 ************ PROOF GENERATOR **************
 ******************************************/

export type HydraS1Proof = {
  claim: ClaimStruct;
  proofData: Bytes;
};

export type AccountsTreeWithData = { tree: KVMerkleTree; group: HydraS1SimpleGroup };

export type HydraS1ZKPSConstructorArgs = {
  accountsTreesWithData: AccountsTreeWithData[];
  registryTree: KVMerkleTree;
  groups: HydraS1SimpleGroup[];
  defaultAttester: HydraS1AccountboundAttester | HydraS1SimpleAttester;
  commitmentMapperPubKey: EddsaPublicKey;
  chainId: number;
};

export type ProofGenerationArgs = {
  sources: HydraS1Account[];
  destination: HydraS1Account;
  value?: BigNumber;
  attesterAddress?: string;
  group?: HydraS1SimpleGroup;
  availableGroups?: {
    registryTree: KVMerkleTree;
    accountsTreesWithData: {
      tree: KVMerkleTree;
      group: HydraS1SimpleGroup;
    }[];
  };
};

export class HydraS1ZKPS {
  accountsTreesWithData: AccountsTreeWithData[];
  registryTree: KVMerkleTree;
  groups: HydraS1SimpleGroup[];
  defaultAttester: HydraS1AccountboundAttester | HydraS1SimpleAttester;
  commitmentMapperPubKey: EddsaPublicKey;
  chainId: number;

  constructor({
    accountsTreesWithData,
    registryTree,
    groups,
    defaultAttester,
    commitmentMapperPubKey,
    chainId,
  }: HydraS1ZKPSConstructorArgs) {
    this.accountsTreesWithData = accountsTreesWithData;
    this.registryTree = registryTree;
    this.groups = groups;
    this.defaultAttester = defaultAttester;
    this.commitmentMapperPubKey = commitmentMapperPubKey;
    this.chainId = chainId;
  }

  public async generateProof(proofGenerationArgs: ProofGenerationArgs) {
    const {
      source,
      destination,
      claimedValue,
      chainId,
      accountsTree,
      externalNullifier,
      isStrict,
      registryTree,
      accountsTreeWithData,
    } = await this.getVariables(proofGenerationArgs);

    const prover = new HydraS1Prover(registryTree, this.commitmentMapperPubKey);

    const userParams = {
      source,
      destination,
      claimedValue,
      chainId,
      accountsTree,
      externalNullifier,
      isStrict,
    };

    const inputs = await prover.generateInputs(userParams);

    const proof = await prover.generateSnarkProof(userParams);

    const claim = {
      groupId: accountsTreeWithData.group.id,
      claimedValue: claimedValue,
      extraData: encodeGroupProperties({
        ...accountsTreeWithData.group.properties,
      }),
    };

    return {
      request: {
        claims: [claim],
        destination: BigNumber.from(destination.identifier).toHexString(),
      },
      proofData: proof.toBytes(),
      inputs,
      userParams,
      nullifier: await this.getNullifier(proofGenerationArgs),
    };
  }

  public async getNullifier(proofGenerationArgs: ProofGenerationArgs) {
    const {
      source,
      destination,
      claimedValue,
      chainId,
      accountsTree,
      externalNullifier,
      isStrict,
      registryTree,
    } = await this.getVariables(proofGenerationArgs);

    const prover = new HydraS1Prover(registryTree, this.commitmentMapperPubKey);

    const userParams = {
      source,
      destination,
      claimedValue,
      chainId,
      accountsTree,
      externalNullifier,
      isStrict,
    };

    const inputs = await prover.generateInputs(userParams);

    return BigNumber.from(inputs.publicInputs.nullifier);
  }

  public async getVariables(proofGenerationArgs: ProofGenerationArgs) {
    const availableGroups = proofGenerationArgs.availableGroups ?? {
      registryTree: this.registryTree,
      accountsTreesWithData: this.accountsTreesWithData,
    };
    const group = proofGenerationArgs.group ?? this.groups[0];
    const attesterAddress = proofGenerationArgs.attesterAddress ?? this.defaultAttester.address;

    const source = proofGenerationArgs.sources[0];
    const destination = proofGenerationArgs.destination;
    const claimedValue = proofGenerationArgs.value ?? BigNumber.from(1);
    const chainId = this.chainId;
    const externalNullifier = await generateExternalNullifier(
      attesterAddress,
      group.properties.groupIndex
    );
    const isStrict = !group.properties.isScore;

    let accountsTreeWithData: { tree: KVMerkleTree; group: HydraS1SimpleGroup } =
      availableGroups.accountsTreesWithData.filter((data) => data.group.id === group.id)[0];

    if (accountsTreeWithData === undefined) throw new Error('Group not found');

    const accountsTree = accountsTreeWithData.tree;

    const registryTree = availableGroups.registryTree;

    return {
      source,
      destination,
      claimedValue,
      chainId,
      accountsTree,
      externalNullifier,
      isStrict,
      registryTree,
      accountsTreeWithData,
    };
  }
}
