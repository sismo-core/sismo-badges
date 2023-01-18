import { BigNumber, BigNumberish, Contract, ContractTransaction } from 'ethers';
import hre from 'hardhat';
import {
  AddressesProvider,
  AttestationsRegistry,
  AvailableRootsRegistry,
  Badges,
  HydraS1AccountboundAttester,
} from 'types';
import { expect } from 'chai';
import { decodeGroupProperties, HydraS1ZKPS, ProofGenerationArgs } from './hydra-s1';
import { RequestStruct } from 'types/HydraS1Base';
import { DeployOptions } from 'tasks/deploy-tasks/utils';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { KVMerkleTree } from 'hydra-s1-previous';
import { getBlockTimestamp } from '../../test/utils/evm';
import { SISMO_ADDRESSES_PROVIDER_CONTRACT_ADDRESS } from '../../tasks/deploy-tasks/deployments-config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

/****************************************
 ********** Helpers for testing *********
 ****************************************/

export const deployCoreContracts = async (deployer: SignerWithAddress, options: DeployOptions) => {
  const {
    attestationsRegistry,
    hydraS1AccountboundAttester,
    hydraS1Verifier,
    front,
    badges,
    commitmentMapperRegistry,
    availableRootsRegistry,
  } = await hre.run('0-deploy-core-and-hydra-s1-simple-and-accountbound-and-pythia1', {
    options,
  });

  const { sismoAddressesProvider } = await hre.run('deploy-sismo-addresses-provider', {
    owner: deployer.address,
    badges: badges.address,
    attestationsRegistry: attestationsRegistry.address,
    front: front.address,
    hydraS1AccountboundAttester: hydraS1AccountboundAttester.address,
    commitmentMapperRegistry: commitmentMapperRegistry.address,
    availableRootsRegistry: availableRootsRegistry.address,
    hydraS1Verifier: hydraS1Verifier.address,
    options,
  });

  return {
    attestationsRegistry,
    hydraS1AccountboundAttester,
    hydraS1Verifier,
    front,
    badges,
    commitmentMapperRegistry,
    availableRootsRegistry,
    sismoAddressesProvider,
  };
};

export const registerRootForAttester = async (
  availableRootsRegistry: AvailableRootsRegistry,
  attester: HydraS1AccountboundAttester,
  registryTree: KVMerkleTree
) => {
  const root = registryTree.getRoot();
  await availableRootsRegistry.registerRootForAttester(attester.address, root);
};

export const checkAccountHoldsBadge = async (
  accountAddress: string,
  badgeId: BigNumberish,
  accountIsExpectedToHold = true
) => {
  const badgesContract = (await getContract(hre, 'Badges')) as Badges;

  if (accountIsExpectedToHold) {
    expect((await badgesContract.balanceOf(accountAddress, badgeId)) > BigNumber.from(0)).to.be
      .true;
  } else {
    expect((await badgesContract.balanceOf(accountAddress, badgeId)) > BigNumber.from(0)).to.be
      .false;
  }
};

