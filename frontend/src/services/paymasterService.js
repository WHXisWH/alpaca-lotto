import { ethers } from 'ethers';
import SUPPORTED_TOKENS from '../constants/tokens';

/**
 * Service for interacting with NERO Chain's Paymaster for Account Abstraction
 */
class PaymasterService {
  constructor() {
    this.rpcUrl = import.meta.env.VITE_PAYMASTER_URL || 'https://paymaster-testnet.nerochain.io';
    this.entryPoint = import.meta.env.VITE_ENTRYPOINT_ADDRESS || '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';
    this.apiKey = import.meta.env.VITE_PAYMASTER_API_KEY || '';
    this.tokenPaymasterAddress = ethers.utils.getAddress(import.meta.env.VITE_TOKEN_PAYMASTER_ADDRESS || "0x5a6680dFd4a77FEea0A7be291147768EaA2414ad");
    
    // Cache for performance
    this.supportedTokensCache = new Map();
    this.gasCostEstimationCache = new Map();
    this.cacheExpiryTime = 60 * 1000; // 1 minute cache
    
    // Initialize providers
    this.provider = null;
    this.paymasterRpc = null;
  }

  /**
   * Initialize the service with providers and API key
   */
  async init(apiKey = '') {
    if (apiKey) this.apiKey = apiKey;
    
    try {
      // Initialize main provider
      this.provider = new ethers.providers.JsonRpcProvider(
        import.meta.env.VITE_NERO_RPC_URL || 'https://rpc-testnet.nerochain.io'
      );
      
      // Initialize paymaster RPC provider
      this.paymasterRpc = new ethers.providers.JsonRpcProvider(this.rpcUrl);
      
      // Test connections
      await Promise.all([
        this.provider.getNetwork().catch(() => console.warn("Main provider connection failed")),
        this.paymasterRpc.getNetwork().catch(() => console.warn("Paymaster RPC connection failed"))
      ]);
      
      return this;
    } catch (err) {
      console.error("Failed to initialize PaymasterService:", err);
      return this;
    }
  }

  /**
   * Check if an account is deployed on-chain
   */
  async isAccountDeployed(address) {
    if (!this.provider) await this.init();
    
    try {
      const code = await this.provider.getCode(ethers.utils.getAddress(address));
      return code !== '0x';
    } catch (error) {
      console.warn('Error checking account deployment:', error.message);
      return false;
    }
  }
  
  /**
   * Check if a token is supported by the Paymaster
   */
  async isTokenSupported(tokenAddress) {
    try {
      const supportedTokens = await this.getSupportedTokens();
      return supportedTokens.some(token => 
        token.address.toLowerCase() === tokenAddress.toLowerCase()
      );
    } catch (error) {
      console.warn('Error checking token support:', error.message);
      return false;
    }
  }
  
