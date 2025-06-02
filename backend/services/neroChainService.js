require('dotenv').config();
const { ethers } = require('ethers');
const AlpacaLottoABI = require('../abis/AlpacaLotto.json');
const PacaLuckTokenABI = require('../abis/PacaLuckToken.json');

const RPC_URL = process.env.RPC_URL;
const MINTER_PRIVATE_KEY = process.env.MINTER_PRIVATE_KEY;
const ALPACALOTTO_CONTRACT_ADDRESS = process.env.ALPACALOTTO_CONTRACT_ADDRESS;
const PACALUCKTOKEN_CONTRACT_ADDRESS = process.env.PACALUCKTOKEN_CONTRACT_ADDRESS;

const USDC_DECIMALS = 18;

let provider;
let minterWallet;
let alpacaLottoContract;
let pacaLuckTokenContract;

function getProvider() {
  if (!provider) {
    if (!RPC_URL) {
      throw new Error("RPC_URL is not configured in .env");
    }
    provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  }
  return provider;
}

function getMinterWallet() {
  if (!minterWallet) {
    if (!MINTER_PRIVATE_KEY) {
      console.warn("MINTER_PRIVATE_KEY is not set. Minting operations will fail.");
      return null;
    }
    const currentProvider = getProvider();
    minterWallet = new ethers.Wallet(MINTER_PRIVATE_KEY, currentProvider);
  }
  return minterWallet;
}

function getAlpacaLottoContract(signerOrProvider) {
  if (!ALPACALOTTO_CONTRACT_ADDRESS) {
    throw new Error("ALPACALOTTO_CONTRACT_ADDRESS is not configured in .env");
  }
  const currentSignerOrProvider = signerOrProvider || getProvider();
  if (!alpacaLottoContract || alpacaLottoContract.signer !== currentSignerOrProvider) {
     alpacaLottoContract = new ethers.Contract(ALPACALOTTO_CONTRACT_ADDRESS, AlpacaLottoABI, currentSignerOrProvider);
  }
  return alpacaLottoContract;
}

function getPacaLuckTokenContract(signerOrProvider) {
  if (!PACALUCKTOKEN_CONTRACT_ADDRESS) {
    throw new Error("PACALUCKTOKEN_CONTRACT_ADDRESS is not configured in .env");
  }
  const currentSignerOrProvider = signerOrProvider || getMinterWallet();
  if (!currentSignerOrProvider) {
    console.error("Minter wallet not available for PacaLuckToken contract.");
    return null;
  }
  if (!pacaLuckTokenContract || pacaLuckTokenContract.signer !== currentSignerOrProvider) {
    pacaLuckTokenContract = new ethers.Contract(PACALUCKTOKEN_CONTRACT_ADDRESS, PacaLuckTokenABI, currentSignerOrProvider);
  }
  return pacaLuckTokenContract;
}

async function getHasMadeFirstPurchase(userAddress) {
  try {
    const contract = getAlpacaLottoContract();
    return await contract.hasMadeFirstPurchase(userAddress);
  } catch (error) {
    console.error(`Error fetching hasMadeFirstPurchase for ${userAddress}:`, error);
    throw error;
  }
}

async function getCumulativeTicketsPurchased(userAddress) {
  try {
    const contract = getAlpacaLottoContract();
    const ticketsPurchasedInWei = await contract.cumulativeTicketsPurchased(userAddress);
    return parseFloat(ethers.utils.formatUnits(ticketsPurchasedInWei, USDC_DECIMALS));
  } catch (error) {
    console.error(`Error fetching cumulativeTicketsPurchased for ${userAddress}:`, error);
    throw error;
  }
}

async function mintPLTTokens(toAddress, amountInPacaUnits) {
  const contract = getPacaLuckTokenContract();
  if (!contract) {
    throw new Error("PacaLuckToken contract not initialized for minting.");
  }
  try {
    const amountInWei = ethers.utils.parseUnits(amountInPacaUnits.toString(), 18);
    const tx = await contract.mint(toAddress, amountInWei);
    await tx.wait();
    return tx.hash;
  } catch (error) {
    console.error(`Error minting PLT tokens to ${toAddress}:`, error);
    throw error;
  }
}

module.exports = {
  getProvider,
  getMinterWallet,
  getAlpacaLottoContract,
  getPacaLuckTokenContract,
  getHasMadeFirstPurchase,
  getCumulativeTicketsPurchased,
  mintPLTTokens,
};