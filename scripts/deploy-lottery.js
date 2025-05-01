const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const AlpacaLotto = await hre.ethers.getContractFactory("AlpacaLotto");
  const dummyOracle = "0x000000000000000000000000000000000000dEaD";
  const lotto = await AlpacaLotto.deploy(dummyOracle);

  await lotto.waitForDeployment(); // ← ここを修正！

  console.log("AlpacaLotto deployed to:", await lotto.getAddress()); // ← v6: getAddress()
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
