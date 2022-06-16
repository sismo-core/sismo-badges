import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber } from 'ethers';
import { EddsaSignature, Poseidon } from '@sismo-core/hydra-s1';
import { CommitmentMapperTester, getOwnershipMsg } from '@sismo-core/commitment-mapper-tester-js';

export async function getMockedAccounts(
  signers: SignerWithAddress[],
  commitmentMapper: CommitmentMapperTester,
  poseidon: Poseidon
): Promise<HydraS1MockedAccount[]> {
  const hydraS1Accounts: HydraS1MockedAccount[] = [];
  let i = 0;
  for (const signer of signers) {
    const signature = await signer.signMessage(getOwnershipMsg(signer.address));
    const secret = BigNumber.from(signer.address);
    const group1Value = i;
    const group2Value = 20000 - i;
    const group3Value = 40000 - group2Value;
    const commitment = poseidon([secret]).toHexString();
    const { commitmentReceipt } = await commitmentMapper.commit(
      signer.address,
      signature,
      commitment
    );
    hydraS1Accounts.push({
      signer,
      secret,
      commitmentReceipt,
      group1Value,
      group2Value,
      group3Value,
    });
    i++;
  }
  return hydraS1Accounts;
}

export type HydraS1MockedAccount = {
  signer: SignerWithAddress;
  secret: BigNumber;
  commitmentReceipt: EddsaSignature;
  group1Value: number;
  group2Value: number;
  group3Value: number;
};
