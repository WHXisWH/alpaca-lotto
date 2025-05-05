import { ethers } from 'ethers';
import axios from 'axios';

// Constants
const CONSTANTS = {
  PAYMASTER_URL: import.meta.env.VITE_PAYMASTER_URL || 'https://paymaster-testnet.nerochain.io',
  PAYMASTER_API_KEY: import.meta.env.VITE_PAYMASTER_API_KEY || '',
  ENTRYPOINT_ADDRESS: import.meta.env.VITE_ENTRYPOINT_ADDRESS || '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
};

/**
 * PaymasterService - A dedicated service for NERO Chain Paymaster integration
 */
class PaymasterService {
  constructor() {
    this.provider = null;
    this.initialized = false;
  }

  /**
   * Initialize the Paymaster service
   */
  async init() {
    try {
      // Create JSON-RPC provider for the Paymaster
      this.provider = new ethers.providers.JsonRpcProvider(CONSTANTS.PAYMASTER_URL);
      this.initialized = true;
      
      return true;
    } catch (error) {
      console.error('Error initializing Paymaster service:', error);
      return false;
    }
  }

  /**
   * Get supported tokens from Paymaster
   * @param {string} aaWalletAddress - AA wallet address
   * @returns {Array} - List of supported tokens
   */
  async getSupportedTokens(aaWalletAddress) {
    try {
      if (!this.initialized) {
        await this.init();
      }
      
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
      const response = await this.provider.send("pm_supported_tokens", [
        minimalUserOp,
        CONSTANTS.PAYMASTER_API_KEY,
        CONSTANTS.ENTRYPOINT_ADDRESS
      ]);
      
      if (!response || !response.tokens) {
        console.warn('Unexpected response format from Paymaster:', response);
        return this._getMockSupportedTokens();
      }
      
      // Format the tokens
      return response.tokens.map(token => ({
        address: token.token || token.address,
        symbol: token.symbol,
        name: token.name || token.symbol,
        decimals: token.decimals,
        type: token.type
      }));
    } catch (error) {
      console.error('Error fetching supported tokens from Paymaster:', error);
      return this._getMockSupportedTokens();
    }
  }

  /**
   * Get Paymaster config from AA Platform
   * @param {string} apiKey - AA Platform API key
   * @returns {Object} - Paymaster configuration
   */
  async getPaymasterConfig(apiKey = CONSTANTS.PAYMASTER_API_KEY) {
    try {
      // Initialize if needed
      if (!this.initialized) {
        await this.init();
      }
      
      // Try to fetch paymaster configuration from the AA Platform
      const response = await axios.get(
        `${CONSTANTS.PAYMASTER_URL}/api/config`,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.data && response.data.success) {
        return response.data.config;
      } else {
        console.warn('Failed to fetch Paymaster config:', response.data);
        return this._getMockPaymasterConfig();
      }
    } catch (error) {
      console.error('Error fetching Paymaster config:', error);
      return this._getMockPaymasterConfig();
    }
  }

