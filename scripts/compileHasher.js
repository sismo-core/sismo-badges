const { poseidonContract } = require('circomlibjs');
const Artifactor = require('@truffle/artifactor');

const artifactor = new Artifactor('build');

function main() {
  const contractData = {
    contractName: 'Hasher',
    abi: poseidonContract.generateABI(2),
    bytecode: poseidonContract.createCode(2),
  };

  artifactor.save(contractData);
}

main();
