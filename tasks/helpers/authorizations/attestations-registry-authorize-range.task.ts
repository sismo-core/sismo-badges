import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { AttestationsRegistry__factory } from '../../../types';
import { CommonTaskOptions } from '../../utils';
import { confirm } from '../../utils/confirm';

export type AuthorizeRangeArgs = {
  attestationsRegistryAddress: string;
  attesterAddress: string;
  collectionIdFirst: string;
  collectionIdLast: string;
  options?: CommonTaskOptions;
};

async function authorizeRange(
  {
    attestationsRegistryAddress,
    attesterAddress,
    collectionIdFirst,
    collectionIdLast,
    options,
  }: AuthorizeRangeArgs,
  hre: HardhatRuntimeEnvironment
): Promise<void> {
  const [signer] = await hre.ethers.getSigners();

  if (options?.log || options?.manualConfirm) {
    console.log(`
    ************************************
    *       AUTHORIZE ATTESTER         *
    ************************************`);
  }

  const attestationsRegistry = AttestationsRegistry__factory.connect(
    attestationsRegistryAddress,
    signer
  );

  // Verify if attester is already authorized in the AttestationsRegistry
  const isFirstRangeAuthorized = await attestationsRegistry.isAuthorized(
    attesterAddress,
    collectionIdFirst
  );
  const isLastRangeAuthorized = await attestationsRegistry.isAuthorized(
    attesterAddress,
    collectionIdLast
  );
  if (isFirstRangeAuthorized && isLastRangeAuthorized) {
    if (options?.log || options?.manualConfirm) {
      console.log(
        `Range (${collectionIdFirst}, ${collectionIdLast}) for ${attesterAddress} seems already authorized.`
      );
    }
    return;
  }

  const currentOwner = await attestationsRegistry.owner();

  // Authorizing the collectionIdFirst and collectionIdLast for the attester
  const actionAuthorizeRange = {
    attester: attesterAddress,
    collectionIdFirst,
    collectionIdLast,
    attestationsRegistry: attestationsRegistry.address,
    currentOwner,
  };
  if (options?.log || options?.manualConfirm) {
    console.log(`    
      ${Object.keys(actionAuthorizeRange as Object).map(
        (key) => `
      ${key}: ${actionAuthorizeRange?.[key]}`
      )}`);
  }

  // Verify if the current signer is the owner of the attestationsRegistry
  if (
    signer.address.toLowerCase() !== currentOwner.toLowerCase() &&
    process.env.OWNER_MANUAL_OPERATION !== 'true'
  ) {
    throw new Error(
      `The current signer (${signer.address}) is not owner of the attestations registry contract ${attestationsRegistry.address}. Can't authorize attester.`
    );
  } else if (process.env.OWNER_MANUAL_OPERATION === 'true') {
    if (options?.manualConfirm) {
      console.log('Send the transaction using etherscan !');
      await confirm();
    }
  } else {
    if (options?.manualConfirm) {
      console.log();
      await confirm();
    }

    const tx = await attestationsRegistry.authorizeRange(
      actionAuthorizeRange.attester,
      actionAuthorizeRange.collectionIdFirst,
      actionAuthorizeRange.collectionIdLast
    );
    await tx.wait();

    if (options?.log || options?.manualConfirm) {
      console.log(`
      * Attester well authorized !
      `);
    }
  }
}

task('attestations-registry-authorize-range')
  .addParam('attestationsRegistryAddress', 'Address of the attestations registry')
  .addParam('attesterAddress', 'Address of the attester')
  .addParam(
    'collectionIdFirst',
    'collectionId min authorized by the attestations registry to the attester'
  )
  .addParam(
    'collectionIdLast',
    'collectionId max authorized by the attestations registry to the attester'
  )
  .setAction(authorizeRange);
