import { BigNumber, BigNumberish, Contract, ContractTransaction } from 'ethers';
import hre from 'hardhat';
import {
  AddressesProvider,
  AttestationsRegistry,
  AvailableRootsRegistry,
  HydraS1AccountboundAttester,
} from 'types';
import { expect } from 'chai';
import { decodeGroupProperties, HydraS1SimpleGroupProperties } from './hydra-s1';
import { RequestStruct } from 'types/HydraS1Base';
import { DeployOptions } from 'tasks/deploy-tasks/utils';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { KVMerkleTree } from 'hydra-s1-previous';
import { getBlockTimestamp } from '../../test/utils/evm';

export const registerRootForAttester = async (
  availableRootsRegistry: AvailableRootsRegistry,
  attester: HydraS1AccountboundAttester,
  registryTree: KVMerkleTree
) => {
  const root = registryTree.getRoot();
  await availableRootsRegistry.registerRootForAttester(attester.address, root);
};

/****************************************
 ***** Deployment helpers for testing ***
 ****************************************/

export class TestingHelper {
  sismoAddressesProvider: AddressesProvider | undefined;

  deployCoreContracts = async (deployer: SignerWithAddress, options: DeployOptions) => {
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

    this.sismoAddressesProvider = sismoAddressesProvider;

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

  checkAccountHoldsBadge = async (
    accountAddress: string,
    badgeId: BigNumberish,
    accountIsExpectedToHold = true
  ) => {
    if (!this.sismoAddressesProvider) {
      throw new Error('Sismo addresses provider not deployed');
    }

    const badgesAddress = await this.sismoAddressesProvider['get(string)']('Badges');
    const badgesContract = await hre.ethers.getContractAt('Badges', badgesAddress);

    if (accountIsExpectedToHold) {
      expect((await badgesContract.balanceOf(accountAddress, badgeId)) > 0).to.be.true;
    } else {
      expect((await badgesContract.balanceOf(accountAddress, badgeId)) > 0).to.be.false;
    }
  };

  checkAttestationIsWellRegistered = async ({
    request,
    nullifier,
    accountAddress,
    expectedBurnCount,
    tx,
    attester,
  }: {
    request: RequestStruct;
    nullifier: BigNumberish;
    accountAddress: string;
    tx: ContractTransaction;
    expectedBurnCount?: number;
    attester?: HydraS1AccountboundAttester;
  }) => {
    if (!this.sismoAddressesProvider) {
      throw new Error('Sismo addresses provider not deployed');
    }

    const attestationsRegistry = (await hre.ethers.getContractAt(
      'AttestationsRegistry',
      await this.sismoAddressesProvider['get(string)']('AttestationsRegistry')
    )) as AttestationsRegistry;

    attester =
      attester ??
      ((await hre.ethers.getContractAt(
        'HydraS1AccountboundAttester',
        await this.sismoAddressesProvider['get(string)']('HydraS1AccountboundAttester')
      )) as HydraS1AccountboundAttester);

    const badgeId = (await attester.AUTHORIZED_COLLECTION_ID_FIRST()).add(
      decodeGroupProperties(request.claims[0].extraData).groupIndex
    );

    const extraData: string = await attestationsRegistry.getAttestationExtraData(
      badgeId,
      accountAddress
    );

    // 0 - Checks that the transaction emitted the event
    await expect(tx)
      .to.emit(attester, 'AttestationGenerated')
      .withArgs([
        badgeId,
        accountAddress,
        attester.address,
        request.claims[0].claimedValue,
        decodeGroupProperties(request.claims[0].extraData).generationTimestamp,
        extraData,
      ]);

    // 1 - Checks that the provided nullifier was successfully recorded in the attester
    expect(await attester.getDestinationOfNullifier(BigNumber.from(nullifier))).to.equal(
      accountAddress
    );

    expect(await attester.getNullifierBurnCount(BigNumber.from(nullifier))).to.be.eql(
      expectedBurnCount ?? 0
    );

    expect(await attester.getNullifierCooldownStart(BigNumber.from(nullifier))).to.be.eql(
      expectedBurnCount ?? 0 >= 1 ? await getBlockTimestamp() : 0
    );

    // 2 - Checks that the attester recorded the attestation in the registry
    expect(await attestationsRegistry.hasAttestation(badgeId, accountAddress)).to.be.true;
  };
}
