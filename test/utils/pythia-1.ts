import {
  EddsaAccount,
  EddsaPublicKey,
  EddsaSignature,
  buildPoseidon,
  SNARK_FIELD,
} from '@sismo-core/crypto';
import { BigNumber, BigNumberish, ethers } from 'ethers';

export type Pythia1Group = {
  properties: Pythia1GroupProperties;
  id: string;
};

export type Pythia1GroupProperties = {
  internalCollectionId: number;
  isScore: boolean;
};

export const generatePythia1Group = ({ internalCollectionId, isScore }): Pythia1Group => {
  const properties: Pythia1GroupProperties = {
    internalCollectionId,
    isScore,
  };

  return {
    id: generatePythia1GroupIdFromProperties(properties).toHexString(),
    properties,
  };
};

export const computeNullifier = async (
  secret: BigNumberish,
  externalNullifier: BigNumberish
): Promise<BigNumber> => {
  const poseidon = await buildPoseidon();
  return poseidon([secret, externalNullifier]);
};

export class CommitmentSignerTester {
  private seed: BigNumberish;

  constructor(seed: BigNumberish = '0x123321') {
    this.seed = seed;
  }

  async getCommitmentReceipt(
    commitment: BigNumberish,
    value: BigNumberish,
    groupId: BigNumberish
  ): Promise<EddsaSignature> {
    const poseidon = await buildPoseidon();
    return (await this._getEddsaAccount()).sign(poseidon([commitment, value, groupId]));
  }

  async getPublicKey(): Promise<EddsaPublicKey> {
    return (await this._getEddsaAccount()).getPubKey();
  }

  private async _getEddsaAccount(): Promise<EddsaAccount> {
    const eddsaAccount = await EddsaAccount.generateFromSeed(this.seed);
    return eddsaAccount;
  }
}

export const generatePythia1GroupIdFromProperties = (
  groupProperties: Pythia1GroupProperties
): BigNumber => {
  return generatePythia1GroupIdFromEncodedProperties(encodePythia1GroupProperties(groupProperties));
};

export const generatePythia1GroupIdFromEncodedProperties = (
  encodedProperties: string
): BigNumber => {
  return BigNumber.from(ethers.utils.keccak256(encodedProperties)).mod(SNARK_FIELD);
};

export const encodePythia1GroupProperties = (groupProperties: Pythia1GroupProperties): string => {
  return ethers.utils.defaultAbiCoder.encode(
    ['uint128', 'bool'],
    [groupProperties.internalCollectionId, groupProperties.isScore]
  );
};
