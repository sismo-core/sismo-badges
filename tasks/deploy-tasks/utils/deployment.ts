import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { confirm } from '../../utils';
import { DeployResult } from 'hardhat-deploy/dist/types';
import { DeployOptions } from './';
import { deploymentsConfig } from '../deployments-config';
import { ethers } from 'ethers';
const accountNumber = Number(process.env.DEPLOYER_ACCOUNT) || 0;

export const getDeployer = async (hre: HardhatRuntimeEnvironment): Promise<SignerWithAddress> => {
  const deployer =
    accountNumber == 0
      ? await SignerWithAddress.create(hre.ethers.provider.getSigner())
      : (await hre.ethers.getSigners())[accountNumber];
  return deployer;
};

export const beforeDeployment = async (
  hre: HardhatRuntimeEnvironment,
  deployer: SignerWithAddress,
  contractName: string,
  args: any[],
  options?: DeployOptions
): Promise<void> => {
  const feeData = await hre.ethers.provider.getFeeData();
  const maxFeePerGas = feeData.maxFeePerGas
    ? hre.ethers.utils.formatUnits(feeData.maxFeePerGas, 'gwei')
    : 'unknown';
  const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas
    ? hre.ethers.utils.formatUnits(feeData.maxPriorityFeePerGas, 'gwei')
    : 'unknown';
  if (options?.log || options?.manualConfirm) {
    console.log(`
    ************************************
    Deploying: ${contractName}
    * Deployer *************************
    Address: ${deployer.address}
    Balance: ${hre.ethers.utils.formatUnits(await deployer.getBalance(), 'ether')} eth
    * Chain ****************************
    chainId: ${await hre.getChainId()} 
    network: ${hre.network.name},
    maxFeePerGas: ${maxFeePerGas} gwei (maximum price per unit of gas, includes base fee and priority fee),
    maxPriorityFeePerGas: ${maxPriorityFeePerGas} gwei (maximum priority fee per unit of gas)
    * ConstructorArguments *************
    ${args.map(
      (arg, k) => `
    Argument ${k}: ${arg}`
    )}
    `);
  }
  if (options?.manualConfirm) {
    await confirm();
  }
};

export const afterDeployment = async (
  hre: HardhatRuntimeEnvironment,
  deployer: SignerWithAddress,
  contractName: string,
  args: any[],
  deployed: DeployResult,
  options?: DeployOptions
): Promise<void> => {
  if (options?.log || options?.manualConfirm) {
    console.log(`
    ************************************
    Deployed: ${contractName} at ${deployed.address}
    * Deployment Receipt ***************
    Receipt: ${Object.keys(deployed.receipt || ({} as Object)).map(
      (key) => `
    ${key}: ${deployed.receipt?.[key]}`
    )}
    * Deployer *************************
    Address: ${deployer.address}
    Balance: ${hre.ethers.utils.formatUnits(await deployer.getBalance(), 'ether')} eth
    * Chain ****************************
    chainId: ${await hre.getChainId()} 
    network: ${hre.network.name},
    * ConstructorArguments *************
    ${args.map(
      (arg, k) => `
    Argument ${k}: ${arg}`
    )}
    `);
  }
};

export const customDeployContract = async (
  hre: HardhatRuntimeEnvironment,
  deployer: SignerWithAddress,
  deploymentName: string,
  contractName: string,
  args: any[],
  options?: DeployOptions
): Promise<DeployResult> => {
  if (options?.log) {
    console.log(`
    * Deploying ${options?.behindProxy ? 'behind' : 'without'} proxy ***********
    `);
  }

  const finalDeploymentName = options?.behindProxy ? deploymentName + 'Implem' : deploymentName;
  const deploymentOptions = {
    contract: contractName,
    from: deployer.address,
    args,
    // If deployment name is already used, it means we are upgrading the implementation
    skipIfAlreadyDeployed: false,
    deterministicDeployment: options?.deterministicDeployment || false,
  };
  const deploymentDifference = await hre.deployments.fetchIfDifferent(
    finalDeploymentName,
    deploymentOptions
  );
  if (options?.isImplementationUpgrade && deploymentDifference.differences) {
    if (options?.log) {
      console.log(`
      ** Deploying new implementation for ${deploymentName} ***********
      `);
    }
    if (options.manualConfirm) {
      await confirm();
    }
  }
  const deployed = await hre.deployments.deploy(finalDeploymentName, deploymentOptions);
  if (!options?.behindProxy) {
    return deployed;
  } else if (options?.isImplementationUpgrade) {
    const proxyAddress = options.proxyAddress;
    if (!proxyAddress) {
      throw new Error('proxyAddress should be defined when upgrading a proxy!');
    }
    await hre.deployments.save(deploymentName, { ...deployed, address: proxyAddress });
    if (options?.log) {
      console.log(`
      * Implementation deployed with address: ${deployed.address} ***********
      `);
    }
    if (deploymentDifference.differences) {
      await hre.run('upgrade-proxy', {
        proxyAddress,
        proxyData: options.proxyData,
        newImplementationAddress: deployed.address,
        options,
      });
    }
    return {
      ...deployed,
      address: proxyAddress,
    };
  } else {
    const proxy = await hre.deployments.deploy(deploymentName + 'Proxy', {
      contract:
        'contracts/periphery/utils/TransparentUpgradeableProxy.sol:TransparentUpgradeableProxy',
      from: deployer.address,
      deterministicDeployment: options?.deterministicDeployment || false,
      // note proxyData is the encoded call (i.e initialize(params))
      args: [deployed.address, options?.proxyAdmin, options?.proxyData],
    });
    const implem = deployed;
    await hre.deployments.save(deploymentName, { ...implem, address: proxy.address });
    if (options?.log) {
      console.log(`
      * Deploying behind proxy ***********
      Proxy Address: ${proxy.address}
      Implementation Address: ${deployed.address}
      `);
    }
    return proxy;
  }
};

export const wrapCommonDeployOptions = (action: Function) => {
  return (args: any, hre: HardhatRuntimeEnvironment) => {
    const config = deploymentsConfig[hre.network.name];
    return action(
      {
        ...args,
        options: {
          ...config.deployOptions,
          ...args.options,
        },
      },
      hre
    );
  };
};

export const buildDeploymentName = (contractName: string, prefix?: string) =>
  prefix ? `${prefix}_${contractName}` : contractName;
