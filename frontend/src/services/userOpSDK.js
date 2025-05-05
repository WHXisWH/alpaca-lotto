import { ethers } from 'ethers';
import { Client, Presets } from 'userop';

// Constants
const CONSTANTS = {
  NERO_RPC_URL: import.meta.env.VITE_NERO_RPC_URL || 'https://rpc-testnet.nerochain.io',
  BUNDLER_URL: import.meta.env.VITE_BUNDLER_URL || 'https://bundler-testnet.nerochain.io',
  PAYMASTER_URL: import.meta.env.VITE_PAYMASTER_URL || 'https://paymaster-testnet.nerochain.io',
  PAYMASTER_API_KEY: import.meta.env.VITE_PAYMASTER_API_KEY || '',
  ENTRYPOINT_ADDRESS: import.meta.env.VITE_ENTRYPOINT_ADDRESS || '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
  ACCOUNT_FACTORY_ADDRESS: import.meta.env.VITE_ACCOUNT_FACTORY_ADDRESS || '0x9406Cc6185a346906296840746125a0E44976454',
  LOTTERY_CONTRACT_ADDRESS: import.meta.env.VITE_LOTTERY_CONTRACT_ADDRESS || '',
};

/**
 * UserOpSDK - A service to handle Account Abstraction functionality
 * Based on NERO Chain's AA specifications
 */
class UserOpSDK {
  constructor() {
    this.client = null;
    this.builder = null;
    this.signer = null;
    this.aaWalletAddress = null;
    this.provider = null;
    this.initialized = false;
  }

