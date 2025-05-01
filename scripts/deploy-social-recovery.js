const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying SocialRecoveryModule with account:", deployer.address);

  const SocialRecoveryModule = await hre.ethers.getContractFactory("SocialRecoveryModule");
  const module = await SocialRecoveryModule.deploy();

  await module.waitForDeployment(); // ✅ v6向け修正
  console.log("SocialRecoveryModule deployed to:", await module.getAddress()); // ✅ v6向け修正
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