  /**
   * Check if a token is approved for the Paymaster
   */
  async isTokenApproved(tokenAddress, walletAddress) {
    if (!this.provider) await this.init();
    
    try {
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ['function allowance(address owner, address spender) view returns (uint256)'],
        this.provider
      );
      
      const allowance = await tokenContract.allowance(
        walletAddress,
        this.tokenPaymasterAddress
      );
      
      return allowance.gt(0);
    } catch (error) {
      console.warn('Error checking token approval:', error.message);
      return false;
    }
  }
  
  async checkTokenDepositAndApproval(tokenAddress, walletAddress, amount = null) {
    if (!this.provider) await this.init();
    
    try {
      const normalizedTokenAddress = ethers.utils.getAddress(tokenAddress);
      const normalizedWalletAddress = ethers.utils.getAddress(walletAddress);
      const normalizedPaymasterAddress = ethers.utils.getAddress(this.tokenPaymasterAddress);
      
      // 1. Check approval
      const tokenContract = new ethers.Contract(
        normalizedTokenAddress,
        ['function allowance(address owner, address spender) view returns (uint256)'],
        this.provider
      );
      
      const allowance = await tokenContract.allowance(
        normalizedWalletAddress,
        normalizedPaymasterAddress
      );
      
      const requiredAmount = amount ? ethers.utils.parseUnits(amount, 18) : ethers.constants.MaxUint256.div(2);
      
      if (allowance.lt(requiredAmount)) {
        console.log(`Token approval insufficient: ${allowance.toString()} < ${requiredAmount.toString()}`);
        return false;
      }
      
      // 2. For Type 1, we'd also check deposit to EntryPoint, but this is simplified for now
      return true;
    } catch (error) {
      console.warn('Error checking token deposit and approval:', error.message);
      return false;
    }
  }
  
  /**
   * Get tokens supported by the Paymaster
   */
  async getSupportedTokens(aaWalletAddress) {
    if (!this.paymasterRpc) await this.init();
    
    try {
      // Use a default address if none is provided
      const address = aaWalletAddress || '0x1234567890123456789012345678901234567890';
      
      // Normalize address
      const normalizedWalletAddress = ethers.utils.getAddress(address);
      
      // Check cache first
      const cacheKey = `tokens-${normalizedWalletAddress}`;
      const cachedData = this.supportedTokensCache.get(cacheKey);
      if (cachedData && Date.now() - cachedData.timestamp < this.cacheExpiryTime) {
        return cachedData.tokens;
      }
      
      // Create a minimal UserOp for the request
      const minimalUserOp = {
        sender: normalizedWalletAddress,
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
      
      console.log("Requesting supported tokens from Paymaster");
      // Call the pm_supported_tokens method
      const tokensResponse = await this.paymasterRpc.send("pm_supported_tokens", [
        minimalUserOp,
        this.apiKey,
        this.entryPoint
      ]);
      
      console.log("Received token response:", tokensResponse);
      
      // Process response with robust handling of different response formats
      let tokens = [];
      
      if (tokensResponse?.tokens) {
        tokens = tokensResponse.tokens;
      } else if (Array.isArray(tokensResponse)) {
        tokens = tokensResponse;
      } else if (typeof tokensResponse === 'object') {
        // Try to find tokens in the response object
        const possibleTokensArray = Object.values(tokensResponse).find(val => Array.isArray(val));
        if (possibleTokensArray) {
          tokens = possibleTokensArray;
        }
      }
      
      // Format tokens consistently
      const normalizedTokens = tokens.map(token => ({
        address: ethers.utils.getAddress(token.token || token.address),
        decimals: token.decimals || 18,
        symbol: token.symbol || 'Unknown',
        type: token.type || 'erc20'
      }));
      
      // Cache the results
      if (normalizedTokens.length > 0) {
        this.supportedTokensCache.set(cacheKey, {
          tokens: normalizedTokens,
          timestamp: Date.now()
        });
        return normalizedTokens;
      }
      
      // Fallback to known supported tokens if API returns empty
      const fallbackTokens = Object.values(SUPPORTED_TOKENS).map(token => ({
        address: ethers.utils.getAddress(token.address),
        decimals: token.decimals,
        symbol: token.symbol,
        type: 'erc20'
      }));
      
      this.supportedTokensCache.set(cacheKey, {
        tokens: fallbackTokens,
        timestamp: Date.now()
      });
      
      return fallbackTokens;
    } catch (error) {
      console.error('Error getting supported tokens:', error.message);
      
      // Return fallback tokens in case of error
      return Object.values(SUPPORTED_TOKENS).map(token => ({
        address: ethers.utils.getAddress(token.address),
        decimals: token.decimals,
        symbol: token.symbol,
        type: 'erc20'
      }));
    }
  }

  /**
   * Get gas cost estimation for a token
   */
  async getGasCostEstimation(tokenAddress, gasLimit) {
    if (!this.paymasterRpc) await this.init();
    
    try {
      // For Type 0 (sponsored), return zero cost
      if (!tokenAddress) {
        return { gasCostToken: 0, gasCostUsd: 0 };
      }
      
      // Check cache first
      const cacheKey = `gas-${tokenAddress}-${gasLimit}`;
      const cachedData = this.gasCostEstimationCache.get(cacheKey);
      if (cachedData && Date.now() - cachedData.timestamp < this.cacheExpiryTime) {
        return cachedData.estimation;
      }
      
      // Create a minimal UserOp for the request
      const minimalUserOp = {
        sender: '0x1234567890123456789012345678901234567890',
        nonce: "0x0",
        initCode: "0x",
        callData: "0x",
        callGasLimit: gasLimit.toString(16),
        verificationGasLimit: "0x0",
        preVerificationGas: "0x0",
        maxFeePerGas: "0x0",
        maxPriorityFeePerGas: "0x0",
        paymasterAndData: "0x",
        signature: "0x"
      };
      
      try {
        // Call the pm_estimate_price method if it exists
        const priceResponse = await this.paymasterRpc.send("pm_estimate_price", [
          minimalUserOp,
          this.apiKey,
          this.entryPoint,
          ethers.utils.getAddress(tokenAddress)
        ]);
        
        if (priceResponse && priceResponse.price) {
          const estimation = {
            gasCostToken: parseFloat(priceResponse.price),
            gasCostUsd: parseFloat(priceResponse.priceUsd || '0')
          };
          
          this.gasCostEstimationCache.set(cacheKey, {
            estimation,
            timestamp: Date.now()
          });
          
          return estimation;
        }
      } catch (apiError) {
        console.warn("Error estimating price from Paymaster API:", apiError.message);
      }
      
      // Return mock values if API call failed
      const mockEstimation = {
        gasCostToken: 0.001,
        gasCostUsd: 1.5
      };
      
      this.gasCostEstimationCache.set(cacheKey, {
        estimation: mockEstimation,
        timestamp: Date.now()
      });
      
      return mockEstimation;
    } catch (error) {
      console.error('Error estimating gas cost:', error.message);
      return { gasCostToken: 0.001 };
    }
  }
}

// Export as singleton
const paymasterService = new PaymasterService();
export default paymasterService;