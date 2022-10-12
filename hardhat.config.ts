import * as dotenv from 'dotenv';
import { HardhatUserConfig } from 'hardhat/config';
import {
  EthereumNetwork,
  PolygonNetwork,
  XDaiNetwork,
  NETWORKS_RPC_URL,
} from './helper-hardhat-config';
import '@nomiclabs/hardhat-etherscan';
import '@nomiclabs/hardhat-waffle';
import '@nomiclabs/hardhat-ethers';
import '@typechain/hardhat';
import 'hardhat-storage-layout';
import 'hardhat-gas-reporter';
import 'solidity-coverage';
import 'hardhat-deploy';
import { Wallet } from 'ethers';
import fg from 'fast-glob';

dotenv.config();

// Load all tasks files
if (process.env.SKIP_LOAD !== 'true') {
  const files = fg.sync(['./tasks/**/*.task.ts'], { dot: true });
  for (const file of files) {
    require(file);
  }
}

const HARDFORK = 'london';

const MNEMONIC_PATH = "m/44'/60'/0'/0";

const SISMO_SHARED_MNEMONIC =
  'analyst decade album recall stem run cage ozone human pepper once insect';
const MNEMONIC = process.env.MNEMONIC || SISMO_SHARED_MNEMONIC;

const INFURA_KEY = process.env.INFURA_KEY || '';
const ALCHEMY_KEY = process.env.ALCHEMY_KEY || '';

const MAINNET_FORK = process.env.MAINNET_FORK === 'true';
const FORKING_BLOCK = parseInt(process.env.FORKING_BLOCK || '');

const mainnetFork =
  MAINNET_FORK && FORKING_BLOCK
    ? {
        blockNumber: FORKING_BLOCK,
        url: ALCHEMY_KEY
          ? `https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_KEY}`
          : `https://main.infura.io/v3/${INFURA_KEY}`,
      }
    : undefined;

const getCommonNetworkConfig = (networkName: string, networkId: number) => ({
  url: NETWORKS_RPC_URL[networkName] ?? '',
  hardfork: HARDFORK,
  chainId: networkId,
  accounts: {
    mnemonic: MNEMONIC,
    path: MNEMONIC_PATH,
    initialIndex: 0,
    count: 20,
  },
});

const accounts = Array.from(Array(20), (_, index) => {
  const wallet = Wallet.fromMnemonic(SISMO_SHARED_MNEMONIC, `m/44'/60'/0'/0/${index}`);
  return {
    privateKey: wallet.privateKey,
    balance: '1000000000000000000000000',
  };
});

const LOCAL_CHAIN_ID = process.env.LOCAL_CHAIN_ID ? parseInt(process.env.LOCAL_CHAIN_ID) : 31337;
const LOCAL_HOSTNAME = process.env.LOCAL_HOSTNAME ?? 'localhost';
const LOCAL_PORT = process.env.LOCAL_PORT ? parseInt(process.env.LOCAL_PORT) : 8545;

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: '0.8.14',
        settings: {
          optimizer: { enabled: true, runs: 200 },
        },
      },
    ],
  },
  typechain: {
    outDir: 'types',
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  defaultNetwork: 'hardhat',
  networks: {
    kovan: getCommonNetworkConfig(EthereumNetwork.kovan, 42),
    goerli: getCommonNetworkConfig(EthereumNetwork.goerli, 5),
    main: getCommonNetworkConfig(EthereumNetwork.main, 1),
    polygon: getCommonNetworkConfig(PolygonNetwork.main, 137),
    sandboxPolygon: getCommonNetworkConfig(PolygonNetwork.main, 137),
    rinkeby: getCommonNetworkConfig(EthereumNetwork.rinkeby, 4),
    mumbai: getCommonNetworkConfig(PolygonNetwork.mumbai, 80001),
    xdai: getCommonNetworkConfig(XDaiNetwork.xdai, 100),
    local: {
      url: `http://${LOCAL_HOSTNAME}:${LOCAL_PORT}`,
      accounts: accounts.map((account) => account.privateKey),
      hardfork: HARDFORK,
      chainId: LOCAL_CHAIN_ID,
    },
    hardhat: {
      live: false,
      hardfork: 'london',
      chainId: LOCAL_CHAIN_ID,
      throwOnTransactionFailures: true,
      throwOnCallFailures: true,
      accounts,
      forking: mainnetFork,
      saveDeployments: false,
    },
    ganache: {
      live: false,
      url: 'http://ganache:8545',
      accounts: accounts.map((account) => account.privateKey),
    },
    coverage: {
      live: false,
      url: 'http://localhost:8555',
    },
  },
};

export default config;
