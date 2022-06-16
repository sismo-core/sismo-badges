import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { AccessControl__factory } from '../../../types';
import { CommonTaskOptions } from '../../utils';
import { confirm } from '../../utils/confirm';

export type AccessControlRevokeRoleArgs = {
  contractAddress: string;
  role: string;
  accountAddress: string;
  options?: CommonTaskOptions;
};

async function revokeRole(
  { contractAddress, role, accountAddress, options }: AccessControlRevokeRoleArgs,
  hre: HardhatRuntimeEnvironment
): Promise<void> {
  const [signer] = await hre.ethers.getSigners();

  if (options?.log || options?.manualConfirm) {
    console.log(`
    ************************************
    *            REVOKE ROLE           *
    ************************************`);
  }

  const accessControlContract = AccessControl__factory.connect(contractAddress, signer);

  const accountAlreadyHaveRole = await accessControlContract.hasRole(role, accountAddress);

  // Verify if the account already have the good role
  if (!accountAlreadyHaveRole) {
    if (options?.log || options?.manualConfirm) {
      console.log(`
    * ${accountAddress} don't have role ${role} on contract ${contractAddress}. Exiting
      `);
    }
    return;
  }

  // Verify signer can revoke the role
  const signerAddressIsAdminRole = await accessControlContract.hasRole(
    await accessControlContract.DEFAULT_ADMIN_ROLE(),
    signer.address
  );

  if (!signerAddressIsAdminRole) {
    throw new Error(
      `The current signer (${signer.address}) is not admin of the current contract ${contractAddress}. Can't revoke role ${role}`
    );
  }

  const actionRevokeRole = {
    role: role,
    toAccount: accountAddress,
    contract: contractAddress,
  };
  // Revoke role section
  if (options?.log || options?.manualConfirm) {
    console.log(`    
    ${Object.keys(actionRevokeRole as Object).map(
      (key) => `
    ${key}: ${actionRevokeRole?.[key]}`
    )}`);
  }
  if (options?.manualConfirm) {
    console.log();
    await confirm();
  }
  const tx = await accessControlContract.revokeRole(
    actionRevokeRole.role,
    actionRevokeRole.toAccount
  );
  await tx.wait();

  if (options?.log || options?.manualConfirm) {
    console.log(`
    * Role Revoked !
    `);
  }
}

task('access-control-revoke-role')
  .addParam('contractAddress', 'Contract concerned by the revokeRole call')
  .addParam('role', 'Role to revoke')
  .addParam('accountAddress', 'Account to receive the role')
  .setAction(revokeRole);
