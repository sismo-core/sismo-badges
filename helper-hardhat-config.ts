import dotenv from 'dotenv';
dotenv.config({});

export type Network = EthereumNetwork | PolygonNetwork | XDaiNetwork;

export enum EthereumNetwork {
  kovan = 'kovan',
  rinkeby = 'rinkeby',
  main = 'main',
  hardhat = 'hardhat',
  tenderlyMain = 'tenderlyMain',
  harhatevm = 'harhatevm',
}

export enum PolygonNetwork {
  matic = 'matic',
  mumbai = 'mumbai',
}

export enum XDaiNetwork {
  xdai = 'xdai',
}

export type ParamsPerNetwork<T> =
  | EthereumParamsPerNetwork<T>
  | PolygonParamsPerNetwork<T>
  | XDaiParamsPerNetwork<T>;

export interface EthereumParamsPerNetwork<Network> {
  [EthereumNetwork.harhatevm]: Network;
  [EthereumNetwork.rinkeby]: Network;
  [EthereumNetwork.main]: Network;
  [EthereumNetwork.hardhat]: Network;
  [EthereumNetwork.tenderlyMain]: Network;
}

export interface PolygonParamsPerNetwork<T> {
  [PolygonNetwork.matic]: T;
  [PolygonNetwork.mumbai]: T;
}

export interface XDaiParamsPerNetwork<T> {
  [XDaiNetwork.xdai]: T;
}

export interface ObjectString {
  [key: string]: string;
}
export const alchemyUrlOrEnvVar = (defaultAlchemyUrl: string, rpcUrl?: string): string => {
  const defaultUrl = `${defaultAlchemyUrl}/${process.env.ALCHEMY_KEY}`;
  return rpcUrl ? rpcUrl : defaultUrl;
};

export const NETWORKS_RPC_URL: ParamsPerNetwork<string> = {
  [EthereumNetwork.rinkeby]: alchemyUrlOrEnvVar(
    'https://eth-rinkeby.alchemyapi.io/v2',
    process.env.RINKEBY_RPC_URL
  ),
  [EthereumNetwork.main]: alchemyUrlOrEnvVar(
    'https://eth-mainnet.alchemyapi.io/v2',
    process.env.MAINNET_RPC_URL
  ),
  [EthereumNetwork.hardhat]: 'http://localhost:8545',
  [PolygonNetwork.mumbai]: alchemyUrlOrEnvVar(
    'https://polygon-mumbai.g.alchemy.com/v2',
    process.env.MUMBAI_RPC_URL
  ),
  [PolygonNetwork.matic]: alchemyUrlOrEnvVar(
    'https://polygon-mainnet.g.alchemy.com/v2',
    process.env.POLYGON_RPC_URL
  ),
  [XDaiNetwork.xdai]: 'https://rpc.xdaichain.com/',
};
