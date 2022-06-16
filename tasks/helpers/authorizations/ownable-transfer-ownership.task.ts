import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Ownable__factory } from '../../../types/factories/Ownable__factory';
import { CommonTaskOptions } from '../../utils';
import { confirm } from '../../utils/confirm';

export type OwnableTransferOwnershipArgs = {
  contractAddress: string;
  newOwner: string;
  options?: CommonTaskOptions;
};

async function ownableTransferOwnership(
  { contractAddress, newOwner, options }: OwnableTransferOwnershipArgs,
  hre: HardhatRuntimeEnvironment
): Promise<void> {
  const [signer] = await hre.ethers.getSigners();

  if (options?.log || options?.manualConfirm) {
    console.log(`
    ************************************
    *       TRANSFER OWNERSHIP         *
    ************************************`);
  }

  const ownableContract = Ownable__factory.connect(contractAddress, signer);
  const currentOwner = await ownableContract.owner();

  // verify is the newOwner il already owner of the contract
  if (currentOwner.toLowerCase() === newOwner.toLowerCase()) {
    if (options?.log || options?.manualConfirm) {
      console.log(`
    * CurrentOwner(${currentOwner}) is already the targetted owner. Nothing to do, exiting.
    `);
    }
    return;
  }

  // verify the signer has the rights to transfer ownership of the current contract
  if (signer.address.toLowerCase() !== currentOwner.toLowerCase()) {
    throw new Error(
      `The current signer (${signer.address}) is not owner of the current contract ${ownableContract.address}. Can't transfer ownership`
    );
  }

  // transfering ownership section
  const actionTransferOwnership = {
    currentOwner,
    newOwner,
    contract: ownableContract.address,
  };
  if (options?.log || options?.manualConfirm) {
    console.log(`   
    ${Object.keys(actionTransferOwnership as Object).map(
      (key) => `
    ${key}: ${actionTransferOwnership?.[key]}`
    )}`);
  }
  if (options?.manualConfirm) {
    console.log();
    await confirm();
  }
  const tx = await ownableContract.transferOwnership(actionTransferOwnership.newOwner);
  await tx.wait();

  if (options?.log || options?.manualConfirm) {
    console.log(`
    * Ownership transferred !
    `);
  }
}

task('ownable-transfer-ownership')
  .addParam('contractAddress', 'Ownable contract address to transfer ownership')
  .addParam('newOwner', 'New owner to transfer ownership')
  .setAction(ownableTransferOwnership);
