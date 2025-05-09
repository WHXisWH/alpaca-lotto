import { ethers } from 'ethers';
import { Client, Presets } from 'userop';
import paymasterService from './paymasterService';

// Constants
const CONSTANTS = {
  NERO_RPC_URL: import.meta.env.VITE_NERO_RPC_URL || 'https://rpc-testnet.nerochain.io',
  BUNDLER_URL: import.meta.env.VITE_BUNDLER_URL || 'https://bundler-testnet.nerochain.io',
  PAYMASTER_URL: import.meta.env.VITE_PAYMASTER_URL || 'https://paymaster-testnet.nerochain.io',
  PAYMASTER_API_KEY: import.meta.env.VITE_PAYMASTER_API_KEY || '',
  ENTRYPOINT_ADDRESS: import.meta.env.VITE_ENTRYPOINT_ADDRESS || '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
  ACCOUNT_FACTORY_ADDRESS: import.meta.env.VITE_ACCOUNT_FACTORY_ADDRESS || '0x9406Cc6185a346906296840746125a0E44976454',
  LOTTERY_CONTRACT_ADDRESS: import.meta.env.VITE_LOTTERY_CONTRACT_ADDRESS || '',
  TOKEN_PAYMASTER_ADDRESS: import.meta.env.VITE_TOKEN_PAYMASTER_ADDRESS || '0x5a6680dFd4a77FEea0A7be291147768EaA2414ad',
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
      
      // Safely create provider with retry mechanism
      let providerAttempts = 0;
      while (providerAttempts < 3) {
        try {
          this.provider = new ethers.providers.JsonRpcProvider(CONSTANTS.NERO_RPC_URL);
          await this.provider.getNetwork(); // Test the connection
          console.log("Provider created successfully");
          break;
        } catch (providerErr) {
          console.warn(`Provider creation attempt ${providerAttempts + 1} failed:`, providerErr);
          providerAttempts++;
          if (providerAttempts >= 3) throw providerErr;
          await new Promise(r => setTimeout(r, 1000));
        }
      }
      
      try {
        // Initialize the AA Client with proper error handling
        if (typeof Client.init === 'function') {
          this.client = await Client.init(CONSTANTS.NERO_RPC_URL, {
            overrideBundlerRpc: CONSTANTS.BUNDLER_URL,
            entryPoint: CONSTANTS.ENTRYPOINT_ADDRESS,
            timeout: 30000,
          });
          console.log("AA Client initialized successfully");
        } else {
          throw new Error("Client.init is not a function");
        }
      } catch (clientErr) {
        console.error("Error initializing AA Client:", clientErr);
        
        // Fallback client implementation
        this.client = this._createMockClient();
        console.log("Using fallback client implementation");
      }

      try {
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
          throw new Error("Presets.Builder.SimpleAccount.init is not a function");
        }
      } catch (builderErr) {
        console.error("Error initializing SimpleAccount builder:", builderErr);
        
        // Fallback builder implementation
        this.builder = this._createMockBuilder();
        console.log("Using fallback builder implementation");
      }
      
      try {
        this.aaWalletAddress = await this._getAAWalletAddress();
        console.log("AA wallet address retrieved:", this.aaWalletAddress);
      } catch (addressErr) {
        console.error("Error retrieving AA wallet address:", addressErr);
        this.aaWalletAddress = this._createMockAddress();
        console.log("Using fallback AA wallet address:", this.aaWalletAddress);
      }
      
      this.initialized = true;
      
      return {
        client: this.client,
        builder: this.builder,
        aaWalletAddress: this.aaWalletAddress
      };
    } catch (error) {
      console.error('Error initializing UserOpSDK:', error);
      
      // Final fallback - create mock implementations for everything
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
  }
  
  _createMockAddress() {
    return '0x' + [...Array(40)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
  }
  
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
      }),
      getSupportedTokens: async () => {
        await paymasterService.init();
        return paymasterService.getSupportedTokens('0x1234567890123456789012345678901234567890');
      }
    };
  }
  
  _createMockBuilder() {
    return {
      getSender: async () => this._createMockAddress(),
      execute: () => {},
      executeBatch: () => {},
      setPaymasterOptions: () => {},
      resetOp: () => {},
      setCallGasLimit: () => {},
      setVerificationGasLimit: () => {},
      setPreVerificationGas: () => {},
      setMaxFeePerGas: () => {},
      setMaxPriorityFeePerGas: () => {}
    };
  }
  
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
   * Ensure token approval for Paymaster
   * @param {string} tokenAddress - Token address for payment 
   * @returns {Promise<boolean>} - Whether approval was successful
   */
  async ensureTokenApproval(tokenAddress) {
    try {
      if (!this.initialized) {
        await this.init(this.signer);
      }
      
      if (!this.aaWalletAddress || !tokenAddress) {
        return false;
      }
      
      // Check if token is already approved
      const isApproved = await paymasterService.isTokenApproved(
        tokenAddress,
        this.aaWalletAddress
      );
      
      if (isApproved) {
        return true;
      }
      
      // Token is not approved, create approval transaction
      // Create ERC20 interface
      const erc20Interface = new ethers.utils.Interface([
        'function approve(address spender, uint256 amount) returns (bool)'
      ]);
      
      // Encode approve function call for TOKEN_PAYMASTER_ADDRESS
      const callData = erc20Interface.encodeFunctionData(
        'approve',
        [CONSTANTS.TOKEN_PAYMASTER_ADDRESS, ethers.constants.MaxUint256]
      );
      
      // Reset the builder
      this.builder.resetOp && this.builder.resetOp();
      
      // Configure approval operation with Type 0 (free gas)
      const approvalOptions = {
        type: 0, // Try with free gas for approval
        apikey: CONSTANTS.PAYMASTER_API_KEY,
        rpc: CONSTANTS.PAYMASTER_URL
      };
      
      this.builder.setPaymasterOptions(approvalOptions);
      
      // Add approval call to the builder
      this.builder.execute(tokenAddress, 0, callData);
      
      // Send the approval UserOperation
      const result = await this.client.sendUserOperation(this.builder);
      const receipt = await result.wait();
      
      // Check if approval was successful
      const newApproval = await paymasterService.isTokenApproved(
        tokenAddress,
        this.aaWalletAddress
      );
      
      return newApproval;
    } catch (error) {
      console.error('Error ensuring token approval:', error);
      return false;
    }
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
  async createERC20Transfer(tokenAddress, recipientAddress, amount, decimals) {
    if (!this.initialized) {
      await this.init(this.signer);
    }
    
    // Reset any previous operations
    this.builder.resetOp && this.builder.resetOp();
    
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
  async createBatchOperation(calls) {
    if (!this.initialized) {
      await this.init(this.signer);
    }
    
    // Reset any previous operations
    this.builder.resetOp && this.builder.resetOp();
    
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
  async setPaymasterOptions(type, token = null) {
    if (!this.initialized) {
      await this.init(this.signer);
    }
    
    // Check if Type 0 (free gas) is selected
    if (type === 0) {
      console.warn('Free gas model is not supported, switching to ERC20 prepayment.');
      type = 1;
      
      // Store preference for future use
      localStorage.setItem('sponsoredPaymentsDisabled', 'true');
    }
    
    const options = {
      type,
      apikey: CONSTANTS.PAYMASTER_API_KEY,
      rpc: CONSTANTS.PAYMASTER_URL
    };
    
    // Add token address for ERC20 payment types
    if ((type === 1 || type === 2) && token) {
      // Check if token is supported
      const isSupported = await paymasterService.isTokenSupported(token);
      if (!isSupported) {
        throw new Error('Token is not supported by the Paymaster service');
      }
      
      options.token = token;
      
      // Ensure token is approved for Paymaster
      await this.ensureTokenApproval(token);
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
      
      // Use the paymasterService to get supported tokens
      await paymasterService.init();
      return paymasterService.getSupportedTokens(this.aaWalletAddress);
    } catch (error) {
      console.error('Error fetching supported tokens:', error);
      
      // Let paymasterService handle fallback token list
      return paymasterService.getSupportedTokens('0x1234567890123456789012345678901234567890');
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
      
      // Better error handling for specific cases
      if (error.message && error.message.includes('token not supported')) {
        throw new Error('The selected token is not supported by the Paymaster service. Please try a different token.');
      }
      
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
  async createTicketPurchaseOp(lotteryId, tokenAddress, quantity) {
    if (!this.initialized || !this.builder) {
      await this.init(this.signer);
    }
    
    // Reset any previous operations
    this.builder.resetOp && this.builder.resetOp();
    
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
  async createBatchTicketPurchaseOp(selections) {
    if (!this.initialized || !this.builder) {
      await this.init(this.signer);
    }
    
    // Reset any previous operations
    this.builder.resetOp && this.builder.resetOp();
    
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
}

export default new UserOpSDK();