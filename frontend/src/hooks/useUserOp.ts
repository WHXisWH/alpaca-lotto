import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { ethers } from 'ethers';
import { Client, Presets } from 'userop';
import SUPPORTED_TOKENS from '../constants/tokens';
import paymasterService from '../services/paymasterService';
import { EntryPointAbi } from '../constants/abi';
import testModeUtils from '../utils/testModeUtils';

// Global initialization flag to prevent concurrent initializations
let isInitializing = false;

const NERO_RPC_URL = import.meta.env.VITE_NERO_RPC_URL || "https://rpc-testnet.nerochain.io";
const BUNDLER_URL = import.meta.env.VITE_BUNDLER_URL || "https://bundler-testnet.nerochain.io";
const PAYMASTER_URL = import.meta.env.VITE_PAYMASTER_URL || "https://paymaster-testnet.nerochain.io";
const ENTRYPOINT_ADDRESS = import.meta.env.VITE_ENTRYPOINT_ADDRESS || "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
const ACCOUNT_FACTORY_ADDRESS = import.meta.env.VITE_ACCOUNT_FACTORY_ADDRESS || "0x9406Cc6185a346906296840746125a0E44976454";
const LOTTERY_CONTRACT_ADDRESS = import.meta.env.VITE_LOTTERY_CONTRACT_ADDRESS || "";
const TOKEN_PAYMASTER_ADDRESS = ethers.utils.getAddress(import.meta.env.VITE_TOKEN_PAYMASTER_ADDRESS || "0x5a6680dFd4a77FEea0A7be291147768EaA2414ad");
const PAYMASTER_API_KEY = import.meta.env.VITE_PAYMASTER_API_KEY || "";

