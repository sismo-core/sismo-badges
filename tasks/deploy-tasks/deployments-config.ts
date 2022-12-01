import { DeploymentsConfigTypes } from './utils/deployments-config-types';

const COMMITMENT_MAPPER_EDDSA_PUB_KEY_PROD = [
  '0x0c6c16efc72c198f4549bd069f1e57f091885234b9c140286d80ef431151d644',
  '0x12c54731563d974ead25d469d2263fdf0e230d5a09f6cd40a06e60210610d642',
];

const COMMITMENT_MAPPER_EDDSA_PUB_KEY_STAGING = [
  '0x1e468ad0fcde4edec429cd41eb28a0e78d4f31fa2c25172ef677468b2b38a9dc',
  '0x2b6e9a8e3b8ed419cca51e2e2ee7ae07d2902454deca17d7da7b00ae4a798add',
];

const COMMITMENT_MAPPER_TESTER = [
  '3268380547641047729088085784617708493474401130426516096643943726492544573596',
  '15390691699624678165709040191639591743681460873292995904381058558679154201615',
];

const COMMITMENT_SIGNER_PUB_KEY_SYNAPS_STAGING = [
  '0x038d3d596875c66eb90608bbe04e4e238607fd32ad61f4278bdaf47aadc28d60',
  '0x1b46b55a0ce3f35d6025cdd4554aaac1fc7180b14d51b0f15aa51a6929bdb952',
];

const COMMITMENT_SIGNER_PUB_KEY_SYNAPS_PROD = [
  '0x2f8eeb980ebc1342070a35514e1f42fa96381de8f080d3713e80fe99c883d4e9',
  '0x018683c5d2f1f71d7e8b65ab0990635c019de9183359db7e80543c485426e490',
];

const THREE_DAYS = '295200';
// Rinkeby
const ALPHA_RINKEBY_OWNER = '0x4e070E9b85a659F0B7B47cde33152ad6c2F63954';
const ALPHA_RINKEBY_ROOTS_OWNER_RELAYER = '0x5de4009c77d51782014bb16238ec32971ae9f8d0';
const ALPHA_RINKEBY_PROXY_ADMIN = '0x246E71bC2a257f4BE9C7fAD4664E6D7444844Adc';
// Goerli
const ALPHA_GOERLI_OWNER = '0x4e070E9b85a659F0B7B47cde33152ad6c2F63954';
const ALPHA_GOERLI_ROOTS_OWNER_RELAYER = '0x7f2e6e158643bcaf85f30c57ae8625f623d82659';
const ALPHA_GOERLI_PROXY_ADMIN = '0x246E71bC2a257f4BE9C7fAD4664E6D7444844Adc';
// Mumbai
const ALPHA_MUMBAI_OWNER = '0x4e070E9b85a659F0B7B47cde33152ad6c2F63954';
const ALPHA_MUMBAI_ROOTS_OWNER_RELAYER = '0x63f08f8f13126b9eadc76dd683902c61c5115138';
const ALPHA_MUMBAI_PROXY_ADMIN = '0x246E71bC2a257f4BE9C7fAD4664E6D7444844Adc';
// Polygon
const ALPHA_POLYGON_OWNER = '0xaee4acd5c4Bf516330ca8fe11B07206fC6709294';
const ALPHA_POLYGON_ROOTS_OWNER_RELAYER = '0xf0a0b692e1c764281c211948d03edeef5fb57111';
const ALPHA_POLYGON_PROXY_ADMIN = '0x2110475dfbB8d331b300178A867372991ff35fA3';
// Polygon Sandbox
const SANDBOX_POLYGON_OWNER = '0xaee4acd5c4Bf516330ca8fe11B07206fC6709294';
const SANDBOX_POLYGON_ROOTS_OWNER_RELAYER = '0x7e2305312099748bbd6a31bff27a8218edd4cbd2';
const SANDBOX_POLYGON_PROXY_ADMIN = '0x2110475dfbB8d331b300178A867372991ff35fA3';

export const implementationVersions = {
  badges: 2,
  front: 1,
  hydraS1Verifier: 1,
  hydraS1SimpleAttester: 3,
  hydraS1AccountboundAttester: 3,
  pythia1Verifier: 1,
  synapsPythia1SimpleAttester: 2,
  attestationsRegistry: 2,
  availableRootsRegistry: 1,
  commitmentMapper: 1,
};

