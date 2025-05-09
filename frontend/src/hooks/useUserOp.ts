import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { ethers } from 'ethers';
import { Client, Presets } from 'userop';
import SUPPORTED_TOKENS from '../constants/tokens';
import paymasterService from '../services/paymasterService'; 

// Constants for AA setup - use environment variables with fallbacks
const NERO_RPC_URL = import.meta.env.VITE_NERO_RPC_URL || "https://rpc-testnet.nerochain.io";
const BUNDLER_URL = import.meta.env.VITE_BUNDLER_URL || "https://bundler-testnet.nerochain.io";
const PAYMASTER_URL = import.meta.env.VITE_PAYMASTER_URL || "https://paymaster-testnet.nerochain.io";
const ENTRYPOINT_ADDRESS = import.meta.env.VITE_ENTRYPOINT_ADDRESS || "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
const ACCOUNT_FACTORY_ADDRESS = import.meta.env.VITE_ACCOUNT_FACTORY_ADDRESS || "0x9406Cc6185a346906296840746125a0E44976454";
const LOTTERY_CONTRACT_ADDRESS = import.meta.env.VITE_LOTTERY_CONTRACT_ADDRESS || "";
// Normalize address to checksum format
const TOKEN_PAYMASTER_ADDRESS = ethers.utils.getAddress(import.meta.env.VITE_TOKEN_PAYMASTER_ADDRESS || "0x5a6680dFd4a77FEea0A7be291147768EaA2414ad");

/**
 * Custom hook for NERO Chain's Account Abstraction functionality
 */