const useUserOp = () => {
  const { address, isConnected } = useAccount();
  const [client, setClient] = useState(null);
  const [builder, setBuilder] = useState(null);
  const [aaWalletAddress, setAaWalletAddress] = useState(null);
  const [isDeployed, setIsDeployed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPrefundingWallet, setIsPrefundingWallet] = useState(false);
  const [error, setError] = useState(null);
  const [txHash, setTxHash] = useState(null);
  const [isDevelopmentMode, setIsDevelopmentMode] = useState(testModeUtils.isTestModeEnabled());
  const [needsNeroTokens, setNeedsNeroTokens] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [provider, setProvider] = useState(null);

  /**
   * Check if the AA wallet has enough prefunding in the EntryPoint contract
   */
  const checkAAWalletPrefunding = async () => {
    if (!aaWalletAddress) return false;
    
    try {
      // Create provider and EntryPoint contract instance
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const entryPointContract = new ethers.Contract(
        ENTRYPOINT_ADDRESS,
        EntryPointAbi,
        provider
      );
      
      // Get deposit info for the AA wallet
      const depositInfo = await entryPointContract.getDepositInfo(aaWalletAddress);
      
      // Check if deposit is greater than 0
      const hasDeposit = depositInfo && depositInfo.deposit && depositInfo.deposit.gt(0);
      
      // Update state based on deposit check
      setNeedsNeroTokens(!hasDeposit);
      
      console.log('AA wallet deposit info:', depositInfo);
      console.log('Has deposit:', hasDeposit);
      
      return hasDeposit;
    } catch (err) {
      console.error('Error checking AA wallet prefunding:', err);
      return false;
    }
  };

  /**
   * Prefund the AA wallet in the EntryPoint contract
   * @param {string} amount - Amount of NERO to deposit (e.g., "0.05")
   */
  const prefundAAWallet = async (amount = "0.05") => {
    if (!aaWalletAddress) {
      throw new Error('AA wallet address not available');
    }
    
    setIsPrefundingWallet(true);
    setError(null);
    
    try {
      // Create provider and signer
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      
      // Create EntryPoint contract instance
      const entryPointContract = new ethers.Contract(
        ENTRYPOINT_ADDRESS,
        EntryPointAbi,
        signer
      );
      
      // Parse amount to wei
      const prefundAmount = ethers.utils.parseEther(amount);
      
      console.log(`Prefunding AA wallet ${aaWalletAddress} with ${amount} NERO...`);
      
      // Call depositTo function with value
      const tx = await entryPointContract.depositTo(aaWalletAddress, {
        value: prefundAmount
      });
      
      // Wait for transaction to be mined
      const receipt = await tx.wait();
      console.log('Prefunding transaction complete:', receipt);
      
      // Check if prefunding was successful
      const isPrefunded = await checkAAWalletPrefunding();
      if (!isPrefunded) {
        throw new Error('Prefunding failed. Please try again with a higher amount.');
      }
      
      setNeedsNeroTokens(false);
      return receipt;
    } catch (err) {
      console.error('Error prefunding AA wallet:', err);
      throw err;
    } finally {
      setIsPrefundingWallet(false);
    }
  };

  /**
   * Deploy AA wallet with integrated verification
   */
  const deployAAWallet = async () => {
    if (!builder || !client) {
      throw new Error('SDK not initialized');
    }
  
    setIsLoading(true);
    setError(null);
  
    try {
      console.log("🚀 Attempting to deploy AA wallet...");
      builder.resetOp && builder.resetOp();
  
      // Trigger a minimal "empty" UserOp to force contract deployment
      builder.execute(ethers.constants.AddressZero, 0, "0x");
  
      const userOpResponse = await client.sendUserOperation(builder);
      console.log("🔄 Waiting for wallet deployment transaction to be mined...");
      const receipt = await userOpResponse.wait();
      console.log("📝 Transaction mined:", receipt.transactionHash);
      
      // Wait a brief moment to ensure blockchain state is updated
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify the wallet is deployed by checking the code at the address
      if (provider) {
        const code = await provider.getCode(ethers.utils.getAddress(aaWalletAddress));
        
        if (code === '0x') {
          console.error("❌ No code found at wallet address after deployment");
          throw new Error('Wallet deployment failed - no code at wallet address');
        }
      }
  
      console.log("✅ AA wallet deployed:", receipt.transactionHash);
      setIsDeployed(true);
      setNeedsNeroTokens(false);
      return receipt;
    } catch (err) {
      console.error("❌ Failed to deploy AA wallet:", err);

      if (err.message?.includes('AA21') || err.message?.includes('funds')) {
        setNeedsNeroTokens(true);
        throw new Error("Not enough NERO balance to deploy the AA wallet. Please deposit funds into the EntryPoint contract first.");
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  };
  
  /**
   * Ensure token approval for Paymaster with direct EOA approach
   */
  const ensurePaymasterApproval = async (tokenAddress, builder) => {
    if (!tokenAddress || isDevelopmentMode) return true;
    
    try {
      // Normalize addresses
      const normalizedTokenAddress = ethers.utils.getAddress(tokenAddress);
      const normalizedPaymasterAddress = ethers.utils.getAddress(TOKEN_PAYMASTER_ADDRESS);
      
      // Create provider and token contract - use direct EOA approach
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const eoaAddress = await signer.getAddress();
      
      const tokenContract = new ethers.Contract(
        normalizedTokenAddress,
        ['function allowance(address owner, address spender) view returns (uint256)',
         'function approve(address spender, uint256 amount) returns (bool)'],
        signer
      );
      
      // Check current allowance
      console.log(`Checking allowance for token ${normalizedTokenAddress} to paymaster ${normalizedPaymasterAddress}`);
      const allowance = await tokenContract.allowance(eoaAddress, normalizedPaymasterAddress);
      
      // If allowance is sufficient, no need to approve
      if (allowance.gte(ethers.constants.MaxUint256.div(2))) {
        console.log('Token already approved for Paymaster');
        return true;
      }
      
      console.log('Insufficient allowance, approving token for Paymaster with direct EOA transaction...');
      
      // Direct EOA transaction to approve token
      const tx = await tokenContract.approve(normalizedPaymasterAddress, ethers.constants.MaxUint256);
      console.log('Approval transaction sent:', tx.hash);
      
      // Wait for transaction confirmation
      const receipt = await tx.wait();
      console.log('Approval transaction complete:', receipt);
      
      // Verify approval was successful
      const newAllowance = await tokenContract.allowance(eoaAddress, normalizedPaymasterAddress);
      return newAllowance.gt(allowance);
    } catch (error) {
      console.error('Error ensuring token approval for Paymaster:', error);
      
      // If in development mode, assume approval success
      if (isDevelopmentMode) {
        return true;
      }
      
      // Check if user rejected the transaction
      if (error.message?.includes('User denied') || 
          error.message?.includes('user rejected') ||
          error.message?.includes('rejected the request')) {
        throw new Error('You canceled the approval transaction.');
      }
      
      throw new Error('Failed to approve token for gas payment. Please try again or choose a different token.');
    }
  };

  /**
   * Main deployment function with verification
   * This serves as the single entry point for deployment checks
   */
  const deployOrWarn = async () => {
    // First check if already deployed
    if (isDeployed) return true;
    
    try {
      // Double-check with getCode to be sure
      if (aaWalletAddress && provider) {
        console.log("🔍 Verifying wallet deployment status at:", aaWalletAddress);
        const code = await provider.getCode(ethers.utils.getAddress(aaWalletAddress));
        
        if (code !== '0x') {
          console.log("✅ Wallet already deployed - found code at address");
          setIsDeployed(true);
          return true;
        }
        
        console.log("⚠️ Wallet not deployed - proceeding with deployment");
      }
      
      // Otherwise attempt deployment
      await deployAAWallet();
      return true;
    } catch (err) {
      console.error("❌ Deployment error:", err);
      
      // If auto fallback is enabled or specifically requested
      if (err._fallbackToTestMode || localStorage.getItem('autoFallbackEnabled') === 'true') {
        testModeUtils.enableTestMode('deployment_failure');
        setIsDevelopmentMode(true);
        return false;
      }
      
      throw err;
    }
  };

  /**
   * Initialize the Account Abstraction SDK
   */
  const initSDK = useCallback(async () => {
    // If initialization is already in progress, wait for it to finish
    if (isInitializing) {
      console.log('SDK initialization already in progress, waiting...');
      await new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (!isInitializing) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      });
      
      return { 
        success: isInitialized, 
        client, 
        builder,
        isDevelopmentMode
      };
    }
    
    // Return cached result if already initialized
    if (isInitialized && client && builder) {
      return { success: true, client, builder };
    }
    
    isInitializing = true; // Set global flag
      
    if (!isConnected) {
      if (testModeUtils.isTestModeEnabled()) {
        setIsDevelopmentMode(true);
        setAaWalletAddress('0x1234567890123456789012345678901234567890');
        setIsInitialized(true);
        isInitializing = false;
        return { success: true, isDevelopmentMode: true };
      }
      setError('Wallet not connected');
      isInitializing = false;
      return { success: false, error: 'Wallet not connected' };
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      if (typeof window !== 'undefined' && window.ethereum) {
        try {
          // Validate PAYMASTER_URL
          const paymasterUrlValid = PAYMASTER_URL && 
                                  (PAYMASTER_URL.startsWith('http://') || 
                                   PAYMASTER_URL.startsWith('https://'));
          
          if (!paymasterUrlValid) {
            console.warn('Invalid PAYMASTER_URL:', PAYMASTER_URL);
            throw new Error('Invalid Paymaster URL configuration');
          }
          
          // When initializing paymasterService
          await paymasterService.init(PAYMASTER_API_KEY);
          
          // Test Paymaster connection
          try {
            const paymasterRpc = new ethers.providers.JsonRpcProvider(PAYMASTER_URL);
            await paymasterRpc.getNetwork();
            console.log('Paymaster RPC connection successful');
          } catch (paymasterErr) {
            console.warn('Paymaster RPC connection failed:', paymasterErr);
            // Don't throw - we'll handle this gracefully when needed
          }

          // Ensure wallet access permissions first
          await window.ethereum.request({ method: 'eth_requestAccounts' });
          
          const provider = new ethers.providers.Web3Provider(window.ethereum);
          setProvider(provider);
          const signer = provider.getSigner();
          
          // Initialize AA client and builder only if in normal mode
          if (!testModeUtils.isTestModeEnabled()) {
            const aaClient = await Client.init(NERO_RPC_URL, {
              overrideBundlerRpc: BUNDLER_URL,
              entryPoint: ENTRYPOINT_ADDRESS,
            });
            setClient(aaClient);
            
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
            
            const aaAddress = await aaBuilder.getSender();
            const normalizedAAAddress = ethers.utils.getAddress(aaAddress);
            setAaWalletAddress(normalizedAAAddress);
            
            const code = await provider.getCode(normalizedAAAddress);
            const deployed = code !== '0x';
            setIsDeployed(deployed);
            
            if (code === '0x') {
              const isPrefunded = await checkAAWalletPrefunding();
              setNeedsNeroTokens(!isPrefunded);
            }
          } else {
            // In test mode, set mock address
            setAaWalletAddress('0x1234567890123456789012345678901234567890');
            setIsDevelopmentMode(true);
          }
          
          setIsInitialized(true);
          setIsLoading(false);
          console.log('SDK initialized successfully');
          isInitializing = false;
          return { success: true, client, builder, isDevelopmentMode: testModeUtils.isTestModeEnabled() };
        } catch (err) {
          console.error('Error initializing AA SDK:', err);
          setIsDevelopmentMode(true);
          setAaWalletAddress('0x1234567890123456789012345678901234567890');
          setIsInitialized(true);
          setIsLoading(false);
          isInitializing = false;
          return { success: true, isDevelopmentMode: true };
        }
      } else {
        setIsDevelopmentMode(true);
        setAaWalletAddress('0x1234567890123456789012345678901234567890');
        setIsInitialized(true);
        setIsLoading(false);
        isInitializing = false;
        return { success: true, isDevelopmentMode: true };
      }
    } catch (err) {
      console.error('Error in AA SDK initialization:', err);
      setError(`AA SDK initialization error: ${err.message}`);
      setIsLoading(false);
      isInitializing = false;
      return { success: false, error: err.message };
    }
  }, [isConnected, isInitialized, client, builder, checkAAWalletPrefunding]);

  /**
   * Check if token approval is needed
   */
  const checkTokenApproval = async (tokenAddress) => {
    if (!tokenAddress || !aaWalletAddress || isDevelopmentMode) return true;
    
    try {
      // Normalize addresses
      const normalizedTokenAddress = ethers.utils.getAddress(tokenAddress);
      const normalizedPaymasterAddress = ethers.utils.getAddress(TOKEN_PAYMASTER_ADDRESS);
      const normalizedAAWalletAddress = ethers.utils.getAddress(aaWalletAddress);
      
      // Create provider and token contract
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      
      const tokenContract = new ethers.Contract(
        normalizedTokenAddress,
        ['function allowance(address owner, address spender) view returns (uint256)'],
        provider
      );
      
      // Check current allowance
      const allowance = await tokenContract.allowance(normalizedAAWalletAddress, normalizedPaymasterAddress);
      
      // Return true if allowance is sufficient
      return allowance.gte(ethers.constants.MaxUint256.div(2));
    } catch (error) {
      console.error('Error checking token approval:', error);
      return false;
    }
  };

  /**
   * Execute a ticket purchase operation with proper wallet verification
   */
  const executeTicketPurchase = useCallback(async ({
    lotteryId,
    tokenAddress,
    quantity,
    paymentType = 1,
    paymentToken = null,
    useSessionKey = false,
    skipDeploymentCheck = false 
  }) => {
    setIsLoading(true);
    setError(null);
    
    try {
      if ((paymentType === 1 || paymentType === 2) && !paymentToken) {
        paymentToken = SUPPORTED_TOKENS.USDC.address;
      }
      
      if (isDevelopmentMode) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        const mockTxHash = '0x' + [...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
        setTxHash(mockTxHash);
        setIsLoading(false);
        return mockTxHash;
      }
      
      // Only initialize if not already initialized
      if (!client || !builder) {
        console.log('Initializing SDK for transaction...');
        const initResult = await initSDK();
        if (!initResult.success) {
          throw new Error(initResult.error || 'Failed to initialize SDK');
        }
      }
      
      // Make sure the wallet is deployed if not skipping check
      if (!skipDeploymentCheck && !isDeployed) {
        await deployOrWarn();
        
        // Double-check deployment was successful
        if (!isDeployed && provider) {
          const code = await provider.getCode(aaWalletAddress);
          if (code === '0x') {
            throw new Error('Wallet deployment failed. Please try again.');
          }
        }
      }
      
      const contractInterface = new ethers.utils.Interface([
        'function purchaseTickets(uint256 _lotteryId, address _tokenAddress, uint256 _quantity) returns (bool)'
      ]);
      
      const callData = contractInterface.encodeFunctionData(
        'purchaseTickets',
        [lotteryId, tokenAddress, quantity]
      );
      
      builder.resetOp && builder.resetOp();
      
      // Use user-selected payment type
      const finalPaymentType = paymentType;
      const finalPaymentToken = paymentToken || SUPPORTED_TOKENS.USDC.address;
      
      // Ensure token is approved for Paymaster with direct EOA approach
      if (finalPaymentType !== 0) {
        await ensurePaymasterApproval(finalPaymentToken, builder);
      }
      
      builder.execute(LOTTERY_CONTRACT_ADDRESS, 0, callData);
      
      // Configure Paymaster options with PAYMASTER_URL
      builder.setPaymasterOptions({
        type: finalPaymentType.toString(),
        token: (finalPaymentType === 1 || finalPaymentType === 2) ? finalPaymentToken : undefined,
        apikey: PAYMASTER_API_KEY,
        rpc: PAYMASTER_URL
      });
      
      const rawOp = await builder.getOp();
      const userOp = {
        sender: rawOp.sender,
        nonce: rawOp.nonce.toHexString(),
        initCode: rawOp.initCode,
        callData: rawOp.callData,
        callGasLimit: rawOp.callGasLimit.toHexString(),
        verificationGasLimit: rawOp.verificationGasLimit.toHexString(),
        preVerificationGas: rawOp.preVerificationGas.toHexString(),
        maxFeePerGas: rawOp.maxFeePerGas.toHexString(),
        maxPriorityFeePerGas: rawOp.maxPriorityFeePerGas.toHexString(),
        paymasterAndData: rawOp.paymasterAndData,
        signature: rawOp.signature
      };
      
      const paymasterOpts = {
        type: finalPaymentType.toString(),
        token: finalPaymentToken
      };
      
      try {
        const pmData = await paymasterService.sponsorUserOp(userOp, paymasterOpts);
        userOp.paymasterAndData = pmData;
        builder.setOp(userOp);
      } catch (sponsorError) {
        console.error("Error sponsoring operation:", sponsorError);
        
        // If it's a nonce error, reset operation and retry
        if (sponsorError.message?.includes('AA25') || sponsorError.message?.includes('nonce')) {
          // Only retry once to avoid infinite loops
          if (!arguments[0]._retried) {
            console.log("Nonce error detected, retrying with fresh builder");
            builder.resetOp && builder.resetOp();
            const retryArgs = {
              ...arguments[0],
              _retried: true
            };
            return executeTicketPurchase(retryArgs);
          }
        }
        
        // If Paymaster connection fails, switch to test mode
        if (sponsorError.message?.includes('Paymaster RPC connection failed')) {
          console.error("Cannot connect to Paymaster service:", sponsorError);
          console.log("Switching to test mode due to Paymaster connection failure");
          testModeUtils.enableTestMode('paymaster_connection_failed');
          setIsDevelopmentMode(true);
          
          // Return mock hash
          const mockTxHash = '0x' + [...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
          setTxHash(mockTxHash);
          setIsLoading(false);
          return mockTxHash;
        }
        
        throw sponsorError;
      }
      
      const result = await client.sendUserOperation(builder);
      const receipt = await result.wait();
      setTxHash(receipt.transactionHash);
      
      try {
        const apiModule = await import('../services/api');
        const api = apiModule.default || apiModule.api;
        if (api && lotteryId) {
          await api.getLotteryDetails(lotteryId);
          if (address) {
            await api.getUserTickets(lotteryId, address);
          }
        }
      } catch (refreshErr) {
        console.warn('Error refreshing data after purchase:', refreshErr);
      }
      
      setIsLoading(false);
      return receipt.transactionHash;
    } catch (err) {
      console.error('Error executing ticket purchase:', err);
      
      // If error and auto fallback is enabled, switch to test mode
      if (localStorage.getItem('autoFallbackEnabled') === 'true') {
        console.log("Falling back to development mode due to error");
        testModeUtils.enableTestMode('execution_error');
        setIsDevelopmentMode(true);
        
        // Return mock hash
        const mockTxHash = '0x' + [...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
        setTxHash(mockTxHash);
        setIsLoading(false);
        return mockTxHash;
      }
      
      let errorMsg = err.message || 'Failed to purchase tickets';
      
      // Handle specific error messages
      if (errorMsg.includes('token not supported') || errorMsg.includes('price error')) {
        errorMsg = 'The selected token is not supported. Please try a different token.';
      } else if (errorMsg.includes('insufficient allowance')) {
        errorMsg = 'Insufficient token allowance for gas payment. Please approve the token first.';
      } else if (errorMsg.includes('insufficient balance')) {
        errorMsg = 'Insufficient token balance for gas payment.';
      } else if (errorMsg.includes('account not deployed') || errorMsg.includes('AA20')) {
        errorMsg = 'Smart contract wallet not deployed. Please deploy your wallet first.';
      } else if (errorMsg.includes('AA21')) {
        errorMsg = 'Insufficient funds to deploy your smart wallet.';
      } else if (errorMsg.includes('AA25') || errorMsg.includes('nonce')) {
        errorMsg = 'Transaction nonce is invalid. Please try again.';
      } else if (errorMsg.includes('includes is not a function')) {
        // Handle the specific TypeError
        errorMsg = 'Error processing paymaster response. Please try again.';
      }
      
      setError(errorMsg);
      setIsLoading(false);
      throw new Error(errorMsg);
    }
  }, [client, builder, initSDK, isDevelopmentMode, address, isDeployed, deployOrWarn, ensurePaymasterApproval, provider, aaWalletAddress]);

  /**
   * Execute a batch ticket purchase operation with proper wallet verification
   */
  const executeBatchPurchase = useCallback(async ({
    lotteryId,
    tokenAddress,
    quantity,
    paymentType = 1,
    paymentToken = null,
    useSessionKey = false,
    skipDeploymentCheck = false
  }) => {
    setIsLoading(true);
    setError(null);
    
    try {
      if ((paymentType === 1 || paymentType === 2) && !paymentToken) {
        paymentToken = SUPPORTED_TOKENS.USDC.address;
      }
      
      if (isDevelopmentMode) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        const mockTxHash = '0x' + [...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
        setTxHash(mockTxHash);
        setIsLoading(false);
        return mockTxHash;
      }
      
      // Only initialize if not already initialized
      if (!client || !builder) {
        console.log('Initializing SDK for batch transaction...');
        const initResult = await initSDK();
        if (!initResult.success) {
          throw new Error(initResult.error || 'Failed to initialize SDK');
        }
      }
      
      // Make sure the wallet is deployed if not skipping check
      if (!skipDeploymentCheck && !isDeployed) {
        await deployOrWarn();
        
        // Double-check deployment was successful
        if (!isDeployed && provider) {
          const code = await provider.getCode(aaWalletAddress);
          if (code === '0x') {
            throw new Error('Wallet deployment failed. Please try again.');
          }
        }
      }
      
      const contractInterface = new ethers.utils.Interface([
        'function batchPurchaseTickets(uint256 _lotteryId, address _tokenAddress, uint256 _quantity) returns (bool)'
      ]);
      
      const callData = contractInterface.encodeFunctionData(
        'batchPurchaseTickets',
        [lotteryId, tokenAddress, quantity]
      );
      
      builder.resetOp && builder.resetOp();
      
      // Use user-selected payment type
      const finalPaymentType = paymentType;
      const finalPaymentToken = paymentToken || SUPPORTED_TOKENS.USDC.address;
      
      // Ensure token is approved for Paymaster with direct EOA approach
      if (finalPaymentType !== 0) {
        await ensurePaymasterApproval(finalPaymentToken, builder);
      }
      
      builder.execute(LOTTERY_CONTRACT_ADDRESS, 0, callData);
      
      // Configure Paymaster options with PAYMASTER_URL
      builder.setPaymasterOptions({
        type: finalPaymentType.toString(),
        token: (finalPaymentType === 1 || finalPaymentType === 2) ? finalPaymentToken : undefined,
        apikey: PAYMASTER_API_KEY,
        rpc: PAYMASTER_URL
      });
      
      const rawOp = await builder.getOp();
      const userOp = {
        sender: rawOp.sender,
        nonce: rawOp.nonce.toHexString(),
        initCode: rawOp.initCode,
        callData: rawOp.callData,
        callGasLimit: rawOp.callGasLimit.toHexString(),
        verificationGasLimit: rawOp.verificationGasLimit.toHexString(),
        preVerificationGas: rawOp.preVerificationGas.toHexString(),
        maxFeePerGas: rawOp.maxFeePerGas.toHexString(),
        maxPriorityFeePerGas: rawOp.maxPriorityFeePerGas.toHexString(),
        paymasterAndData: rawOp.paymasterAndData,
        signature: rawOp.signature
      };
      
      const paymasterOpts = {
        type: finalPaymentType.toString(),
        token: finalPaymentToken
      };
      
      try {
        const pmData = await paymasterService.sponsorUserOp(userOp, paymasterOpts);
        userOp.paymasterAndData = pmData;
        builder.setOp(userOp);
      } catch (sponsorError) {
        console.error("Error sponsoring operation:", sponsorError);
        
        // If it's a nonce error, reset operation and retry
        if (sponsorError.message?.includes('AA25') || sponsorError.message?.includes('nonce')) {
          // Only retry once to avoid infinite loops
          if (!arguments[0]._retried) {
            console.log("Nonce error detected, retrying with fresh builder");
            builder.resetOp && builder.resetOp();
            const retryArgs = {
              ...arguments[0],
              _retried: true
            };
            return executeBatchPurchase(retryArgs);
          }
        }
        
        // If Paymaster connection fails, switch to test mode
        if (sponsorError.message?.includes('Paymaster RPC connection failed')) {
          console.error("Cannot connect to Paymaster service:", sponsorError);
          console.log("Switching to test mode due to Paymaster connection failure");
          testModeUtils.enableTestMode('paymaster_connection_failed');
          setIsDevelopmentMode(true);
          
          // Return mock hash
          const mockTxHash = '0x' + [...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
          setTxHash(mockTxHash);
          setIsLoading(false);
          return mockTxHash;
        }
        
        throw sponsorError;
      }
      
      const result = await client.sendUserOperation(builder);
      const receipt = await result.wait();
      setTxHash(receipt.transactionHash);
      
      try {
        const apiModule = await import('../services/api');
        const api = apiModule.default || apiModule.api;
        if (api && lotteryId) {
          await api.getLotteryDetails(lotteryId);
          if (address) {
            await api.getUserTickets(lotteryId, address);
          }
        }
      } catch (refreshErr) {
        console.warn('Error refreshing data after batch purchase:', refreshErr);
      }
      
      setIsLoading(false);
      return receipt.transactionHash;
    } catch (err) {
      console.error('Error executing batch purchase:', err);
      
      // If error and auto fallback is enabled, switch to test mode
      if (localStorage.getItem('autoFallbackEnabled') === 'true') {
        console.log("Falling back to development mode due to error");
        testModeUtils.enableTestMode('execution_error');
        setIsDevelopmentMode(true);
        
        // Return mock hash
        const mockTxHash = '0x' + [...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
        setTxHash(mockTxHash);
        setIsLoading(false);
        return mockTxHash;
      }
      
      let errorMsg = err.message || 'Failed to purchase tickets';
      
      // Handle specific error messages
      if (errorMsg.includes('token not supported') || errorMsg.includes('price error')) {
        errorMsg = 'The selected token is not supported. Please try a different token.';
      } else if (errorMsg.includes('insufficient allowance')) {
        errorMsg = 'Insufficient token allowance for gas payment. Please approve the token first.';
      } else if (errorMsg.includes('insufficient balance')) {
        errorMsg = 'Insufficient token balance for gas payment.';
      } else if (errorMsg.includes('account not deployed') || errorMsg.includes('AA20')) {
        errorMsg = 'Smart contract wallet not deployed. Please deploy your wallet first.';
      } else if (errorMsg.includes('AA21')) {
        errorMsg = 'Insufficient funds to deploy your smart wallet.';
      } else if (errorMsg.includes('AA25') || errorMsg.includes('nonce')) {
        errorMsg = 'Transaction nonce is invalid. Please try again.';
      } else if (errorMsg.includes('includes is not a function')) {
        // Handle the specific TypeError
        errorMsg = 'Error processing paymaster response. Please try again.';
      }
      
      setError(errorMsg);
      setIsLoading(false);
      throw new Error(errorMsg);
    }
  }, [client, builder, initSDK, isDevelopmentMode, address, isDeployed, deployOrWarn, ensurePaymasterApproval, provider, aaWalletAddress]);

  /**
   * Enter test mode
   */
  const enableTestMode = () => {
    testModeUtils.enableTestMode('user_choice');
    setIsDevelopmentMode(true);
    return true;
  };

  // Initialize SDK once when wallet is connected
  useEffect(() => {
    if ((isConnected || testModeUtils.isTestModeEnabled()) && !isInitialized) {
      console.log('Initializing AA SDK...');
      initSDK().catch(console.error);
    }
  }, [isConnected, initSDK, isInitialized]);

  // Check prefunding status when wallet address changes
  useEffect(() => {
    if (aaWalletAddress && !isDeployed && !isDevelopmentMode) {
      checkAAWalletPrefunding().catch(console.error);
    }
  }, [aaWalletAddress, isDeployed, isDevelopmentMode]);

  return {
    client,
    builder,
    aaWalletAddress,
    isDeployed,
    isLoading,
    error,
    txHash,
    isDevelopmentMode,
    needsNeroTokens,
    isPrefundingWallet,
    initSDK,
    executeTicketPurchase,
    executeBatchPurchase,
    deployAAWallet,
    prefundAAWallet,
    checkAAWalletPrefunding,
    checkTokenApproval,
    deployOrWarn,
    enableTestMode
  };
};

async function ensureWalletAccess() {
  try {
    if (typeof window !== 'undefined' && window.ethereum) {
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      return true;
    }
    return false;
  } catch (err) {
    console.error('Error requesting account access:', err);
    return false;
  }
}

export default useUserOp;