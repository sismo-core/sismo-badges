import { singletonFactory } from '../../../../utils/singletonFactory';
import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import {
  getDeployer,
  beforeDeployment,
  afterDeployment,
  buildDeploymentName,
  customDeployContract,
  wrapCommonDeployOptions,
  DeployOptions,
} from '../../utils';

import {
  AddressesProvider,
  AddressesProvider__factory,
  TransparentUpgradeableProxy__factory,
} from '../../../../types';
import { utils } from 'ethers';
import { deploymentsConfig } from '../../../../tasks/deploy-tasks/deployments-config';

export interface DeploySismoAddressesProvider {
  owner: string;
  badges: string;
  attestationsRegistry: string;
  front: string;
  hydraS1AccountboundAttester: string;
  availableRootsRegistry: string;
  commitmentMapperRegistry: string;
  hydraS1Verifier: string;
  options?: DeployOptions;
}

export interface DeployedSismoAddressesProvider {
  sismoAddressesProvider: AddressesProvider;
}

const CONTRACT_NAME = 'AddressesProvider';

async function deploymentAction(
  {
    owner,
    badges,
    attestationsRegistry,
    front,
    hydraS1AccountboundAttester,
    availableRootsRegistry,
    commitmentMapperRegistry,
    hydraS1Verifier,
    options,
  }: DeploySismoAddressesProvider,
  hre: HardhatRuntimeEnvironment
): Promise<DeployedSismoAddressesProvider> {
  const config = deploymentsConfig[hre.network.name];

  const deployer = await getDeployer(hre);
  const deploymentName = buildDeploymentName(CONTRACT_NAME, options?.deploymentNamePrefix);

  const create2FactoryContract = '0xC4c11B14e9D876B031c1c7e05efE44088341f35B';
  // Account 1 of the create2Factory mnemonic
  const create2FactoryDeployer = '0xBa68986f673c9193BB79eA0d21990225d464bb5C';

  // Account 0 of the create2Factory mnemonic
  const proxyDeployer = '0x77694e7C30B74dd271EACA4207Ada0fC10632f5f';

  // Deploy a proxy where the admin is the factoryDeployer
  // The resulted proxy address is deterministic and is always
  // 0x3340Ac0CaFB3ae34dDD53dba0d7344C1Cf3EFE05
  const sismoAddressesProviderProxyAddress = '0x3340Ac0CaFB3ae34dDD53dba0d7344C1Cf3EFE05';

  if (hre.network.config.chainId !== 31337) {
    const tx = {
      to: create2FactoryDeployer,
      value: utils.parseEther('0.01'),
    };
    const sendFundTx = await deployer.sendTransaction(tx);
    await sendFundTx.wait();
    // The deployer should always be 0x77694e7c30b74dd271eaca4207ada0fc10632f5f
    if (deployer.address !== proxyDeployer) {
      throw new Error('The deployer should be 0x77694e7c30b74dd271eaca4207ada0fc10632f5f');
    }

    const proxy = await hre.deployments.deploy(deploymentName + 'Proxy', {
      contract:
        'contracts/periphery/utils/TransparentUpgradeableProxy.sol:TransparentUpgradeableProxy',
      from: deployer.address,
      deterministicDeployment: true,
      // note proxyData is the encoded call (i.e initialize(params))
      args: [create2FactoryContract, proxyDeployer, '0x'],
      log: true,
    });
  } else {
    // ONLY ON LOCAL NETWORK

    // check if the proxy already exists
    const code = await hre.network.provider.send('eth_getCode', [
      config.sismoAddressesProvider.address,
    ]);

    if (code !== '0x') {
      const AddressesProvider = await hre.ethers.getContractFactory('AddressesProvider');
      const sismoAddressesProvider = AddressesProvider.attach(
        config.sismoAddressesProvider.address
      ) as AddressesProvider;

      // if proxy already exists and the deployment is on a local network
      // we need to set new addresses for the contracts used in the tests
      await sismoAddressesProvider.setBatch(
        [
          badges,
          attestationsRegistry,
          front,
          hydraS1AccountboundAttester,
          availableRootsRegistry,
          commitmentMapperRegistry,
          hydraS1Verifier,
        ],
        [
          'Badges',
          'AttestationsRegistry',
          'Front',
          'HydraS1AccountboundAttester',
          'AvailableRootsRegistry',
          'CommitmentMapperRegistry',
          'HydraS1Verifier',
        ]
      );

      return { sismoAddressesProvider };
    }

    // Send 1Eth to the factory deployer (factoryDeployer)
    // This is necessary for being able to deploy the create2 factory
    const sendFundFactoryDeployerTx = await deployer.sendTransaction({
      to: create2FactoryDeployer,
      value: utils.parseEther('1'),
    });
    await sendFundFactoryDeployerTx.wait();
    const sendFundProxyDeployerTx = await deployer.sendTransaction({
      to: proxyDeployer,
      value: utils.parseEther('1'),
    });
    await sendFundProxyDeployerTx.wait();

    // Deploy the create2 factory with the factoryDeployer
    // the create2 factory signed transaction is already saved
    const tx1 = await hre.ethers.provider.send('eth_sendRawTransaction', [
      singletonFactory[hre.network.config.chainId!].transaction,
    ]);
    await hre.ethers.provider.waitForTransaction(tx1);

    // Create the proxy using the create2Factory and factoryDeployer as admin
    // In local we don't have the private key so this is already forged
    const createProxyTx = await hre.ethers.provider.send('eth_sendRawTransaction', [
      '0xf90ff380846fc23ac0830c4cb594c4c11b14e9d876b031c1c7e05efe44088341f35b80b90f8b0000000000000000000000000000000000000000000000000000000000000000608060405260405162000eeb38038062000eeb8339810160408190526200002691620004ed565b828162000036828260006200009a565b5062000066905060017fb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6104620005cd565b60008051602062000ea483398151915214620000865762000086620005f3565b6200009182620000d7565b5050506200065c565b620000a58362000132565b600082511180620000b35750805b15620000d257620000d083836200017460201b6200022e1760201c565b505b505050565b7f7e644d79422f17c01e4894b5f4f588d331ebfa28653d42ae832dc59e38c9798f62000102620001a3565b604080516001600160a01b03928316815291841660208301520160405180910390a16200012f81620001dc565b50565b6200013d8162000291565b6040516001600160a01b038216907fbc7cd75a20ee27fd9adebab32041f755214dbc6bffa90cc0225b39da2e5c2d3b90600090a250565b60606200019c838360405180606001604052806027815260200162000ec46027913962000345565b9392505050565b6000620001cd60008051602062000ea483398151915260001b620003c460201b620001ea1760201c565b546001600160a01b0316919050565b6001600160a01b038116620002475760405162461bcd60e51b815260206004820152602660248201527f455243313936373a206e65772061646d696e20697320746865207a65726f206160448201526564647265737360d01b60648201526084015b60405180910390fd5b806200027060008051602062000ea483398151915260001b620003c460201b620001ea1760201c565b80546001600160a01b0319166001600160a01b039290921691909117905550565b620002a781620003c760201b6200025a1760201c565b6200030b5760405162461bcd60e51b815260206004820152602d60248201527f455243313936373a206e657720696d706c656d656e746174696f6e206973206e60448201526c1bdd08184818dbdb9d1c9858dd609a1b60648201526084016200023e565b80620002707f360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc60001b620003c460201b620001ea1760201c565b6060600080856001600160a01b03168560405162000364919062000609565b600060405180830381855af49150503d8060008114620003a1576040519150601f19603f3d011682016040523d82523d6000602084013e620003a6565b606091505b509092509050620003ba86838387620003d6565b9695505050505050565b90565b6001600160a01b03163b151590565b606083156200044a57825160000362000442576001600160a01b0385163b620004425760405162461bcd60e51b815260206004820152601d60248201527f416464726573733a2063616c6c20746f206e6f6e2d636f6e747261637400000060448201526064016200023e565b508162000456565b6200045683836200045e565b949350505050565b8151156200046f5781518083602001fd5b8060405162461bcd60e51b81526004016200023e919062000627565b80516001600160a01b0381168114620004a357600080fd5b919050565b634e487b7160e01b600052604160045260246000fd5b60005b83811015620004db578181015183820152602001620004c1565b83811115620000d05750506000910152565b6000806000606084860312156200050357600080fd5b6200050e846200048b565b92506200051e602085016200048b565b60408501519092506001600160401b03808211156200053c57600080fd5b818601915086601f8301126200055157600080fd5b815181811115620005665762000566620004a8565b604051601f8201601f19908116603f01168101908382118183101715620005915762000591620004a8565b81604052828152896020848701011115620005ab57600080fd5b620005be836020830160208801620004be565b80955050505050509250925092565b600082821015620005ee57634e487b7160e01b600052601160045260246000fd5b500390565b634e487b7160e01b600052600160045260246000fd5b600082516200061d818460208701620004be565b9190910192915050565b602081526000825180602084015262000648816040850160208701620004be565b601f01601f19169190910160400192915050565b610838806200066c6000396000f3fe60806040526004361061004e5760003560e01c80633659cfe6146100655780634f1ef286146100855780635c60da1b146100985780638f283970146100c9578063f851a440146100e95761005d565b3661005d5761005b6100fe565b005b61005b6100fe565b34801561007157600080fd5b5061005b6100803660046106c2565b610118565b61005b6100933660046106dd565b610155565b3480156100a457600080fd5b506100ad6101bc565b6040516001600160a01b03909116815260200160405180910390f35b3480156100d557600080fd5b5061005b6100e43660046106c2565b6101ed565b3480156100f557600080fd5b506100ad61020d565b610106610269565b6101166101116102fe565b610308565b565b61012061032c565b6001600160a01b0316330361014d5761014a8160405180602001604052806000815250600061035f565b50565b61014a6100fe565b61015d61032c565b6001600160a01b031633036101b4576101af8383838080601f0160208091040260200160405190810160405280939291908181526020018383808284376000920191909152506001925061035f915050565b505050565b6101af6100fe565b60006101c661032c565b6001600160a01b031633036101e2576101dd6102fe565b905090565b6101ea6100fe565b90565b6101f561032c565b6001600160a01b0316330361014d5761014a8161038a565b600061021761032c565b6001600160a01b031633036101e2576101dd61032c565b606061025383836040518060600160405280602781526020016107dc602791396103de565b9392505050565b6001600160a01b03163b151590565b61027161032c565b6001600160a01b031633036101165760405162461bcd60e51b815260206004820152604260248201527f5472616e73706172656e745570677261646561626c6550726f78793a2061646d60448201527f696e2063616e6e6f742066616c6c6261636b20746f2070726f78792074617267606482015261195d60f21b608482015260a4015b60405180910390fd5b60006101dd610456565b3660008037600080366000845af43d6000803e808015610327573d6000f35b3d6000fd5b60007fb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d61035b546001600160a01b0316919050565b6103688361047e565b6000825111806103755750805b156101af57610384838361022e565b50505050565b7f7e644d79422f17c01e4894b5f4f588d331ebfa28653d42ae832dc59e38c9798f6103b361032c565b604080516001600160a01b03928316815291841660208301520160405180910390a161014a816104be565b6060600080856001600160a01b0316856040516103fb919061078c565b600060405180830381855af49150503d8060008114610436576040519150601f19603f3d011682016040523d82523d6000602084013e61043b565b606091505b509150915061044c86838387610567565b9695505050505050565b60007f360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc610350565b610487816105e8565b6040516001600160a01b038216907fbc7cd75a20ee27fd9adebab32041f755214dbc6bffa90cc0225b39da2e5c2d3b90600090a250565b6001600160a01b0381166105235760405162461bcd60e51b815260206004820152602660248201527f455243313936373a206e65772061646d696e20697320746865207a65726f206160448201526564647265737360d01b60648201526084016102f5565b807fb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d61035b80546001600160a01b0319166001600160a01b039290921691909117905550565b606083156105d65782516000036105cf576001600160a01b0385163b6105cf5760405162461bcd60e51b815260206004820152601d60248201527f416464726573733a2063616c6c20746f206e6f6e2d636f6e747261637400000060448201526064016102f5565b50816105e0565b6105e0838361067c565b949350505050565b6001600160a01b0381163b6106555760405162461bcd60e51b815260206004820152602d60248201527f455243313936373a206e657720696d706c656d656e746174696f6e206973206e60448201526c1bdd08184818dbdb9d1c9858dd609a1b60648201526084016102f5565b807f360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc610546565b81511561068c5781518083602001fd5b8060405162461bcd60e51b81526004016102f591906107a8565b80356001600160a01b03811681146106bd57600080fd5b919050565b6000602082840312156106d457600080fd5b610253826106a6565b6000806000604084860312156106f257600080fd5b6106fb846106a6565b9250602084013567ffffffffffffffff8082111561071857600080fd5b818601915086601f83011261072c57600080fd5b81358181111561073b57600080fd5b87602082850101111561074d57600080fd5b6020830194508093505050509250925092565b60005b8381101561077b578181015183820152602001610763565b838111156103845750506000910152565b6000825161079e818460208701610760565b9190910192915050565b60208152600082518060208401526107c7816040850160208701610760565b601f01601f1916919091016040019291505056fe416464726573733a206c6f772d6c6576656c2064656c65676174652063616c6c206661696c6564a2646970667358221220e2b2f80d01b9fee1887f086f33ea33eabe6a896123f3722976ea73e069c365b664736f6c634300080e0033b53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103416464726573733a206c6f772d6c6576656c2064656c65676174652063616c6c206661696c6564000000000000000000000000c4c11b14e9d876b031c1c7e05efe44088341f35b00000000000000000000000077694e7c30b74dd271eaca4207ada0fc10632f5f0000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000000082f4f6a02cc50d6bf53ac45ef3769c7c43307281ba0c8eba9d30932c3d1592a64a9fd5c5a05e301a8150706eed5697741f289e388f312837b06cf6100cb03ccc069ae5402b',
    ]);
    await hre.ethers.provider.waitForTransaction(createProxyTx);

    // Transfer proxy admin to the local deployer account
    // 0xb01ee322C4f028B8A6BFcD2a5d48107dc5bC99EC
    const tx2 = await hre.ethers.provider.send('eth_sendRawTransaction', [
      '0xf88a01846946465583033601943340ac0cafb3ae34ddd53dba0d7344c1cf3efe0580a48f283970000000000000000000000000b01ee322c4f028b8a6bfcd2a5d48107dc5bc99ec82f4f5a0faf64c726bcd16ee5c13003720451c6fc9a734f2e70943dfcd629c0c94ea9b02a006ece90f1a45701f8a14ef6bf5d1b2515f450dbeca871490c6ae0ed01a91759c',
    ]);
    await hre.ethers.provider.waitForTransaction(tx2);
  }

  // always start by giving the ownership of the deployer
  const deploymentArgs = [
    badges,
    attestationsRegistry,
    front,
    hydraS1AccountboundAttester,
    availableRootsRegistry,
    commitmentMapperRegistry,
    hydraS1Verifier,
    deployer.address,
  ];

  // Deploy the AddressesProvider implementation in local
  await beforeDeployment(hre, deployer, CONTRACT_NAME, deploymentArgs, options);
  const deployed = await customDeployContract(
    hre,
    deployer,
    deploymentName,
    CONTRACT_NAME,
    deploymentArgs,
    {
      ...options,
      behindProxy: false,
    }
  );
  await afterDeployment(hre, deployer, CONTRACT_NAME, deploymentArgs, deployed, options);

  // Save the deployment
  await hre.deployments.save(deploymentName, {
    ...deployed,
    address: sismoAddressesProviderProxyAddress,
  });

  // Upgrade the proxy to use the deployed implementation
  const sismoAddressesProviderProxy = await TransparentUpgradeableProxy__factory.connect(
    sismoAddressesProviderProxyAddress,
    deployer
  );
  if (options?.log) {
    console.log('Upgrade proxy to use the deployed implementation');
  }
  const initData = new AddressesProvider__factory(deployer).interface.encodeFunctionData(
    'initialize',
    [deployer.address]
  );
  const upgradeToTx = await sismoAddressesProviderProxy.upgradeToAndCall(
    deployed.address,
    initData
  );
  await upgradeToTx.wait();

  // change proxy admin
  if (options?.log) {
    console.log('Change proxy admin from the deployer to the expected one');
  }
  const transfertAdminTx = await sismoAddressesProviderProxy.changeAdmin(options?.proxyAdmin!);
  await transfertAdminTx.wait();

  const sismoAddressesProvider = await AddressesProvider__factory.connect(
    sismoAddressesProviderProxyAddress,
    deployer
  );

  if (options?.log) {
    console.log('Transfer AddressesProvider ownership from the deployer to the expected one');
  }
  const transferOwnershipTx = await sismoAddressesProvider.transferOwnership(owner);
  await transferOwnershipTx.wait();

  return { sismoAddressesProvider };
}

task('deploy-sismo-addresses-provider')
  .addParam('owner', 'Address of the owner of the contracts registry')
  .addParam('badges', 'Address of the badges contract')
  .addParam('attestationsRegistry', 'Address of the attestationsRegistry contract')
  .addParam('front', 'Address of the front contract')
  .addParam('hydraS1AccountboundAttester', 'Address of the hydraS1AccountboundAttester contract')
  .addParam('availableRootsRegistry', 'Address of the availableRootsRegistry contract')
  .addParam('commitmentMapperRegistry', 'Address of the commitmentMapperRegistry contract')
  .addParam('hydraS1Verifier', 'Address of the hydraS1Verifier contract')
  .setAction(wrapCommonDeployOptions(deploymentAction));
