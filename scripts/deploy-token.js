const { ethers } = require('hardhat');

async function main() {
  const [deployer] = await ethers.getSigners();

  const Token1 = await ethers.getContractFactory('TestToken');
  const token1 = await Token1.deploy('Token One', 'TK1', ethers.parseEther('1000000'));
  await token1.waitForDeployment();
  console.log('Token1 deployed to:', await token1.getAddress());

  const Token2 = await ethers.getContractFactory('TestToken');
  const token2 = await Token2.deploy('Token Two', 'TK2', ethers.parseEther('500000'));
  await token2.waitForDeployment();
  console.log('Token2 deployed to:', await token2.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
