require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: "0.8.12",
  networks: {
    testnet: {
      url: process.env.NERO_RPC_URL || "https://rpc-testnet.nerochain.io",
      accounts: [process.env.PRIVATE_KEY].filter(Boolean)
    }
  }
};
