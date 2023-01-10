import { expect } from 'chai';
import hre from 'hardhat';

import { MockHydraS1SimpleAttester__factory } from './../../../../types/factories/MockHydraS1SimpleAttester__factory';
import { FrontendLib } from './../../../../types/FrontendLib';
import { DeployedFrontendLib } from '../../../../tasks/deploy-tasks/unit/periphery/deploy-frontend-lib.task';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

describe('Test FrontendLib contract', () => {
  let deployer: SignerWithAddress;
  let frontendLib: FrontendLib;
  let dest1: SignerWithAddress;
  let nullifier1: string;
  let dest2: SignerWithAddress;
  let nullifier2: string;
  let dest3: SignerWithAddress;
  let nullifier3: string;
  let dest4: SignerWithAddress;

  before(async () => {
    const signers = await hre.ethers.getSigners();
    [deployer, dest1, dest2, dest3, dest4] = signers;
    [nullifier1, nullifier2, nullifier3] = [
      '0x1000000000000000000000000000000000000000000000000000000000000001',
      '0x2000000000000000000000000000000000000000000000000000000000000002',
      '0x3000000000000000000000000000000000000000000000000000000000000003',
    ];
  });

  /*************************************************************************************/
  /********************************** DEPLOYMENTS **************************************/
  /*************************************************************************************/
  describe('Deployments', () => {
    it('Should deploy the FrontendLib and an HydraS1SimpleAttester mock for tests', async () => {
      // MockHydraS1SimpleAttester
      const hydraS1AttesterMock = await hre.deployments.deploy('MockHydraS1SimpleAttesterTest', {
        contract: 'MockHydraS1SimpleAttester',
        from: deployer.address,
        args: [],
      });
      const mockHydraS1Attester = MockHydraS1SimpleAttester__factory.connect(
        hydraS1AttesterMock.address,
        deployer
      );

      await mockHydraS1Attester.setDestinationOfNullifier(nullifier1, dest1.address);
      await mockHydraS1Attester.setDestinationOfNullifier(nullifier2, dest2.address);
      await mockHydraS1Attester.setDestinationOfNullifier(nullifier3, dest3.address);

      ({ frontendLib } = (await hre.run('deploy-frontend-lib', {
        hydraS1AccountboundAttester: hydraS1AttesterMock.address,
      })) as DeployedFrontendLib);
    });
  });

  describe('Getter', () => {
    it('Should get all nullifier at once', async () => {
      const destinations =
        await frontendLib.getHydraS1AccountboundAttesterDestinationOfNullifierBatch([
          nullifier1,
          nullifier2,
          nullifier3,
          // unregistered nullifier
          '0x0000000000000000000000000000000000000000000000000000000000000123',
        ]);
      expect(destinations[0]).to.equal(dest1.address);
      expect(destinations[1]).to.equal(dest2.address);
      expect(destinations[2]).to.equal(dest3.address);
      expect(destinations[3]).to.equal('0x0000000000000000000000000000000000000000');
    });
  });
});