export const deploymentsConfig: DeploymentsConfigTypes = {
  sandboxPolygon: {
    deployOptions: {
      manualConfirm: true,
      log: true,
      behindProxy: true,
      proxyAdmin: SANDBOX_POLYGON_PROXY_ADMIN,
    },
    badges: {
      address: '0x71a7089C56DFf528f330Bc0116C0917cd05B51Fc',
      owner: SANDBOX_POLYGON_OWNER,
      // Badges Metadata URI for the Badges contract
      uri: 'https://hub.playground.sismo.io/badges/polygon/{id}.json',
    },
    front: {
      address: '0xfC6f6b50B9Ee651B73B481E2cd221aFffc26a5E4',
      collectionIdFirst: '0',
      collectionIdLast: '10000000',
    },
    hydraS1Verifier: {
      address: '0xbcE0921E2502898384167414c2F116f7f7B240BC',
    },
    hydraS1SimpleAttester: {
      enableDeployment: false,
      address: '',
      collectionIdFirst: '',
      collectionIdLast: '',
      initialRoot: '0',
    },
    hydraS1AccountboundAttester: {
      address: '0x0AB188c7260666146B300aD3ad5b2AB99eb91D45',
      collectionIdFirst: '10000001',
      collectionIdLast: '20000000',
      initialRoot: '0x0b9340f0d31232adaec900fbaefc0f6fa3f00bda449dd677fa111b58bc754cc9',
      owner: SANDBOX_POLYGON_OWNER,
    },
    pythia1Verifier: {
      address: '0xb7b327Eb974706B548F8c18Ec0Eb35f0f0c655ef',
    },
    synapsPythia1SimpleAttester: {
      address: '0x5ee338769C0205c19c0Bf21C35A42b1645B89998',
      collectionIdFirst: '30000001',
      collectionIdLast: '30000100',
      commitmentSignerPubKeyX: COMMITMENT_SIGNER_PUB_KEY_SYNAPS_PROD[0],
      commitmentSignerPubKeyY: COMMITMENT_SIGNER_PUB_KEY_SYNAPS_PROD[1],
      owner: SANDBOX_POLYGON_OWNER,
    },
    attestationsRegistry: {
      address: '0xC999390A856e0633f945dD851DeeCE15b533ccA3',
      owner: SANDBOX_POLYGON_OWNER,
    },
    availableRootsRegistry: {
      address: '0xb8797eBa1048f6A6AfCbE4F08a582b4Dde69C05d',
      owner: SANDBOX_POLYGON_ROOTS_OWNER_RELAYER,
    },
    commitmentMapper: {
      address: '0xC44F46A31B752b773685be6B5ce8616fFeb97C8D',
      owner: SANDBOX_POLYGON_OWNER,
      EdDSAPubKeyX: COMMITMENT_MAPPER_EDDSA_PUB_KEY_PROD[0],
      EdDSAPubKeyY: COMMITMENT_MAPPER_EDDSA_PUB_KEY_PROD[1],
    },
  },
  polygon: {
    deployOptions: {
      manualConfirm: true,
      log: true,
      behindProxy: true,
      proxyAdmin: ALPHA_POLYGON_PROXY_ADMIN,
    },
    badges: {
      address: '0xF12494e3545D49616D9dFb78E5907E9078618a34',
      owner: ALPHA_POLYGON_OWNER,
      // Badges Metadata URI for the Badges contract
      uri: 'https://hub.sismo.io/badges/polygon/{id}.json',
    },
    front: {
      address: '0x2777b09dd2Cb4E6d62c1823AD074B43DfcC945Fd',
      collectionIdFirst: '0',
      collectionIdLast: '10000000',
    },
    hydraS1Verifier: {
      address: '0x362Ff03CaC33C4c8Dc7fF98396Dc19a68F29F57C',
    },
    hydraS1SimpleAttester: {
      enableDeployment: false,
      address: '',
      collectionIdFirst: '',
      collectionIdLast: '',
      initialRoot: '0',
    },
    hydraS1AccountboundAttester: {
      address: '0x10b27d9efa4A1B65412188b6f4F29e64Cf5e0146',
      collectionIdFirst: '10000001',
      collectionIdLast: '20000000',
      initialRoot: '0x163c3224fa82070fbee7692146f505144b0307d668d8e8f803171b6ee7a4cd00',
      owner: ALPHA_POLYGON_OWNER,
    },
    pythia1Verifier: {
      address: '0x6f3201339b90Eea1CdB13670d5714ca06a49DfaD',
    },
    synapsPythia1SimpleAttester: {
      address: '0x1918422a3627E701De451f0d4Ed99B8DEaB0C37c',
      collectionIdFirst: '30000001',
      collectionIdLast: '30000100',
      commitmentSignerPubKeyX: COMMITMENT_SIGNER_PUB_KEY_SYNAPS_PROD[0],
      commitmentSignerPubKeyY: COMMITMENT_SIGNER_PUB_KEY_SYNAPS_PROD[1],
      owner: ALPHA_POLYGON_OWNER,
    },
    attestationsRegistry: {
      address: '0xa37c32adE310f83B5A9E31b82f72011D5BFb5EFA',
      owner: ALPHA_POLYGON_OWNER,
    },
    availableRootsRegistry: {
      address: '0xEce747769BD44A7854c8C0913A91Aa801e42D0d0',
      owner: ALPHA_POLYGON_ROOTS_OWNER_RELAYER,
    },
    commitmentMapper: {
      address: '0x21612Eac9b9Ba69F1810074998E5884Ca14f5614',
      owner: ALPHA_POLYGON_OWNER,
      EdDSAPubKeyX: COMMITMENT_MAPPER_EDDSA_PUB_KEY_PROD[0],
      EdDSAPubKeyY: COMMITMENT_MAPPER_EDDSA_PUB_KEY_PROD[1],
    },
  },
  // deployer "alpha-testnets-mumbai-mnemonic-deployer-october-13-2022"
  mumbai: {
    deployOptions: {
      manualConfirm: true,
      log: true,
      behindProxy: true,
      proxyAdmin: ALPHA_MUMBAI_PROXY_ADMIN,
    },
    badges: {
      address: '0x5722fEa81027533721BA161964622271560da1aC',
      owner: ALPHA_MUMBAI_OWNER,
      // Badges Metadata URI for the Badges contract
      uri: 'https://hub.staging.zikies.io/badges/mumbai/{id}.json',
    },
    front: {
      address: '0xFD0395fEb7805447e84Eb439a543413ecb22d562',
      collectionIdFirst: '0',
      collectionIdLast: '10000000',
    },
    hydraS1Verifier: {
      address: '0x34e3CcCF4fF2E297be22465b85F03E5E6D27b41B',
    },
    hydraS1SimpleAttester: {
      enableDeployment: false,
      address: '',
      collectionIdFirst: '',
      collectionIdLast: '',
      initialRoot: '0',
    },
    hydraS1AccountboundAttester: {
      address: '0x069e6B99f4DA543156f66274FC6673442803C587',
      collectionIdFirst: '10000001',
      collectionIdLast: '20000000',
      initialRoot: '0',
      owner: ALPHA_MUMBAI_OWNER,
    },
    pythia1Verifier: {
      address: '0x115dFa344C877fF74e970F06BE10FF5A59EAba02',
    },
    synapsPythia1SimpleAttester: {
      address: '0x1586190051bf7bb0b754A7AA7CDde21E920ad009',
      collectionIdFirst: '30000001',
      collectionIdLast: '30000100',
      commitmentSignerPubKeyX: COMMITMENT_SIGNER_PUB_KEY_SYNAPS_STAGING[0],
      commitmentSignerPubKeyY: COMMITMENT_SIGNER_PUB_KEY_SYNAPS_STAGING[1],
      owner: ALPHA_MUMBAI_OWNER,
    },
    attestationsRegistry: {
      address: '0xf576E42E5b2682B8f606B1840c3A982610C29a3f',
      owner: ALPHA_MUMBAI_OWNER,
    },
    availableRootsRegistry: {
      address: '0x2c17e335d131dfd21238475Dd545B9B29Fb5A27D',
      owner: ALPHA_MUMBAI_ROOTS_OWNER_RELAYER,
    },
    commitmentMapper: {
      address: '0x82B54988e4E3a2850501F91AC06CEA82bdb014D3',
      owner: ALPHA_MUMBAI_OWNER,
      EdDSAPubKeyX: COMMITMENT_MAPPER_EDDSA_PUB_KEY_STAGING[0],
      EdDSAPubKeyY: COMMITMENT_MAPPER_EDDSA_PUB_KEY_STAGING[1],
    },
  },
  // deployer "alpha-testnets-goerli-mnemonic-deployer-october-4-2022"
  goerli: {
    deployOptions: {
      manualConfirm: true,
      log: true,
      behindProxy: true,
      proxyAdmin: ALPHA_GOERLI_PROXY_ADMIN,
    },
    badges: {
      address: '0xE06B14D5835925e1642d7216F4563a1273509F10',
      owner: ALPHA_GOERLI_OWNER,
      // Badges Metadata URI for the Badges contract
      uri: 'https://hub.staging.zikies.io/badges/goerli/{id}.json',
    },
    front: {
      address: '0xAa00539FCD89E113833a9fCb940F378aE1299e30',
      collectionIdFirst: '0',
      collectionIdLast: '10000000',
    },
    hydraS1Verifier: {
      address: '0x522018b86645F597626aa127EfC22D55a5c79F11',
    },
    hydraS1SimpleAttester: {
      enableDeployment: false,
      address: '',
      collectionIdFirst: '',
      collectionIdLast: '',
      initialRoot: '0',
    },
    hydraS1AccountboundAttester: {
      address: '0x89d80C9E65fd1aC8970B78A4F17E2e772030C1cB',
      collectionIdFirst: '10000001',
      collectionIdLast: '20000000',
      initialRoot: '0',
      owner: ALPHA_GOERLI_OWNER,
    },
    pythia1Verifier: {
      address: '0xEE077AD7a47e56F075f0C3bd41Cdc1629FdA3a9c',
    },
    synapsPythia1SimpleAttester: {
      address: '0x8E44f33Df343EA6f85380226BE5Fbf93db09168E',
      collectionIdFirst: '30000001',
      collectionIdLast: '30000100',
      commitmentSignerPubKeyX: COMMITMENT_SIGNER_PUB_KEY_SYNAPS_STAGING[0],
      commitmentSignerPubKeyY: COMMITMENT_SIGNER_PUB_KEY_SYNAPS_STAGING[1],
      owner: ALPHA_GOERLI_OWNER,
    },
    attestationsRegistry: {
      address: '0xf85BA0afA375495eE625910Db61b6b1406756234',
      owner: ALPHA_GOERLI_OWNER,
    },
    availableRootsRegistry: {
      address: '0xdDa4c8d2933dAA21Aac75B88fF59725725ba813F',
      owner: ALPHA_GOERLI_ROOTS_OWNER_RELAYER,
    },
    commitmentMapper: {
      address: '0x0844662f25817B735BC9B6d9D11995F1A6c4dCB1',
      owner: ALPHA_GOERLI_OWNER,
      EdDSAPubKeyX: COMMITMENT_MAPPER_EDDSA_PUB_KEY_STAGING[0],
      EdDSAPubKeyY: COMMITMENT_MAPPER_EDDSA_PUB_KEY_STAGING[1],
    },
  },
  local: {
    deployOptions: {
      manualConfirm: false,
      log: true,
      behindProxy: true,
      // account 18 of shared mnemonic
      proxyAdmin: '0x41EA85211c08227BD62B03f3EFc65FaAa6CBd1C3',
    },
    badges: {
      address: '0xeF5b2Be9a6075a61bCA4384abc375485d5e196c3',
      // account 0 of shared mneomonic
      owner: '0xb01ee322C4f028B8A6BFcD2a5d48107dc5bC99EC',
      uri: 'https://metadata-dev.badges.zikies.io/default-badges/local/{id}.json',
    },
    front: {
      address: '0x7f1624094ACe6cd9653A8c3C3D92F2fAbb241B07',
      collectionIdFirst: '0',
      collectionIdLast: '10000000',
    },
    hydraS1Verifier: {
      address: '0xe52EB1f52349F98c09a5B11B0E3fA7f269268Add',
    },
    hydraS1SimpleAttester: {
      enableDeployment: false,
      address: '',
      collectionIdFirst: '',
      collectionIdLast: '',
      initialRoot: '0',
    },
    hydraS1AccountboundAttester: {
      address: '0x9e5c3999d6e97b1a6FFC9dECBfF01Fc185d2268D',
      collectionIdFirst: '10000001',
      collectionIdLast: '20000000',
      initialRoot: '0x0deb3822cd7d8c6ece7456c8e7ff81d61c8991390072f2cee0f711102741e259',
      owner: '0xb01ee322C4f028B8A6BFcD2a5d48107dc5bC99EC',
    },
    pythia1Verifier: {
      address: '0xeF6890243012206C1eE0666e00289AC8a97D1b2B',
    },
    synapsPythia1SimpleAttester: {
      address: '0x2F4B0fA432354efe20246118fA736c896E726Ea4',
      collectionIdFirst: '30000001',
      collectionIdLast: '30000100',
      commitmentSignerPubKeyX: COMMITMENT_SIGNER_PUB_KEY_SYNAPS_STAGING[0],
      commitmentSignerPubKeyY: COMMITMENT_SIGNER_PUB_KEY_SYNAPS_STAGING[1],
      owner: '0xb01ee322C4f028B8A6BFcD2a5d48107dc5bC99EC',
    },
    attestationsRegistry: {
      address: '0x3D7220043f746FA5a087cD53460D48a5C0990980',
      owner: '0xb01ee322C4f028B8A6BFcD2a5d48107dc5bC99EC',
    },
    availableRootsRegistry: {
      address: '0x6c851BdD9B51436846F6eF815eBB47E20D1d6c7B',
      owner: '0xb01ee322C4f028B8A6BFcD2a5d48107dc5bC99EC',
    },
    commitmentMapper: {
      address: '0x175ECF3064CF2D6818D3eF3a84b29421C4df1E52',
      owner: '0xb01ee322C4f028B8A6BFcD2a5d48107dc5bC99EC',
      EdDSAPubKeyX: '0x1e468ad0fcde4edec429cd41eb28a0e78d4f31fa2c25172ef677468b2b38a9dc',
      EdDSAPubKeyY: '0x2b6e9a8e3b8ed419cca51e2e2ee7ae07d2902454deca17d7da7b00ae4a798add',
    },
  },
  hardhat: {
    deployOptions: {
      manualConfirm: false,
      log: false,
      behindProxy: true,
      // account 13 of shared mnemonic
      proxyAdmin: '0x569eaB3c91828B7d9f951d335bC12A6aABEc1458',
    },
    badges: {
      address: '',
      // account 0 of shared mneomonic
      owner: '0xb01ee322C4f028B8A6BFcD2a5d48107dc5bC99EC',
      uri: 'https://metadata-dev.badges.zikies.io/default-badges/local/{id}.json',
    },
    front: {
      address: '',
      collectionIdFirst: '0',
      collectionIdLast: '100000',
    },
    hydraS1Verifier: {
      address: '',
    },
    hydraS1SimpleAttester: {
      enableDeployment: true,
      address: '',
      collectionIdFirst: '100001',
      collectionIdLast: '200000',
      initialRoot: '0x0deb3822cd7d8c6ece7456c8e7ff81d61c8991390072f2cee0f711102741e259',
    },
    hydraS1AccountboundAttester: {
      address: '',
      collectionIdFirst: '200001',
      collectionIdLast: '300000',
      initialRoot: '0x0deb3822cd7d8c6ece7456c8e7ff81d61c8991390072f2cee0f711102741e259',
      owner: '0xb01ee322C4f028B8A6BFcD2a5d48107dc5bC99EC',
    },
    pythia1Verifier: {
      address: '',
    },
    synapsPythia1SimpleAttester: {
      address: '',
      collectionIdFirst: '30000001',
      collectionIdLast: '30000100',
      commitmentSignerPubKeyX: '0x2a7c304da200c5ee9488d35c604e0384e123a716f7399df22fc2ec9074301dae',
      commitmentSignerPubKeyY: '0x1cf4be3d4c5f0b3eac19493ca98a05490a06623c7937f6d83fe121756a132242',
      owner: '0xb01ee322C4f028B8A6BFcD2a5d48107dc5bC99EC',
    },
    attestationsRegistry: {
      address: '',
      owner: '0xb01ee322c4f028b8a6bfcd2a5d48107dc5bc99ec',
    },
    availableRootsRegistry: {
      address: '',
      owner: '0xb01ee322c4f028b8a6bfcd2a5d48107dc5bc99ec',
    },
    commitmentMapper: {
      address: '',
      owner: '0xb01ee322c4f028b8a6bfcd2a5d48107dc5bc99ec',
      EdDSAPubKeyX: COMMITMENT_MAPPER_TESTER[0],
      EdDSAPubKeyY: COMMITMENT_MAPPER_TESTER[1],
    },
  },
};