  /**
   * Get token price data
   * @param {string} tokenAddress - Token contract address
   * @returns {Object} - Token price data
   */
  async getTokenPrice(tokenAddress) {
    try {
      // Initialize if needed
      if (!this.initialized) {
        await this.init();
      }
      
      // Try to fetch token price from the AA Platform
      const response = await axios.get(
        `${CONSTANTS.PAYMASTER_URL}/api/price/${tokenAddress}`,
        {
          headers: {
            'Authorization': `Bearer ${CONSTANTS.PAYMASTER_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.data && response.data.success) {
        return response.data.price;
      } else {
        console.warn('Failed to fetch token price:', response.data);
        return this._getMockTokenPrice(tokenAddress);
      }
    } catch (error) {
      console.error('Error fetching token price:', error);
      return this._getMockTokenPrice(tokenAddress);
    }
  }

  /**
   * Get gas cost estimation for paying with a specific token
   * @param {string} tokenAddress - Token contract address
   * @param {number} gasLimit - Estimated gas limit
   * @returns {Object} - Gas cost estimation
   */
  async getGasCostEstimation(tokenAddress, gasLimit) {
    try {
      // Initialize if needed
      if (!this.initialized) {
        await this.init();
      }
      
      // Get token price
      const tokenPrice = await this.getTokenPrice(tokenAddress);
      
      // Get gas price
      const gasPrice = await this.provider.getGasPrice();
      
      // Calculate gas cost in native token
      const gasCostNative = gasLimit * gasPrice.toNumber();
      
      // Convert to token amount
      const gasCostToken = gasCostNative * (1 / tokenPrice.price);
      
      return {
        gasCostNative,
        gasCostToken,
        gasPrice: gasPrice.toString(),
        tokenPrice: tokenPrice.price
      };
    } catch (error) {
      console.error('Error estimating gas cost:', error);
      
      // Return mock estimation
      return {
        gasCostNative: 0.001 * 10**18, // 0.001 NERO
        gasCostToken: 0.001 * (tokenAddress === '0x6b175474e89094c44da98b954eedeac495271d0f' ? 1 : 2), // Mock conversion based on token
        gasPrice: '5000000000', // 5 gwei
        tokenPrice: 1.0
      };
    }
  }

  /**
   * Generate Paymaster data for UserOperation
   * @param {number} type - Payment type (0: sponsored, 1: prepay, 2: postpay)
   * @param {string} token - Token address for payment (for types 1 and 2)
   * @param {Object} userOp - UserOperation object
   * @returns {string} - Paymaster data
   */
  async generatePaymasterData(type, token, userOp) {
    try {
      // Initialize if needed
      if (!this.initialized) {
        await this.init();
      }
      
      // Call the pm_sponsor method
      const response = await this.provider.send("pm_sponsor", [
        userOp,
        {
          type,
          token,
          apikey: CONSTANTS.PAYMASTER_API_KEY
        },
        CONSTANTS.ENTRYPOINT_ADDRESS
      ]);
      
      if (!response || !response.paymasterAndData) {
        console.warn('Unexpected response format from Paymaster:', response);
        return "0x"; // Empty paymaster data
      }
      
      return response.paymasterAndData;
    } catch (error) {
      console.error('Error generating Paymaster data:', error);
      return "0x"; // Empty paymaster data
    }
  }

  /**
   * Get mock supported tokens (for development/testing)
   * @returns {Array} - Mock supported tokens
   * @private
   */
  _getMockSupportedTokens() {
    return [
      {
        address: '0x6b175474e89094c44da98b954eedeac495271d0f',
        symbol: 'DAI',
        name: 'Dai Stablecoin',
        decimals: 18,
        type: 1
      },
      {
        address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        type: 1
      },
      {
        address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
        symbol: 'USDT',
        name: 'Tether USD',
        decimals: 6,
        type: 1
      },
      {
        address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
        symbol: 'WBTC',
        name: 'Wrapped Bitcoin',
        decimals: 8,
        type: 1
      },
      {
        address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
        symbol: 'WETH',
        name: 'Wrapped Ether',
        decimals: 18,
        type: 1
      }
    ];
  }

  /**
   * Get mock Paymaster configuration (for development/testing)
   * @returns {Object} - Mock Paymaster configuration
   * @private
   */
  _getMockPaymasterConfig() {
    return {
      paymasterAddress: '0x9406Cc6185a346906296840746125a0E44976454',
      supportedPaymentTypes: [0, 1, 2],
      defaultType: 0,
      gasLimitOverhead: 55000,
      defaultGasPrice: '5000000000', // 5 gwei
      maxGasPrice: '50000000000', // 50 gwei
      dailyQuota: 1000,
      dailyUserQuota: 10,
      dailyTokenQuota: 100
    };
  }

  /**
   * Get mock token price (for development/testing)
   * @param {string} tokenAddress - Token address
   * @returns {Object} - Mock token price data
   * @private
   */
  _getMockTokenPrice(tokenAddress) {
    const priceMap = {
      '0x6b175474e89094c44da98b954eedeac495271d0f': 1.0, // DAI
      '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 1.0, // USDC
      '0xdac17f958d2ee523a2206206994597c13d831ec7': 1.0, // USDT
      '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': 65000, // WBTC
      '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': 3800 // WETH
    };
    
    return {
      price: priceMap[tokenAddress.toLowerCase()] || 1.0,
      timestamp: Math.floor(Date.now() / 1000),
      source: 'mock'
    };
  }
}

export default new PaymasterService();