import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { AccessControl__factory } from '../../../types';
import { CommonTaskOptions } from '../../utils';
import { confirm } from '../../utils/confirm';

export type AccessControlGrantRoleArgs = {
  contractAddress: string;
  role: string;
  accountAddress: string;
  options?: CommonTaskOptions;
};

async function grantRole(
  { contractAddress, role, accountAddress, options }: AccessControlGrantRoleArgs,
  hre: HardhatRuntimeEnvironment
): Promise<void> {
  const [signer] = await hre.ethers.getSigners();

  if (options?.log || options?.manualConfirm) {
    console.log(`
    ************************************
    *            GRANT ROLE            *
    ************************************`);
  }

  const accessControlContract = AccessControl__factory.connect(contractAddress, signer);

  const accountAlreadyHaveRole = await accessControlContract.hasRole(role, accountAddress);

  // Verify if the account already have the good role
  if (accountAlreadyHaveRole) {
    if (options?.log || options?.manualConfirm) {
      console.log(`
    * ${accountAddress} already has role ${role} on contract ${contractAddress}
      `);
    }
    return;
  }

  // Verify signer can give the role
  const signerAddressIsAdminRole = await accessControlContract.hasRole(
    await accessControlContract.DEFAULT_ADMIN_ROLE(),
    signer.address
  );

  if (!signerAddressIsAdminRole) {
    throw new Error(
      `The current signer (${signer.address}) is not admin of the current contract ${contractAddress}. Can't grant role ${role}`
    );
  }

  const actionGrantRole = {
    role: role,
    toAccount: accountAddress,
    contract: contractAddress,
  };
  // Grant role section
  if (options?.log || options?.manualConfirm) {
    console.log(`    
    ${Object.keys(actionGrantRole as Object).map(
      (key) => `
    ${key}: ${actionGrantRole?.[key]}`
    )}`);
  }
  if (options?.manualConfirm) {
    console.log();
    await confirm();
  }
  const tx = await accessControlContract.grantRole(actionGrantRole.role, actionGrantRole.toAccount);
  await tx.wait();

  if (options?.log || options?.manualConfirm) {
    console.log(`
    * Role Granted !
    `);
  }
}

task('access-control-grant-role')
  .addParam('contractAddress', 'Contract concerned by the grantRole call')
  .addParam('role', 'Role to grant')
  .addParam('accountAddress', 'Account to receive the role')
  .setAction(grantRole);
