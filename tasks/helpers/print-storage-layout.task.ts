import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

async function printStorageLayout({}, hre: HardhatRuntimeEnvironment): Promise<void> {
  await hre.run('deploy-full-local');
  await hre.storageLayout.export();
}

task('print-storage-layout').setAction(printStorageLayout);