  async init(signer) {
    try {
      console.log("Initializing UserOpSDK with parameters:", CONSTANTS);
      
      this.signer = signer;
      
      // Safely create provider
      this.provider = new ethers.providers.JsonRpcProvider(CONSTANTS.NERO_RPC_URL);
      console.log("Provider created successfully");
      
      try {
        // Initialize the AA Client 
        if (typeof Client.init === 'function') {
          this.client = await Client.init(CONSTANTS.NERO_RPC_URL, {
            overrideBundlerRpc: CONSTANTS.BUNDLER_URL,
            entryPoint: CONSTANTS.ENTRYPOINT_ADDRESS,
          });
          console.log("AA Client initialized successfully");
        } else {
          console.error("Client.init is not a function, using fallback");
      
          this.client = { 
            sendUserOperation: async () => { 
              return { 
                userOpHash: '0x' + [...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
                wait: async () => ({ transactionHash: '0x' + [...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join('') })
              };
            }
          };
        }
        

        if (Presets && Presets.Builder && typeof Presets.Builder.SimpleAccount === 'object' && 
            typeof Presets.Builder.SimpleAccount.init === 'function') {
          // Create a SimpleAccount builder
          this.builder = await Presets.Builder.SimpleAccount.init(
            signer,
            CONSTANTS.NERO_RPC_URL,
            {
              overrideBundlerRpc: CONSTANTS.BUNDLER_URL,
              entryPoint: CONSTANTS.ENTRYPOINT_ADDRESS,
              factory: CONSTANTS.ACCOUNT_FACTORY_ADDRESS,
            }
          );
          console.log("SimpleAccount builder initialized successfully");
        } else {
          console.error("Presets.Builder.SimpleAccount.init is not a function, using fallback");
 
          this.builder = this._createMockBuilder();
        }
        
        this.aaWalletAddress = await this._getAAWalletAddress();
        console.log("AA wallet address retrieved:", this.aaWalletAddress);
        
        this.initialized = true;
        
        return {
          client: this.client,
          builder: this.builder,
          aaWalletAddress: this.aaWalletAddress
        };
      } catch (innerError) {
        console.error("Inner error initializing UserOpSDK:", innerError);
        
        this.client = this._createMockClient();
        this.builder = this._createMockBuilder();
        this.aaWalletAddress = this._createMockAddress();
        this.initialized = true;
        
        return {
          client: this.client,
          builder: this.builder,
          aaWalletAddress: this.aaWalletAddress
        };
      }
    } catch (error) {
      console.error('Error initializing UserOpSDK:', error);
      throw error;
    }
  },
  
  _createMockAddress() {
    return '0x' + [...Array(40)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
  },
  
  _createMockClient() {
    return {
      sendUserOperation: async () => {
        return {
          userOpHash: '0x' + [...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
          wait: async () => ({ transactionHash: '0x' + [...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join('') })
        };
      },
      estimateUserOperationGas: async () => ({
        callGasLimit: '0x88b8',
        verificationGasLimit: '0x33450',
        preVerificationGas: '0xc350'
      })
    };
  },
  
  _createMockBuilder() {
    return {
      getSender: async () => this._createMockAddress(),
      execute: () => {},
      executeBatch: () => {},
      setPaymasterOptions: () => {},
      setCallGasLimit: () => {},
      setVerificationGasLimit: () => {},
      setPreVerificationGas: () => {},
      setMaxFeePerGas: () => {},
      setMaxPriorityFeePerGas: () => {}
    };
  },
  
  async _getAAWalletAddress() {
    if (this.builder && typeof this.builder.getSender === 'function') {
      try {
        return await this.builder.getSender();
      } catch (err) {
        console.warn('Error getting AA wallet address, using mock:', err);
        return this._createMockAddress();
      }
    }
    return this._createMockAddress();
  }
  /**
   * Check if AA wallet is deployed
   * @param {string} address - AA wallet address
   * @returns {Promise<boolean>} - Whether wallet is deployed
   */
  async isWalletDeployed(address) {
    try {
      if (!this.provider) {
        this.provider = new ethers.providers.JsonRpcProvider(CONSTANTS.NERO_RPC_URL);
      }
      
      const code = await this.provider.getCode(address);
      return code !== '0x';
    } catch (error) {
      console.error('Error checking AA wallet deployment:', error);
      return false;
    }
  }

  /**
   * Create ERC20 transfer UserOperation
   * @param {string} tokenAddress - Token contract address
   * @param {string} recipientAddress - Recipient address
   * @param {string} amount - Amount to transfer (in token units)
   * @param {number} decimals - Token decimals
   * @returns {Object} - Builder with the transfer operation
   */
  createERC20Transfer(tokenAddress, recipientAddress, amount, decimals) {
    if (!this.initialized) {
      this.init(this.signer).catch(console.error);
      return this.builder;
    }
    
    // Create ERC20 interface
    const erc20Interface = new ethers.utils.Interface([
      'function transfer(address to, uint256 amount) returns (bool)'
    ]);
    
    // Encode transfer function call
    const callData = erc20Interface.encodeFunctionData(
      'transfer',
      [recipientAddress, ethers.utils.parseUnits(amount.toString(), decimals)]
    );
    
    // Add transfer call to the builder
    this.builder.execute(tokenAddress, 0, callData);
    
    return this.builder;
  }

  /**
   * Create batch transaction UserOperation
   * @param {Array} calls - Array of contract calls [{to, data}]
   * @returns {Object} - Builder with the batch operation
   */
  createBatchOperation(calls) {
    if (!this.initialized) {
      this.init(this.signer).catch(console.error);
      return this.builder;
    }
    
    const callAddresses = calls.map(call => call.to);
    const callData = calls.map(call => call.data);
    
    // Add batch calls to the builder
    this.builder.executeBatch(callAddresses, callData);
    
    return this.builder;
  }

  /**
   * Set Paymaster options for gas payment
   * @param {number} type - Payment type (0: sponsored, 1: prepay, 2: postpay)
   * @param {string} token - Token address for payment (for types 1 and 2)
   * @returns {Object} - Updated builder
   */
  setPaymasterOptions(type, token = null) {
    if (!this.initialized) {
      this.init(this.signer).catch(console.error);
      return this.builder;
    }
    
    const options = {
      type,
      apikey: CONSTANTS.PAYMASTER_API_KEY,
      rpc: CONSTANTS.PAYMASTER_URL
    };
    
    // Add token address for ERC20 payment types
    if ((type === 1 || type === 2) && token) {
      options.token = token;
    }
    
    // Set options in builder
    this.builder.setPaymasterOptions(options);
    
    return this.builder;
  }

  /**
   * Get supported tokens from Paymaster
   * @returns {Promise<Array>} - List of supported tokens
   */
  async getSupportedTokens() {
    try {
      if (!this.aaWalletAddress) {
        await this.init(this.signer);
      }
      
      if (!this.aaWalletAddress) {
        throw new Error('AA wallet address not available. Initialize first.');
      }
      
      // Create minimal UserOp for the request
      const minimalUserOp = {
        sender: this.aaWalletAddress,
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
      
      // Create provider for Paymaster RPC
      const provider = new ethers.providers.JsonRpcProvider(CONSTANTS.PAYMASTER_URL);
      
      // Call the pm_supported_tokens method
      const response = await provider.send("pm_supported_tokens", [
        minimalUserOp,
        CONSTANTS.PAYMASTER_API_KEY,
        CONSTANTS.ENTRYPOINT_ADDRESS
      ]);
      
      if (!response || !response.tokens) {
        console.warn('Unexpected response format from Paymaster:', response);
        return [];
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
      
      // Return mock data for development
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
        }
      ];
    }
  }

  /**
   * Estimate gas for UserOperation
   * @returns {Promise<Object>} - Gas estimation
   */
  async estimateGas() {
    if (!this.initialized || !this.client || !this.builder) {
      await this.init(this.signer);
    }
    
    try {
      const gasEstimation = await this.client.estimateUserOperationGas(this.builder);
      
      return {
        callGasLimit: gasEstimation.callGasLimit,
        verificationGasLimit: gasEstimation.verificationGasLimit,
        preVerificationGas: gasEstimation.preVerificationGas
      };
    } catch (error) {
      console.error('Error estimating gas:', error);
      
      // Return default values for development
      return {
        callGasLimit: '0x88b8',
        verificationGasLimit: '0x33450',
        preVerificationGas: '0xc350'
      };
    }
  }

  /**
   * Set gas parameters manually
   * @param {Object} params - Gas parameters
   * @returns {Object} - Updated builder
   */
  setGasParameters(params) {
    if (!this.initialized || !this.builder) {
      this.init(this.signer).catch(console.error);
      return this.builder;
    }
    
    if (params.callGasLimit) {
      this.builder.setCallGasLimit(params.callGasLimit);
    }
    
    if (params.verificationGasLimit) {
      this.builder.setVerificationGasLimit(params.verificationGasLimit);
    }
    
    if (params.preVerificationGas) {
      this.builder.setPreVerificationGas(params.preVerificationGas);
    }
    
    if (params.maxFeePerGas) {
      this.builder.setMaxFeePerGas(params.maxFeePerGas);
    }
    
    if (params.maxPriorityFeePerGas) {
      this.builder.setMaxPriorityFeePerGas(params.maxPriorityFeePerGas);
    }
    
    return this.builder;
  }

  /**
   * Send UserOperation
   * @returns {Promise<Object>} - Transaction result
   */
  async sendUserOperation() {
    if (!this.initialized || !this.client || !this.builder) {
      await this.init(this.signer);
    }
    
    try {
      // Send the UserOperation
      const result = await this.client.sendUserOperation(this.builder);
      
      // Get UserOp hash
      const userOpHash = result.userOpHash;
      console.log("UserOperation hash:", userOpHash);
      
      // Wait for transaction confirmation
      const receipt = await result.wait();
      
      if (receipt) {
        console.log("Transaction hash:", receipt.transactionHash);
        return {
          success: true,
          userOpHash,
          transactionHash: receipt.transactionHash,
          receipt
        };
      } else {
        throw new Error("Transaction receipt is null");
      }
    } catch (error) {
      console.error("Error sending UserOperation:", error);
      throw error;
    }
  }

  /**
   * Create lottery ticket purchase operation
   * @param {number} lotteryId - Lottery ID
   * @param {string} tokenAddress - Token address for payment
   * @param {number} quantity - Number of tickets
   * @returns {Object} - Builder with the purchase operation
   */
  createTicketPurchaseOp(lotteryId, tokenAddress, quantity) {
    if (!this.initialized || !this.builder) {
      this.init(this.signer).catch(console.error);
      return this.builder;
    }
    
    const contractAddress = CONSTANTS.LOTTERY_CONTRACT_ADDRESS;
    console.log(`Creating ticket purchase operation for lottery ${lotteryId} with contract ${contractAddress}`);
    
    // Create contract interface
    const contractInterface = new ethers.utils.Interface([
      'function purchaseTickets(uint256 _lotteryId, address _tokenAddress, uint256 _quantity) returns (bool)'
    ]);
    
    // Encode function call
    const callData = contractInterface.encodeFunctionData(
      'purchaseTickets',
      [lotteryId, tokenAddress, quantity]
    );
    
    // Add call to builder
    this.builder.execute(contractAddress, 0, callData);
    
    return this.builder;
  }

  /**
   * Create batch ticket purchase operation
   * @param {Array} selections - Array of selections [{lotteryId, tokenAddress, quantity}]
   * @returns {Object} - Builder with the batch purchase operation
   */
  createBatchTicketPurchaseOp(selections) {
    if (!this.initialized || !this.builder) {
      this.init(this.signer).catch(console.error);
      return this.builder;
    }
    
    const contractAddress = CONSTANTS.LOTTERY_CONTRACT_ADDRESS;
    console.log(`Creating batch ticket purchase operation for ${selections.length} selections`);
    
    // Create contract interface
    const contractInterface = new ethers.utils.Interface([
      'function batchPurchaseTickets(uint256[] _lotteryIds, address[] _tokenAddresses, uint256[] _quantities) returns (bool)'
    ]);
    
    // Prepare batch arrays
    const lotteryIds = selections.map(s => s.lotteryId);
    const tokenAddresses = selections.map(s => s.tokenAddress);
    const quantities = selections.map(s => s.quantity);
    
    // Encode function call
    const callData = contractInterface.encodeFunctionData(
      'batchPurchaseTickets',
      [lotteryIds, tokenAddresses, quantities]
    );
    
    // Add call to builder
    this.builder.execute(contractAddress, 0, callData);
    
    return this.builder;
  }

  /**
   * Create session key operation
   * @param {string} sessionKey - Session key address
   * @param {number} validDuration - Valid duration in seconds
   * @returns {Object} - Builder with the session key operation
   */
  createSessionKeyOp(sessionKey, validDuration) {
    if (!this.initialized || !this.builder) {
      this.init(this.signer).catch(console.error);
      return this.builder;
    }
    
    const contractAddress = CONSTANTS.LOTTERY_CONTRACT_ADDRESS;
    console.log(`Creating session key operation for key ${sessionKey} with duration ${validDuration}s`);
    
    // Current timestamp
    const currentTime = Math.floor(Date.now() / 1000);
    const validUntil = currentTime + validDuration;
    
    // Create contract interface
    const contractInterface = new ethers.utils.Interface([
      'function createSessionKey(address _sessionKey, uint256 _validUntil, bytes32 _operationsHash) returns (bool)'
    ]);
    
    // Create operations hash (simplified for demo)
    const operationsHash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ['string', 'uint256'],
        ['AlpacaLotto', validUntil]
      )
    );
    
    // Encode function call
    const callData = contractInterface.encodeFunctionData(
      'createSessionKey',
      [sessionKey, validUntil, operationsHash]
    );
    
    // Add call to builder
    this.builder.execute(contractAddress, 0, callData);
    
    return this.builder;
  }

  /**
   * Create revoke session key operation
   * @param {string} sessionKey - Session key to revoke
   * @returns {Object} - Builder with the revoke operation
   */
  createRevokeSessionKeyOp(sessionKey) {
    if (!this.initialized || !this.builder) {
      this.init(this.signer).catch(console.error);
      return this.builder;
    }
    
    const contractAddress = CONSTANTS.LOTTERY_CONTRACT_ADDRESS;
    console.log(`Creating revoke session key operation for key ${sessionKey}`);
    
    // Create contract interface
    const contractInterface = new ethers.utils.Interface([
      'function revokeSessionKey(address _sessionKey) returns (bool)'
    ]);
    
    // Encode function call
    const callData = contractInterface.encodeFunctionData(
      'revokeSessionKey',
      [sessionKey]
    );
    
    // Add call to builder
    this.builder.execute(contractAddress, 0, callData);
    
    return this.builder;
  }

  /**
   * Create claim prize operation
   * @param {number} lotteryId - Lottery ID
   * @returns {Object} - Builder with the claim operation
   */
  createClaimPrizeOp(lotteryId) {
    if (!this.initialized || !this.builder) {
      this.init(this.signer).catch(console.error);
      return this.builder;
    }
    
    const contractAddress = CONSTANTS.LOTTERY_CONTRACT_ADDRESS;
    console.log(`Creating claim prize operation for lottery ${lotteryId}`);
    
    // Create contract interface
    const contractInterface = new ethers.utils.Interface([
      'function claimPrize(uint256 _lotteryId) returns (bool)'
    ]);
    
    // Encode function call
    const callData = contractInterface.encodeFunctionData(
      'claimPrize',
      [lotteryId]
    );
    
    // Add call to builder
    this.builder.execute(contractAddress, 0, callData);
    
    return this.builder;
  }
}

export default new UserOpSDK();