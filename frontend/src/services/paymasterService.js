// frontend/src/services/paymasterService.js
import { ethers } from 'ethers';

class PaymasterService {
  constructor() {
    this.rpcUrl = 'https://paymaster-testnet.nerochain.io';
    this.entryPoint = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';
    this.paymasterRpc = null;
    this.provider = null;
    this.apiKey = '';
    
    // Caches
    this.supportedTokensCache = new Map();
    this.gasCostEstimationCache = new Map();
    this.cacheExpiryTime = 60 * 1000; // 1 minute cache
  }

  async init(apiKey = '') {
    this.apiKey = apiKey;
    
    // Create provider with retry mechanism
    try {
      this.provider = new ethers.providers.JsonRpcProvider('https://rpc-testnet.nerochain.io');
      await this.provider.getNetwork(); // Test the connection
    } catch (err) {
      console.warn("Failed to initialize primary provider, using fallback", err);
      // Fallback to a different RPC or implementation
      this.provider = new ethers.providers.JsonRpcProvider('https://ethereum.publicnode.com');
    }
    
    // Create paymaster RPC with retry mechanism
    try {
      this.paymasterRpc = new ethers.providers.JsonRpcProvider(this.rpcUrl);
      // Basic connectivity test
      await this.paymasterRpc.getNetwork();
    } catch (err) {
      console.warn("Failed to initialize paymaster RPC", err);
      // Fallback to using the same provider
      this.paymasterRpc = this.provider;
    }
    
    return this;
  }

  /**
   * Check if an account is deployed on-chain
   * @param {string} address - The account address to check
   * @returns {Promise<boolean>} - True if the account is deployed
   */
  async isAccountDeployed(address) {
    if (!this.provider) await this.init();
    
    try {
      const code = await this.provider.getCode(address);
      return code !== '0x';
    } catch (error) {
      console.error('Error checking account deployment:', error);
      return false;
    }
  }

  /**
   * Get tokens supported by the Paymaster
   * @param {string} aaWalletAddress - The AA wallet address
   * @returns {Promise<Array>} - Array of supported tokens
   */
  async getSupportedTokens(aaWalletAddress) {
    if (!this.paymasterRpc) await this.init();
    
    // Check cache first
    const cacheKey = `tokens-${aaWalletAddress}`;
    const cachedData = this.supportedTokensCache.get(cacheKey);
    
    if (cachedData && Date.now() - cachedData.timestamp < this.cacheExpiryTime) {
      return cachedData.tokens;
    }
    
    // Check if account is deployed before making API calls
    const isDeployed = await this.isAccountDeployed(aaWalletAddress);
    if (!isDeployed) {
      console.log("Account not deployed yet, using counterfactual address");
    }
    
    try {
      // Create a minimal UserOp for the request
      const minimalUserOp = {
        sender: aaWalletAddress,
        nonce: "0x0",
        initCode: "0x",
        callData: "0x",
        callGasLimit: "0x0",
        verificationGasLimit: "0x0",
        preVerificationGas: "0x0",
        maxFeePerGas: "0x0",
        maxPriorityFeePerGas: "0x0",
        paymasterAndData: "0x",
        signature: "0x"
      };
      
      // Call the pm_supported_tokens method
      const tokensResponse = await this.paymasterRpc.send("pm_supported_tokens", [
        minimalUserOp,
        this.apiKey,
        this.entryPoint
      ]);
      
      // Enhanced parsing to handle multiple response formats
      let tokens = [];
      
      if (tokensResponse?.tokens) {
        tokens = tokensResponse.tokens;
      } else if (Array.isArray(tokensResponse)) {
        tokens = tokensResponse;
      } else if (typeof tokensResponse === 'object') {
        // Try to find tokens in the response object
        const possibleTokensArray = Object.values(tokensResponse).find(val => Array.isArray(val));
        if (possibleTokensArray && Array.isArray(possibleTokensArray)) {
          tokens = possibleTokensArray;
        }
      }
      
      // Normalize token structure
      const normalizedTokens = tokens.map(token => ({
        address: token.token || token.address,
        decimals: token.decimals || 18, // Default to 18 if not specified
        symbol: token.symbol || 'Unknown',
        type: token.type || 'erc20'
      }));
      
      // Update cache
      this.supportedTokensCache.set(cacheKey, {
        tokens: normalizedTokens,
        timestamp: Date.now()
      });
      
      return normalizedTokens;
    } catch (error) {
      console.error('Error getting supported tokens:', error);
      // Log the error details for debugging
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
      }
      return [];
    }
  }

  /**
   * Get gas cost estimation for a token
   * @param {string} tokenAddress - The token address
   * @param {number} gasLimit - The gas limit
   * @returns {Promise<Object>} - Gas cost estimation
   */
  async getGasCostEstimation(tokenAddress, gasLimit) {
    if (!this.paymasterRpc) await this.init();
    
    // Check cache first
    const cacheKey = `gas-${tokenAddress}-${gasLimit}`;
    const cachedData = this.gasCostEstimationCache.get(cacheKey);
    
    if (cachedData && Date.now() - cachedData.timestamp < this.cacheExpiryTime) {
      return cachedData.estimation;
    }
    
    try {
      // For demo/prototype, return mock values to avoid excessive API calls
      const mockEstimation = {
        gasCostToken: Math.random() * 0.01 + 0.001,
        gasCostUsd: Math.random() * 5 + 1
      };
      
      // Update cache
      this.gasCostEstimationCache.set(cacheKey, {
        estimation: mockEstimation,
        timestamp: Date.now()
      });
      
      return mockEstimation;
      
      // In production, you would call the actual gas estimation API:
      /*
      const estimation = await this.paymasterRpc.send("pm_estimate_gas_cost", [
        tokenAddress,
        gasLimit,
        this.apiKey
      ]);
      
      this.gasCostEstimationCache.set(cacheKey, {
        estimation,
        timestamp: Date.now()
      });
      
      return estimation;
      */
    } catch (error) {
      console.error('Error estimating gas cost:', error);
      return { gasCostToken: 0.001 };
    }
  }
}

// Export as singleton
const paymasterService = new PaymasterService();
export default paymasterService;