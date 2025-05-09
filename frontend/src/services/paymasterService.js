import { ethers } from 'ethers';
import SUPPORTED_TOKENS from '../constants/tokens';

// Token Paymaster address
const TOKEN_PAYMASTER_ADDRESS = import.meta.env.VITE_TOKEN_PAYMASTER_ADDRESS || "0xB24a30A3971e4d9bf771BDc81735e8cbEc95D578";

class PaymasterService {
  constructor() {
    this.rpcUrl = import.meta.env.VITE_PAYMASTER_URL || 'https://paymaster-testnet.nerochain.io';
    this.entryPoint = import.meta.env.VITE_ENTRYPOINT_ADDRESS || '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';
    this.paymasterRpc = null;
    this.provider = null;
    this.apiKey = import.meta.env.VITE_PAYMASTER_API_KEY || '';
    
    // Caches
    this.supportedTokensCache = new Map();
    this.gasCostEstimationCache = new Map();
    this.cacheExpiryTime = 60 * 1000; // 1 minute cache
    
    // Known valid tokens - prefill with our constants
    this.validatedTokens = new Set(Object.values(SUPPORTED_TOKENS).map(t => t.address.toLowerCase()));
  }

  async init(apiKey = '') {
    this.apiKey = apiKey || this.apiKey;
    
    // Create provider with retry mechanism
    try {
      this.provider = new ethers.providers.JsonRpcProvider(
        import.meta.env.VITE_NERO_RPC_URL || 'https://rpc-testnet.nerochain.io'
      );
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
   * Check if a token is currently supported by the Paymaster
   * @param {string} tokenAddress - Token address to check
   * @returns {Promise<boolean>} - Whether the token is supported
   */
  async isTokenSupported(tokenAddress) {
    if (!tokenAddress) return false;
    
    const normalizedAddress = tokenAddress.toLowerCase();
    
    // Check our validated set first (cache)
    if (this.validatedTokens.has(normalizedAddress)) {
      return true;
    }
    
    // Fall back to checking against known supported tokens
    const knownTokens = Object.values(SUPPORTED_TOKENS).map(t => t.address.toLowerCase());
    if (knownTokens.includes(normalizedAddress)) {
      this.validatedTokens.add(normalizedAddress);
      return true;
    }
    
    // If not in our known list, try to check with the API
    try {
      const tokens = await this.getSupportedTokens('0x1234567890123456789012345678901234567890');
      const isSupported = tokens.some(token => 
        token.address.toLowerCase() === normalizedAddress
      );
      
      if (isSupported) {
        this.validatedTokens.add(normalizedAddress);
      }
      
      return isSupported;
    } catch (error) {
      console.error('Error checking token support:', error);
      return false;
    }
  }
  
  /**
   * Check if a token is approved for the Paymaster
   * @param {string} tokenAddress - Token address
   * @param {string} ownerAddress - Token owner address
   * @returns {Promise<boolean>} - Whether token is approved
   */
  async isTokenApproved(tokenAddress, ownerAddress) {
    if (!this.provider) await this.init();
    
    try {
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ['function allowance(address owner, address spender) view returns (uint256)'],
        this.provider
      );
      
      const allowance = await tokenContract.allowance(ownerAddress, TOKEN_PAYMASTER_ADDRESS);
      return allowance.gt(ethers.BigNumber.from(0));
    } catch (error) {
      console.error('Error checking token approval:', error);
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
      
      // Try getting supported tokens from the Paymaster API
      try {
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
        
        if (normalizedTokens.length > 0) {
          // Update our validated tokens set
          normalizedTokens.forEach(token => {
            if (token.address) {
              this.validatedTokens.add(token.address.toLowerCase());
            }
          });
          
          // Update cache
          this.supportedTokensCache.set(cacheKey, {
            tokens: normalizedTokens,
            timestamp: Date.now()
          });
          
          return normalizedTokens;
        }
      } catch (apiError) {
        console.warn("Error fetching tokens from Paymaster API, falling back to supported tokens list", apiError);
      }
      
      // If API fails or returns empty, use our known supported tokens
      const fallbackTokens = [
        {
          address: SUPPORTED_TOKENS.DAI.address,
          decimals: SUPPORTED_TOKENS.DAI.decimals,
          symbol: SUPPORTED_TOKENS.DAI.symbol,
          type: 'erc20'
        },
        {
          address: SUPPORTED_TOKENS.USDC.address,
          decimals: SUPPORTED_TOKENS.USDC.decimals,
          symbol: SUPPORTED_TOKENS.USDC.symbol,
          type: 'erc20'
        },
        {
          address: SUPPORTED_TOKENS.USDT.address,
          decimals: SUPPORTED_TOKENS.USDT.decimals,
          symbol: SUPPORTED_TOKENS.USDT.symbol,
          type: 'erc20'
        }
      ];
      
      // Update cache with fallback tokens
      this.supportedTokensCache.set(cacheKey, {
        tokens: fallbackTokens,
        timestamp: Date.now()
      });
      
      return fallbackTokens;
    } catch (error) {
      console.error('Error getting supported tokens:', error);
      
      // Return fallback tokens in case of error
      return [
        {
          address: SUPPORTED_TOKENS.DAI.address,
          decimals: SUPPORTED_TOKENS.DAI.decimals,
          symbol: SUPPORTED_TOKENS.DAI.symbol,
          type: 'erc20'
        },
        {
          address: SUPPORTED_TOKENS.USDC.address,
          decimals: SUPPORTED_TOKENS.USDC.decimals,
          symbol: SUPPORTED_TOKENS.USDC.symbol,
          type: 'erc20'
        },
        {
          address: SUPPORTED_TOKENS.USDT.address,
          decimals: SUPPORTED_TOKENS.USDT.decimals,
          symbol: SUPPORTED_TOKENS.USDT.symbol,
          type: 'erc20'
        }
      ];
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
    
    // Check if token is supported first
    const isSupported = await this.isTokenSupported(tokenAddress);
    if (!isSupported) {
      console.warn(`Token ${tokenAddress} is not supported by the Paymaster`);
      throw new Error('Token is not supported by the Paymaster');
    }
    
    // Check cache first
    const cacheKey = `gas-${tokenAddress}-${gasLimit}`;
    const cachedData = this.gasCostEstimationCache.get(cacheKey);
    
    if (cachedData && Date.now() - cachedData.timestamp < this.cacheExpiryTime) {
      return cachedData.estimation;
    }
    
    try {
      // Try to get a real estimation if possible
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
          tokenAddress
        ]);
        
        if (priceResponse && priceResponse.price) {
          const estimation = {
            gasCostToken: parseFloat(priceResponse.price),
            gasCostUsd: parseFloat(priceResponse.priceUsd || '0')
          };
          
          // Update cache
          this.gasCostEstimationCache.set(cacheKey, {
            estimation,
            timestamp: Date.now()
          });
          
          return estimation;
        }
      } catch (apiError) {
        console.warn("Error estimating price from Paymaster API, falling back to mock values", apiError);
      }
      
      // For demo/prototype, return mock values if API call failed
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
    } catch (error) {
      console.error('Error estimating gas cost:', error);
      return { gasCostToken: 0.001 };
    }
  }
}

// Export as singleton
const paymasterService = new PaymasterService();
export default paymasterService;