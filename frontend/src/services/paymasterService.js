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
  
  /**
   * Get tokens supported by the Paymaster
   */
  async getSupportedTokens(aaWalletAddress) {
    if (!this.paymasterRpc) await this.init();
    
    try {
      // Normalize address
      const normalizedWalletAddress = ethers.utils.getAddress(aaWalletAddress);
      
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
      
      // Call the pm_supported_tokens method
      const tokensResponse = await this.paymasterRpc.send("pm_supported_tokens", [
        minimalUserOp,
        this.apiKey,
        this.entryPoint
      ]);
      
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
   * Sponsor a UserOperation via Paymaster
   */
  async sponsorUserOp(userOp, paymasterOptions) {
    try {
      // Check if account is deployed first
      const isDeployed = await this.isAccountDeployed(userOp.sender);
      
      // If account not deployed and initCode is empty, this will fail
      if (!isDeployed && (!userOp.initCode || userOp.initCode === '0x')) {
        throw new Error('AA20 account not deployed');
      }
      
      // Make the API call to the paymaster with user's preferred payment type
      const res = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'pm_sponsor_userop',
          params: [
            userOp,
            this.apiKey,
            this.entryPoint,
            paymasterOptions 
          ]
        })
      });
  
      const json = await res.json();
      
      if (json.error) {
        console.error('❌ Paymaster error:', json.error);
        
        // Fix for the TypeError: Convert error data to string for safer comparison
        const errorData = json.error.data ? 
          (typeof json.error.data === 'string' ? json.error.data : JSON.stringify(json.error.data)) : '';
        const errorMessage = json.error.message || '';
        
        // Enhanced error handling with clear messages
        if (errorData.includes('AA21') || errorMessage.includes('AA21')) {
          throw new Error('Insufficient funds to deploy account. Please add NERO tokens to your wallet.');
        } else if (errorData.includes('AA20') || errorMessage.includes('AA20')) {
          throw new Error('Smart contract wallet not deployed.');
        } else if (errorData.includes('AA25') || errorMessage.includes('AA25') || 
                   errorMessage.includes('invalid account nonce')) {
          // Add handling for nonce error
          throw new Error('Account nonce is invalid. Please try again.');
        } else if (errorData.includes('AA33') || errorMessage.includes('AA33')) {
          throw new Error('Token approval failed. Please try again or choose a different token.');
        } else if (errorData.includes('gas type') || 
                   errorMessage.includes('Type 0') || 
                   errorMessage.includes('sponsored')) {
          // If Type 0 fails, retry with Type 1 as fallback
          console.warn('Type 0 (free gas) not supported, automatically trying with Type 1');
          
          if (paymasterOptions.type === '0' || paymasterOptions.type === 0) {
            paymasterOptions.type = '1';
            
            // If token isn't provided for Type 1, use USDC by default
            if (!paymasterOptions.token) {
              const USDC_ADDRESS = '0xC86Fed58edF0981e927160C50ecB8a8B05B32fed';
              paymasterOptions.token = USDC_ADDRESS;
            }
            
            // Retry with Type 1
            return this.sponsorUserOp(userOp, paymasterOptions);
          }
        }
        
        // Generic error message if not matched above
        throw new Error(`Paymaster error: ${errorMessage || 'Unknown error'}`);
      }
      
      return json.result.paymasterAndData;
    } catch (error) {
      console.error('Paymaster sponsorUserOp error:', error.message);
      throw error;
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