const useUserOp = () => {
  const { address, isConnected } = useAccount();
  const [client, setClient] = useState(null);
  const [builder, setBuilder] = useState(null);
  const [aaWalletAddress, setAaWalletAddress] = useState(null);
  const [isDeployed, setIsDeployed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [txHash, setTxHash] = useState(null);
  const [isDevelopmentMode, setIsDevelopmentMode] = useState(false);

  /**
   * Method to deploy AA wallet
   */
  const deployAAWallet = async (signer, builder, client) => {
    if (!signer || !builder || !client) return false;
 
   try {
    builder.resetOp && builder.resetOp();
    builder.execute(ethers.constants.AddressZero, 0, "0x");
    const result = await client.sendUserOperation(builder);
    await result.wait();
    return true;
   } catch (err) {
     console.error("Error deploying AA wallet:", err);
     return false;
    }
  };
  /**
   * Ensure token approval for Paymaster
   * @param {string} tokenAddress - The token address for payment
   * @param {Object} builder - The current builder
   * @returns {Promise<boolean>} - Whether approval was successful
   */
  const ensurePaymasterApproval = async (tokenAddress, builder) => {
    if (!tokenAddress || !builder || isDevelopmentMode) return true;
    
    try {
      // Normalize addresses to checksum format
      const normalizedTokenAddress = ethers.utils.getAddress(tokenAddress);
      const normalizedPaymasterAddress = ethers.utils.getAddress(TOKEN_PAYMASTER_ADDRESS);
      
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      
      // Also normalize AA wallet address
      const normalizedAAWalletAddress = ethers.utils.getAddress(aaWalletAddress);
      
      // Create token contract interface
      const tokenContract = new ethers.Contract(
        normalizedTokenAddress,
        ['function allowance(address owner, address spender) view returns (uint256)',
         'function approve(address spender, uint256 amount) returns (bool)'],
        signer
      );
      
      console.log(`Checking allowance for token ${normalizedTokenAddress} to paymaster ${normalizedPaymasterAddress}`);
      
      // Check if AA wallet address has already approved tokens for Paymaster
      // Read operations are valid even if AA wallet isn't deployed yet
      const allowance = await tokenContract.allowance(normalizedAAWalletAddress, normalizedPaymasterAddress);
      
      // If allowance is sufficient, no need to approve
      if (allowance.gte(ethers.constants.MaxUint256.div(2))) {
        console.log('Token already approved for Paymaster');
        return true;
      }
      
      // Check if AA wallet is deployed
      const code = await provider.getCode(normalizedAAWalletAddress);
      if (code === '0x') {
        console.log('AA wallet not deployed yet, deploying first...');
        const deploySuccess = await deployAAWallet(signer, builder, client);
        if (!deploySuccess) {
          console.warn('Failed to deploy AA wallet, proceeding with approval attempt anyway');
        }
      }
      
      console.log('Insufficient allowance, approving token for Paymaster...');
      
      // Reset any previous operations to create a clean builder
      builder.resetOp && builder.resetOp();
      
      // Encode approve function call
      const approveData = tokenContract.interface.encodeFunctionData(
        'approve',
        [normalizedPaymasterAddress, ethers.constants.MaxUint256]
      );
      
      // Create approval operation using Type 1 (prepay)
      // Change type - Try Type 1 (prepay) if Type 0 doesn't work
      const approvalOptions = {
        type: 1,
        apikey: import.meta.env.VITE_PAYMASTER_API_KEY || '',
        rpc: PAYMASTER_URL,
        token: SUPPORTED_TOKENS.USDC.address // Use USDC
      };
      
      builder.setPaymasterOptions(approvalOptions);
      
      // Execute the approval transaction
      builder.execute(normalizedTokenAddress, 0, approveData);
      
      // Send approval operation
      console.log('Sending approval UserOperation...');
      const approvalResult = await client.sendUserOperation(builder);
      console.log('Approval UserOp hash:', approvalResult.userOpHash);
      
      // Wait for transaction confirmation
      const approvalReceipt = await approvalResult.wait();
      console.log('Approval transaction complete:', approvalReceipt);
      
      // Verify approval was successful
      const newAllowance = await tokenContract.allowance(normalizedAAWalletAddress, normalizedPaymasterAddress);
      return newAllowance.gt(allowance);
    } catch (error) {
      console.error('Error ensuring token approval for Paymaster:', error);
      
      // If in development mode, assume approval success
      if (isDevelopmentMode) {
        return true;
      }
      
      // Check if error is due to approval being rejected or other issues
      if (error.message && (
          error.message.includes('User denied') || 
          error.message.includes('user rejected') ||
          error.message.includes('rejected the request'))) {
        throw new Error('Approval transaction was rejected by user');
      }
      
      // For any other errors, assume the approval failed but allow the operation to continue
      return false;
    }
  };

  /**
   * Initialize the Account Abstraction SDK
   */
  const initSDK = useCallback(async () => {
    // Check for proper wallet connection
    if (!isConnected) {
      // Check if we should use development mode
      if (localStorage.getItem('devModeEnabled') === 'true' || 
          window.location.search.includes('devMode=true')) {
        console.log('Development mode active');
        setIsDevelopmentMode(true);
        setAaWalletAddress('0x1234567890123456789012345678901234567890');
        return { success: true, isDevelopmentMode: true };
      }
      setError('Wallet not connected');
      return { success: false, error: 'Wallet not connected' };
    }
  
    setIsLoading(true);
    setError(null);
  
    try {
      // Only try to initialize the real SDK if we're in a browser with ethereum
      if (typeof window !== 'undefined' && window.ethereum) {
        try {
          // Safely create provider
          const provider = new ethers.providers.Web3Provider(window.ethereum);
          const signer = provider.getSigner();
          
          // Initialize Client with error handling
          try {
            const aaClient = await Client.init(NERO_RPC_URL, {
              overrideBundlerRpc: BUNDLER_URL,
              entryPoint: ENTRYPOINT_ADDRESS,
            });
            setClient(aaClient);
          } catch (clientError) {
            console.error("Error initializing AA Client:", clientError);
            throw clientError;
          }
          
          // Create builder with error handling
          try {
            const aaBuilder = await Presets.Builder.SimpleAccount.init(
              signer,
              NERO_RPC_URL,
              {
                overrideBundlerRpc: BUNDLER_URL,
                entryPoint: ENTRYPOINT_ADDRESS,
                factory: ACCOUNT_FACTORY_ADDRESS,
              }
            );
            setBuilder(aaBuilder);
            
            // Get counterfactual address
            const aaAddress = await aaBuilder.getSender();
            // Normalize address
            const normalizedAAAddress = ethers.utils.getAddress(aaAddress);
            setAaWalletAddress(normalizedAAAddress);
            
           // Check if wallet is deployed
            const code = await provider.getCode(normalizedAAAddress);
            const deployed = code !== '0x';
            setIsDeployed(deployed);
            
            if (code === '0x') {
              console.log('AA wallet not deployed — using counterfactual address');
            }
          } catch (builderError) {
            console.error("Error creating SimpleAccount builder:", builderError);
            throw builderError;
          }
          
          setIsLoading(false);
          return { success: true };
        } catch (err) {
          console.error('Error initializing real AA SDK:', err);
          // Fall back to development mode
          setIsDevelopmentMode(true);
          setAaWalletAddress('0x1234567890123456789012345678901234567890');
          setIsLoading(false);
          return { success: true, isDevelopmentMode: true };
        }
      } else {
        // No ethereum provider available, use development mode
        console.log('No ethereum provider, using development mode');
        setIsDevelopmentMode(true);
        setAaWalletAddress('0x1234567890123456789012345678901234567890');
        setIsLoading(false);
        return { success: true, isDevelopmentMode: true };
      }
    } catch (err) {
      console.error('Error in AA SDK initialization:', err);
      setError(`AA SDK initialization error: ${err.message}`);
      setIsLoading(false);
      return { success: false, error: err.message };
    }
  }, [isConnected]);  

  /**
   * Execute a ticket purchase operation
   */
  const executeTicketPurchase = useCallback(async ({ 
    lotteryId, 
    tokenAddress, 
    quantity, 
    paymentType = 1, 
    paymentToken = null,
    useSessionKey = false 
  }) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Validate token address for Types 1 & 2
      if ((paymentType === 1 || paymentType === 2) && !paymentToken) {
        // Use USDC by default if no token specified
        paymentToken = SUPPORTED_TOKENS.USDC.address;
      }
      
      // In development mode, simulate success
      if (isDevelopmentMode) {
        console.log('Development mode: Simulating ticket purchase');
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Generate mock transaction hash
        const mockTxHash = '0x' + [...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
        setTxHash(mockTxHash);
        setIsLoading(false);
        return mockTxHash;
      }
      
      // Initialize SDK if not already initialized
      if (!client || !builder) {
        const initResult = await initSDK();
        if (!initResult.success) {
          throw new Error(initResult.error || 'Failed to initialize SDK');
        }
      }
      
      // Create contract interface
      const contractInterface = new ethers.utils.Interface([
        'function purchaseTickets(uint256 _lotteryId, address _tokenAddress, uint256 _quantity) returns (bool)'
      ]);
      
      // Encode function call
      const callData = contractInterface.encodeFunctionData(
        'purchaseTickets',
        [lotteryId, tokenAddress, quantity]
      );
      
      // Reset the builder operation
      builder.resetOp && builder.resetOp();
      
      // Configure Paymaster options
      const paymasterOptions = {
        type: paymentType,
        apikey: import.meta.env.VITE_PAYMASTER_API_KEY || '',
        rpc: PAYMASTER_URL
      };
      
      // Add token when using ERC20 payment (Type 1 or 2)
      if ((paymentType === 1 || paymentType === 2) && paymentToken) {
        paymasterOptions.token = paymentToken;
        
        // This is a crucial step - ensure token is approved for Paymaster
        await ensurePaymasterApproval(paymentToken, builder);
      }
      
      builder.execute(LOTTERY_CONTRACT_ADDRESS, 0, callData);

      const rawOp = await builder.getOp();
      const userOp = {
            sender:                rawOp.sender,
            nonce:                 rawOp.nonce.toHexString(),
            initCode:              rawOp.initCode,
            callData:              rawOp.callData,
            callGasLimit:          rawOp.callGasLimit.toHexString(),
            verificationGasLimit:  rawOp.verificationGasLimit.toHexString(),
            preVerificationGas:    rawOp.preVerificationGas.toHexString(),
            maxFeePerGas:          rawOp.maxFeePerGas.toHexString(),
            maxPriorityFeePerGas:  rawOp.maxPriorityFeePerGas.toHexString(),
            paymasterAndData:      rawOp.paymasterAndData,
            signature:             rawOp.signature
         };


      const paymasterOpts: any = { type: paymentType.toString() };
      if (paymentType === 1 || paymentType === 2) paymasterOpts.token = paymentToken;
      const pmData = await paymasterService.sponsorUserOp(userOp, paymasterOpts);
      userOp.paymasterAndData = pmData;
      builder.setOp(userOp);

            
      // Send the UserOperation
      const result = await client.sendUserOperation(builder);
      console.log('UserOperation result:', result);
      
      // Wait for transaction confirmation
      const receipt = await result.wait();
      console.log('Transaction receipt:', receipt);
      
      // Set transaction hash for later reference
      setTxHash(receipt.transactionHash);
      
      try {
        const apiModule = await import('../services/api');
        const api = apiModule.default || apiModule.api;
        if (api && lotteryId) {
          console.log('Refreshing lottery and ticket data after purchase');
          await api.getLotteryDetails(lotteryId);
          if (address) {
            await api.getUserTickets(lotteryId, address);
          }
        }
      } catch (refreshErr) {
        console.warn('Error refreshing data after purchase:', refreshErr);
        // Don't fail the transaction if refresh fails
      }

      setIsLoading(false);
      return receipt.transactionHash;
    } catch (err) {
      console.error('Error executing ticket purchase:', err);
      
      // Enhanced error handling
      let errorMsg = err.message || 'Failed to purchase tickets';
      
      // Check for specific error messages
      if (errorMsg.includes('token not supported') || errorMsg.includes('price error')) {
        errorMsg = 'The selected token is not supported by the Paymaster service. Please try a different token.';
      } else if (errorMsg.includes('insufficient allowance')) {
        errorMsg = 'Insufficient token allowance for gas payment. Please approve the token first.';
      } else if (errorMsg.includes('insufficient balance')) {
        errorMsg = 'Insufficient token balance for gas payment.';
      }
      
      setError(errorMsg);
      setIsLoading(false);
      throw new Error(errorMsg);
    }
  }, [client, builder, initSDK, isDevelopmentMode, address, ensurePaymasterApproval]);

  /**
   * Execute a batch ticket purchase operation
   */
  const executeBatchPurchase = useCallback(async ({ 
    selections, 
    paymentType = 1,
    paymentToken = null,
    useSessionKey = false
  }) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Validate token address for Types 1 & 2
      if ((paymentType === 1 || paymentType === 2) && !paymentToken) {
        // Use USDC by default if no token specified
        paymentToken = SUPPORTED_TOKENS.USDC.address;
      }
      
      // In development mode, simulate success
      if (isDevelopmentMode) {
        console.log('Development mode: Simulating batch purchase');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Generate mock transaction hash
        const mockTxHash = '0x' + [...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
        setTxHash(mockTxHash);
        setIsLoading(false);
        return mockTxHash;
      }
      
      // Initialize SDK if not already initialized
      if (!client || !builder) {
        const initResult = await initSDK();
        if (!initResult.success) {
          throw new Error(initResult.error || 'Failed to initialize SDK');
        }
      }
      
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
      
      // Reset the builder operation
      builder.resetOp && builder.resetOp();
      
      // Configure Paymaster options with improved validation
      const paymasterOptions = {
        type: paymentType,
        apikey: import.meta.env.VITE_PAYMASTER_API_KEY || '',
        rpc: PAYMASTER_URL
      };
      
      // Add token when using ERC20 payment (Type 1 or 2)
      if ((paymentType === 1 || paymentType === 2) && paymentToken) {
        paymasterOptions.token = paymentToken;
        
        // Ensure token is approved for Paymaster
        await ensurePaymasterApproval(paymentToken, builder);
      }
      
      // Configure the execution
      builder.execute(LOTTERY_CONTRACT_ADDRESS, 0, callData);
      
      const rawOp = await builder.getOp();
      const userOp = {
        sender:               rawOp.sender,
        nonce:                rawOp.nonce.toHexString(),
        initCode:             rawOp.initCode,
        callData:             rawOp.callData,
        callGasLimit:         rawOp.callGasLimit.toHexString(),
        verificationGasLimit: rawOp.verificationGasLimit.toHexString(),
        preVerificationGas:   rawOp.preVerificationGas.toHexString(),
        maxFeePerGas:         rawOp.maxFeePerGas.toHexString(),
        maxPriorityFeePerGas: rawOp.maxPriorityFeePerGas.toHexString(),
        paymasterAndData:     rawOp.paymasterAndData,
        signature:            rawOp.signature
      };

      const paymasterOpts: any = { type: paymentType.toString() };
      if (paymentType === 1 || paymentType === 2) paymasterOpts.token = paymentToken;
      const pmData = await paymasterService.sponsorUserOp(userOp, paymasterOpts);
      userOp.paymasterAndData = pmData;
      builder.setOp(userOp);
      
      // If using session key, set specific options here
      // This would need to be implemented based on your session key implementation
      
      // Send the UserOperation
      const result = await client.sendUserOperation(builder);
      console.log('Batch UserOperation result:', result);
      
      // Wait for transaction confirmation
      const receipt = await result.wait();
      console.log('Batch transaction receipt:', receipt);
      
      // Set transaction hash for later reference
      setTxHash(receipt.transactionHash);
      
      setIsLoading(false);
      return receipt.transactionHash;
    } catch (err) {
      console.error('Error executing batch purchase:', err);
      
      // Enhanced error handling
      let errorMsg = err.message || 'Failed to execute batch purchase';
      
      // Check for specific error messages
      if (errorMsg.includes('token not supported') || errorMsg.includes('price error')) {
        errorMsg = 'The selected token is not supported by the Paymaster service. Please try a different token.';
      } else if (errorMsg.includes('insufficient allowance')) {
        errorMsg = 'Insufficient token allowance for gas payment. Please approve the token first.';
      } else if (errorMsg.includes('insufficient balance')) {
        errorMsg = 'Insufficient token balance for gas payment.';
      }
      
      setError(errorMsg);
      setIsLoading(false);
      throw new Error(errorMsg);
    }
  }, [client, builder, initSDK, isDevelopmentMode, ensurePaymasterApproval]);

  /**
   * Create session key operation
   */
  const createSessionKey = useCallback(async ({ duration, paymentType = 1 }) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // In development mode, simulate success
      if (isDevelopmentMode) {
        console.log('Development mode: Simulating session key creation');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Generate mock address for the session key
        const mockAddress = '0x' + [...Array(40)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
        setIsLoading(false);
        return mockAddress;
      }
      
      // Initialize SDK if not already initialized
      if (!client || !builder) {
        const initResult = await initSDK();
        if (!initResult.success) {
          throw new Error(initResult.error || 'Failed to initialize SDK');
        }
      }
      
      // Generate a new session key
      // This is a simplified implementation
      const sessionKeyAddress = '0x' + [...Array(40)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
      
      // Current timestamp
      const currentTime = Math.floor(Date.now() / 1000);
      const validUntil = currentTime + duration;
      
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
        [sessionKeyAddress, validUntil, operationsHash]
      );
      
      // Reset the builder operation
      builder.resetOp && builder.resetOp();
      
      // Configure Paymaster options
      const paymasterOptions = {
        type: paymentType,
        apikey: import.meta.env.VITE_PAYMASTER_API_KEY || '',
        rpc: PAYMASTER_URL
      };
      
      // Add token for Type 1 or 2 payments
      if ((paymasterOptions.type === 1 || paymasterOptions.type === 2)) {
        // Default to USDC as the payment token
        const paymentToken = SUPPORTED_TOKENS.USDC.address;
        paymasterOptions.token = paymentToken;
        
        // Ensure token is approved for Paymaster
        await ensurePaymasterApproval(paymentToken, builder);
      }
      
      // Configure the execution
      builder.execute(LOTTERY_CONTRACT_ADDRESS, 0, callData);
      
      // Set paymaster options
      builder.setPaymasterOptions(paymasterOptions);
      
      // Send the UserOperation
      const result = await client.sendUserOperation(builder);
      console.log('Session key UserOperation result:', result);
      
      // Wait for transaction confirmation
      const receipt = await result.wait();
      console.log('Session key transaction receipt:', receipt);
      
      // Set transaction hash for later reference
      setTxHash(receipt.transactionHash);
      
      setIsLoading(false);
      return sessionKeyAddress;
    } catch (err) {
      console.error('Error creating session key:', err);
      
      // Enhanced error handling
      let errorMsg = err.message || 'Failed to create session key';
      
      // Check for specific error messages
      if (errorMsg.includes('token not supported') || errorMsg.includes('price error')) {
        errorMsg = 'The selected token is not supported by the Paymaster service. Please try a different token.';
      }
      
      setError(errorMsg);
      setIsLoading(false);
      throw new Error(errorMsg);
    }
  }, [client, builder, initSDK, isDevelopmentMode, ensurePaymasterApproval]);

  /**
   * Revoke session key operation
   */
  const revokeSessionKey = useCallback(async (sessionKeyAddress) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // In development mode, simulate success
      if (isDevelopmentMode) {
        console.log('Development mode: Simulating session key revocation');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        setIsLoading(false);
        return true;
      }
      
      // Initialize SDK if not already initialized
      if (!client || !builder) {
        const initResult = await initSDK();
        if (!initResult.success) {
          throw new Error(initResult.error || 'Failed to initialize SDK');
        }
      }
      
      // Create contract interface
      const contractInterface = new ethers.utils.Interface([
        'function revokeSessionKey(address _sessionKey) returns (bool)'
      ]);
      
      // Encode function call
      const callData = contractInterface.encodeFunctionData(
        'revokeSessionKey',
        [sessionKeyAddress]
      );
      
      // Reset the builder operation
      builder.resetOp && builder.resetOp();
      
      // Configure Paymaster options - Type 0 is not supported
      const paymasterOptions = {
        type: 1, // Use Type 1 (prepay) as default
        apikey: import.meta.env.VITE_PAYMASTER_API_KEY || '',
        rpc: PAYMASTER_URL,
        token: SUPPORTED_TOKENS.USDC.address // Default to USDC
      };
      
      // Ensure token is approved for Paymaster
      await ensurePaymasterApproval(SUPPORTED_TOKENS.USDC.address, builder);
      
      // Configure the execution
      builder.execute(LOTTERY_CONTRACT_ADDRESS, 0, callData);
      
      // Set paymaster options
      builder.setPaymasterOptions(paymasterOptions);
      
      // Send the UserOperation
      const result = await client.sendUserOperation(builder);
      console.log('Revoke session key UserOperation result:', result);
      
      // Wait for transaction confirmation
      const receipt = await result.wait();
      console.log('Revoke session key transaction receipt:', receipt);
      
      // Set transaction hash for later reference
      setTxHash(receipt.transactionHash);
      
      setIsLoading(false);
      return true;
    } catch (err) {
      console.error('Error revoking session key:', err);
      setError(err.message || 'Failed to revoke session key');
      setIsLoading(false);
      throw err;
    }
  }, [client, builder, initSDK, isDevelopmentMode, ensurePaymasterApproval]);

  // Automatically initialize SDK when wallet is connected
  useEffect(() => {
    if ((isConnected) || 
        localStorage.getItem('devModeEnabled') === 'true' || 
        window.location.search.includes('devMode=true')) {
      initSDK().catch(console.error);
    }
  }, [isConnected, initSDK]);

  return {
    client,
    builder,
    aaWalletAddress,
    isDeployed,
    isLoading,
    error,
    txHash,
    isDevelopmentMode,
    initSDK,
    executeTicketPurchase,
    executeBatchPurchase,
    createSessionKey,
    revokeSessionKey,
    deployAAWallet
  };
};

export default useUserOp;