export const checkAttestationIsWellRegistered = async ({
  request,
  nullifier,
  expectedBurnCount,
  tx,
  attester,
}: {
  request: RequestStruct;
  nullifier: BigNumberish;
  tx: ContractTransaction;
  expectedBurnCount?: number;
  attester?: HydraS1AccountboundAttester;
}) => {
  const attestationsRegistry = (await getContract(
    hre,
    'AttestationsRegistry'
  )) as AttestationsRegistry;

  attester =
    attester ??
    ((await getContract(hre, 'HydraS1AccountboundAttester')) as HydraS1AccountboundAttester);

  const badgeId = (await attester.AUTHORIZED_COLLECTION_ID_FIRST()).add(
    decodeGroupProperties(request.claims[0].extraData).groupIndex
  );

  const extraData: string = await attestationsRegistry.getAttestationExtraData(
    badgeId,
    request.destination
  );

  // 0 - Checks that the transaction emitted the event
  await expect(tx)
    .to.emit(attester, 'AttestationGenerated')
    .withArgs([
      badgeId,
      request.destination,
      attester.address,
      request.claims[0].claimedValue,
      decodeGroupProperties(request.claims[0].extraData).generationTimestamp,
      extraData,
    ]);

  // 1 - Checks that the provided nullifier was successfully recorded in the attester
  expect(await attester.getDestinationOfNullifier(BigNumber.from(nullifier))).to.equal(
    request.destination
  );

  expect(await attester.getNullifierBurnCount(BigNumber.from(nullifier))).to.be.eql(
    expectedBurnCount ?? 0
  );

  expect(await attester.getNullifierCooldownStart(BigNumber.from(nullifier))).to.be.eql(
    expectedBurnCount ?? 0 >= 1 ? await getBlockTimestamp() : 0
  );

  // 2 - Checks that the attester recorded the attestation in the registry
  expect(await attestationsRegistry.hasAttestation(badgeId, request.destination)).to.be.true;
};

export const mintBadge = async ({
  sources,
  destination,
  group,
  value,
  provingScheme,
  expectedBurnCount,
  isDestinationAlreadyHoldingTheBadge = false,
}: ProofGenerationArgs & {
  provingScheme: HydraS1ZKPS;
  expectedBurnCount?: number;
  isDestinationAlreadyHoldingTheBadge?: boolean;
}) => {
  sources = sources ?? [destination];

  const badgeId = (await provingScheme.defaultAttester.AUTHORIZED_COLLECTION_ID_FIRST()).add(
    group?.properties.groupIndex ?? provingScheme.groups[0].properties.groupIndex
  );

  await checkAccountHoldsBadge(
    BigNumber.from(destination.identifier).toHexString(),
    badgeId,
    isDestinationAlreadyHoldingTheBadge
  );

  const { request, proofData, inputs } = await provingScheme.generateProof({
    sources,
    destination,
    group,
    value,
  });

  const generateAttestationsTransaction = await provingScheme.defaultAttester.generateAttestations(
    request,
    proofData
  );

  await checkAttestationIsWellRegistered({
    request,
    nullifier: BigNumber.from(inputs.publicInputs.nullifier),
    expectedBurnCount: expectedBurnCount ?? 0,
    tx: generateAttestationsTransaction,
  });

  await checkAccountHoldsBadge(BigNumber.from(destination.identifier).toHexString(), badgeId, true);

  return { request, proofData, inputs, nullifier: BigNumber.from(inputs.publicInputs.nullifier) };
};

export const computeBadgeIds = async (provingScheme: HydraS1ZKPS) => {
  const badgeIds: BigNumber[] = [];
  for (let i = 0; i < provingScheme.groups.length; i++) {
    const group = provingScheme.groups[i];
    badgeIds.push(
      (await provingScheme.defaultAttester.AUTHORIZED_COLLECTION_ID_FIRST()).add(
        group.properties.groupIndex
      )
    );
  }

  return badgeIds;
};

export const getAddressesProviderContract = async (hre: HardhatRuntimeEnvironment) => {
  const code = await hre.network.provider.send('eth_getCode', [
    SISMO_ADDRESSES_PROVIDER_CONTRACT_ADDRESS,
  ]);

  if (code === '0x') {
    throw new Error('Sismo addresses provider not deployed');
  }

  const AddressesProvider = await hre.ethers.getContractFactory('AddressesProvider');
  return AddressesProvider.attach(SISMO_ADDRESSES_PROVIDER_CONTRACT_ADDRESS) as AddressesProvider;
};

export const getContract = async (
  hre: HardhatRuntimeEnvironment,
  contractName: string
): Promise<Contract> => {
  const sismoAddressesProvider = await getAddressesProviderContract(hre);
  const contract = await hre.ethers.getContractAt(
    contractName,
    await sismoAddressesProvider['get(string)'](contractName)
  );

  return contract;
};
