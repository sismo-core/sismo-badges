import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import fs from 'fs';
import fg from 'fast-glob';
import { exec } from 'child_process';
import util from 'util';

// Verify with etherscan only one contract
// identified by its deploymentName
async function verifyContract({ deploymentName }, hre: HardhatRuntimeEnvironment): Promise<void> {
  const deploymentPath = `${__dirname}/../../deployments/${hre.deployments.getNetworkName()}`;
  const deploymentFilesToHide = fg.sync([`${deploymentPath}/*`], {
    ignore: [`${deploymentPath}/${deploymentName}.json`],
  });

  // hide all files except the deployment we are interested in.
  await hideFiles(deploymentFilesToHide);

  try {
    // layer of security: avoid triggering the verify if there is still files left
    const filesNotHidden = fg.sync([`${deploymentPath}/*.json`]);
    if (filesNotHidden.length > 1) {
      throw new Error(
        'A deployment file other than the expected is still in the deployment folder!'
      );
    } else if (filesNotHidden.length === 0) {
      throw new Error(`Deployment ${deploymentName} was not found!`);
    }

    // execute the etherscan-verify
    const { stdout, stderr } = await util.promisify(exec)(
      `npx hardhat etherscan-verify --network ${hre.deployments.getNetworkName()}`
    );
    console.log(stdout);
    console.log(stderr);
  } catch (e: any) {
    console.log(e);
  }

  // revert modification to deployment files
  await revealFiles(deploymentFilesToHide);
}

task('verify-contract')
  .addParam('deploymentName', 'Name of the deployment to verify')
  .setAction(verifyContract);

const hideFiles = async (files: string[]) => {
  for (const file of files) {
    await fs.promises.rename(file, `${file}.hidden`);
  }
};

const revealFiles = async (files: string[]) => {
  for (const file of files) {
    await fs.promises.rename(`${file}.hidden`, file);
  }
};
