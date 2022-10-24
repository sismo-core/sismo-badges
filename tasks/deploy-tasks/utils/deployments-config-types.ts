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
}

export type DeploymentsConfigTypes = {
  [chain: string]: {
    // Conf related to the deployment (behind proxy, etc.)
    deployOptions: DeployOptions;
    // Conf related to the hydraS1AccountboundAttester
    hydraS1AccountboundAttester: {
      collectionIdFirst: string;
      collectionIdLast: string;
      initialRoot: string;
    };
    hydraS1SimpleAttester: {
      collectionIdFirst: string;
      collectionIdLast: string;
      initialRoot: string;
    };
    synapsPythia1SimpleAttester: {
      collectionIdFirst: string;
      collectionIdLast: string;
      commitmentSignerPubKeyX: string;
      commitmentSignerPubKeyY: string;
      owner: string;
    };
    // Conf related to the commitment mapper
    // https://github.com/sismo-core/sismo-commitment-mapper
    commitmentMapper: {
      owner: string;
      EdDSAPubKeyX: string;
      EdDSAPubKeyY: string;
    };
    badges: {
      owner: string;
      uri: string;
    };
    // conf related to the roots Registry to store
    // all the merkleRoots
    availableRootsRegistry: {
      owner: string;
    };
    attestationsRegistry: {
      owner: string;
    };
    front: {
      collectionIdFirst: string;
      collectionIdLast: string;
    };
  };
};
