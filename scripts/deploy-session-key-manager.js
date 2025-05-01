const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying SessionKeyManager with account:", deployer.address);

  const SessionKeyManager = await hre.ethers.getContractFactory("SessionKeyManager");
  const manager = await SessionKeyManager.deploy();

  await manager.waitForDeployment(); // ✅ 修正！

  console.log("SessionKeyManager deployed to:", await manager.getAddress()); // ✅ 修正！
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
