<br />
<div align="center">
  <img src="docs/top.png" alt="Logo" width="100" height="100" style="borderRadius: 20px">

  <h3 align="center">
    Sismo Protocol Contracts
  </h3>

  <p align="center">
    Made by <a href="https://www.sismo.io/" target="_blank">Sismo</a>
  </p>
  
  <p align="center">
    <a href="https://discord.gg/sismo" target="_blank">
        <img src="https://img.shields.io/badge/Discord-7289DA?style=for-the-badge&logo=discord&logoColor=white"/>
    </a>
    <a href="https://twitter.com/sismo_eth" target="_blank">
        <img src="https://img.shields.io/badge/Twitter-1DA1F2?style=for-the-badge&logo=twitter&logoColor=white"/>
    </a>
  </p>
  <a href="https://www.sismo.io/" target="_blank">
    
  </a>
</div>
<br/>
This repository contains the smart contracts of the Sismo Protocol.

There are three core contracts:

 - `core/AttestationsRegistry.sol`: The registry stores all attestations. It is owned by the governance that authorize/unauthorize issuers to record in it
 - `core/Attester.sol` The standard abstract contract must be inherited by attesters. Attesters are issuers of attestations. They verify user requests and build attestations that will be recorded in the registry
 - `core/Badges.sol` Reads the registry. Stateless Non Transferable Token view of attestations (ERC1155)

It also contains implementations of attester in `attesters/`:
- `HydraS1SimpleAttester.sol`: ZK Attester using the [Hydra S1 Proving Scheme](https://hydra-s1.docs.sismo.io) and the notion of tickets (nullifiers). Users must provide a ZK Proof along their request to generate attestations
- `HydraS1SoulboundAttester.sol`: Soulbound version of the Simple Hydra S1 Simple Attester. (Users can update at will where the attestation is stored)

<br/><br/>


## Sismo protocol

A complete overview of the protocol is available in our [documentation](https://protocol.docs.sismo.io)


## Deployed contracts

Deployed contracts can be found [here](https://docs.sismo.io/sismo-docs/deployed-contract-addresses)


## Usage
### Installation
```
yarn
```

### Compile contracts
Compile contracts using hardhat
```
yarn compile
```

### Test
Launch all tests

```
yarn test
```

### Print storage layout 
```
yarn storage-layout
```

### Deploy on local chain

Terminal tab 1
```
yarn chain
```

Terminal tab 2
```
yarn deploy:local
```


## Create a new Attester

To develop a new attester, you must inherit the `core/Attester.sol` abstract contract and implement the following functions: 

-  `_verifyRequest(request, proofData)`: You must implement the user request verification against the proof provided by the user
-  `buildAttestations(request, proofData)`: You must build the attestations that will be recorded from a verified user request

There are other optional hook functions that can be implemented:

- `_beforeRecordAttestations(request, proofData)`
- `_afterRecordAttestations(request, proofData)`

The `/attesters/hydra-s1/HydraS1SimpleAttester.sol` is a good example of an attester implementing those functions.

A [guide](https://attesters.docs.sismo.io) is offered in our documentation.

Feel free open a PR with your new attester in `/attester`!

## License

Distributed under the MIT License.

## Contribute

Please, feel free to open issues, PRs or simply provide feedback!

## Contact

Prefer [Discord](https://discord.gg/sismo) or [Twitter](https://twitter.com/sismo_eth)

<br/>
<img src="https://static.sismo.io/readme/bottom-main.png" alt="bottom" width="100%" >

