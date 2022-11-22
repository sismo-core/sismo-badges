import { CommonTaskOptions } from '../../utils';

export interface DeployOptions extends CommonTaskOptions {
  // prefix for the contract name
  deploymentNamePrefix?: string;
  // deploy with proxy?
  behindProxy?: boolean;
  // Proxy data is the encoded call of the initialize(params) function
  proxyData?: string;
  // admin of the proxy
  proxyAdmin?: string;
  // implementation version number
  implementationVersion?: number;
  // proxy address, required in case of implementation upgrade
  proxyAddress?: string;
}

export type DeploymentsConfigTypes = {
  [chain: string]: {
    // Conf related to the deployment (behind proxy, etc.)
    deployOptions: DeployOptions;
    // Conf related to the hydraS1AccountboundAttester
    hydraS1Verifier: {
      address: string;
    };
    hydraS1AccountboundAttester: {
      address: string;
      collectionIdFirst: string;
      collectionIdLast: string;
      initialRoot: string;
    };
    hydraS1SimpleAttester: {
      enableDeployment: boolean;
      address: string;
      collectionIdFirst: string;
      collectionIdLast: string;
      initialRoot: string;
    };
    pythia1Verifier: {
      address: string;
    };
    synapsPythia1SimpleAttester: {
      address: string;
      collectionIdFirst: string;
      collectionIdLast: string;
      commitmentSignerPubKeyX: string;
      commitmentSignerPubKeyY: string;
      owner: string;
    };
    // Conf related to the commitment mapper
    // https://github.com/sismo-core/sismo-commitment-mapper
    commitmentMapper: {
      address: string;
      owner: string;
      EdDSAPubKeyX: string;
      EdDSAPubKeyY: string;
    };
    badges: {
      address: string;
      owner: string;
      uri: string;
    };
    // conf related to the roots Registry to store
    // all the merkleRoots
    availableRootsRegistry: {
      address: string;
      owner: string;
    };
    attestationsRegistry: {
      address: string;
      owner: string;
    };
    front: {
      address: string;
      collectionIdFirst: string;
      collectionIdLast: string;
    };
  };
};
