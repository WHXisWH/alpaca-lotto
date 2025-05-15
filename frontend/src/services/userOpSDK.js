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

// Global initialization flag to prevent concurrent initializations
let isInitializing = false;

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
    if (isInitializing) {
      console.log('SDK initialization already in progress, waiting...');
      return new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (!isInitializing) {
            clearInterval(checkInterval);
            resolve({ 
              success: this.initialized, 
              client: this.client, 
              builder: this.builder,
              error: this.initError
            });
          }
        }, 100);
      });
    }
    
    if (this.initialized && this.client && this.builder) {
      return { success: true, client: this.client, builder: this.builder };
    }
    
    isInitializing = true;
    this.initError = null;
    
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
      
      // Initialize the AA Client
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
        this.initError = `AA Client initialization failed: ${clientErr.message}`;
        throw clientErr;
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
        this.initError = `SimpleAccount builder initialization failed: ${builderErr.message}`;
        throw builderErr;
      }
      
      try {
        this.aaWalletAddress = await this._getAAWalletAddress();
        console.log("AA wallet address retrieved:", this.aaWalletAddress);
      } catch (addressErr) {
        console.error("Error retrieving AA wallet address:", addressErr);
        this.initError = `AA wallet address retrieval failed: ${addressErr.message}`;
        throw addressErr; 
      }
      
      this.initialized = true;
      console.log("UserOpSDK initialization complete");
      
      isInitializing = false;
      
      return {
        success: true,
        client: this.client,
        builder: this.builder,
        aaWalletAddress: this.aaWalletAddress
      };
    } catch (error) {
      console.error('Error initializing UserOpSDK:', error);
      this.initError = error.message || 'Unknown UserOpSDK initialization error';
      
      isInitializing = false;
      
      return {
        success: false,
        client: null,
        builder: null,
        aaWalletAddress: null,
        error: this.initError
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
      
      // Token is not approved, create approval transaction using the SDK's built-in approach
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
      
      // Configure approval operation with Type 0 (free gas) or fall back to Type 1
      // First try with Type 0 (sponsored gas)
      let approvalSuccess = false;
      
      try {
        // Try with free gas first
        this.builder.setPaymasterOptions({
          type: 0,
          apikey: CONSTANTS.PAYMASTER_API_KEY,
          rpc: CONSTANTS.PAYMASTER_URL
        });
        
        // Add approval call to the builder
        this.builder.execute(tokenAddress, 0, callData);
        
        // Send the approval UserOperation
        const result = await this.client.sendUserOperation(this.builder);
        const receipt = await result.wait();
        approvalSuccess = true;
      } catch (typeZeroError) {
        console.warn("Type 0 (free gas) approval failed, trying with Type 1:", typeZeroError);
        
        // Fall back to Type 1 with a different token
        // For this fallback, we need to use a token that is already approved or native token
        this.builder.resetOp && this.builder.resetOp();
        
        try {
          // For the fallback, we'll use a direct EOA transaction which doesn't require paymaster
          const provider = new ethers.providers.Web3Provider(window.ethereum);
          const signer = provider.getSigner();
          
          // Create token contract with direct signer
          const tokenContract = new ethers.Contract(
            tokenAddress,
            ['function approve(address spender, uint256 amount) returns (bool)'],
            signer
          );
          
          // Send direct EOA transaction for approval
          const tx = await tokenContract.approve(CONSTANTS.TOKEN_PAYMASTER_ADDRESS, ethers.constants.MaxUint256);
          const receipt = await tx.wait();
          approvalSuccess = true;
        } catch (directError) {
          console.error("Direct EOA approval also failed:", directError);
          throw directError;
        }
      }
      
      // Check if approval was successful
      if (approvalSuccess) {
        const newApproval = await paymasterService.isTokenApproval(
          tokenAddress,
          this.aaWalletAddress
        );
        
        return newApproval;
      }
      
      return false;
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
    
    console.log(`Setting paymaster options: type=${type}, token=${token}`);
    
    // Prepare options object for setPaymasterOptions
    const options = {
      type, // User-selected payment type: 0 (free), 1 (prepay), 2 (postpay)
      apikey: CONSTANTS.PAYMASTER_API_KEY,
      rpc: CONSTANTS.PAYMASTER_URL
    };
    
    // Add token address for ERC20 payment types
    if ((type === 1 || type === 2) && token) {
      // Check if token is supported
      const isSupported = await paymasterService.isTokenSupported(token);
      if (!isSupported) {
        console.warn(`Token ${token} is not supported by paymaster`);
        throw new Error('Token is not supported by the Paymaster service');
      }
      
      options.token = token;
      
      // Ensure token is approved for Paymaster if needed
      // This approval check is still necessary
      const isApproved = await paymasterService.isTokenApproved(token, this.aaWalletAddress);
      if (!isApproved) {
        console.log(`Token ${token} needs approval for paymaster`);
        await this.ensureTokenApproval(token);
      }
    } else if (type !== 0) {
      // If type is not 0 but no token provided, throw error
      throw new Error('Token address required for ERC20 payment types');
    }
    
    console.log('Setting paymaster options:', options);
    
    // Set options in builder using the SDK's built-in method
    if (this.builder && typeof this.builder.setPaymasterOptions === 'function') {
      this.builder.setPaymasterOptions(options);
    } else {
      console.error('Builder missing or setPaymasterOptions not available');
      throw new Error('Builder not properly initialized');
    }
    
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