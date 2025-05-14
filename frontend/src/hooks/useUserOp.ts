import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { ethers } from 'ethers';
import { Client, Presets } from 'userop';
import { EntryPointAbi } from '../constants/abi';
import { 
  NERO_RPC_URL, 
  BUNDLER_URL, 
  PAYMASTER_URL, 
  ENTRYPOINT_ADDRESS, 
  ACCOUNT_FACTORY_ADDRESS,
  LOTTERY_CONTRACT_ADDRESS,
  TOKEN_PAYMASTER_ADDRESS,
  PAYMASTER_API_KEY
} from '../constants/config';

// Global initialization flag to prevent concurrent initializations
let isInitializing = false;

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
  const [isPrefundingWallet, setIsPrefundingWallet] = useState(false);
  const [error, setError] = useState(null);
  const [txHash, setTxHash] = useState(null);
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
   * Utility to ensure SDK is initialized before operations
   */
  const ensureSDKInitialized = async () => {
    // If already initialized, return cached result
    if (isInitialized && client && builder) {
      return { success: true, client, builder };
    }
    
    // If initialization is in progress, wait for it to complete
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
        builder
      };
    }
    
    // Otherwise, initialize the SDK
    return await initSDK();
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
      
      // Set paymaster options to use sponsored gas (Type 0)
      builder.setPaymasterOptions({
        type: 0,
        apikey: PAYMASTER_API_KEY,
        rpc: PAYMASTER_URL
      });
  
      const userOpResponse = await client.sendUserOperation(builder);
      console.log("🔄 Waiting for wallet deployment transaction to be mined...");
      const receipt = await userOpResponse.wait();
      console.log("📝 Transaction mined:", receipt.transactionHash);
      
      // Set longer wait time (for blockchain state update)
      console.log("⏳ Waiting for blockchain state update...");
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Ensure address normalization
      const normalizedAddress = ethers.utils.getAddress(aaWalletAddress);
      
      // Verify wallet deployment
      if (provider) {
        console.log(`🔍 Checking code at address: ${normalizedAddress}`);
        const code = await provider.getCode(normalizedAddress);
        
        if (code === '0x') {
          console.error("❌ No code found at wallet address after deployment");
          throw new Error('Wallet deployment failed - no code at wallet address');
        }
        
        console.log("✅ Code verified at wallet address");
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
      
      if (err.message?.includes('No code found') || err.message?.includes('failed - no code')) {
        throw new Error("Wallet deployment verification failed. The transaction was mined but no code was found at the wallet address.");
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
    if (!tokenAddress) return true;
    
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
        
        const normalizedAddress = ethers.utils.getAddress(aaWalletAddress);
        const code = await provider.getCode(normalizedAddress);
        
        if (code !== '0x') {
          console.log("✅ Wallet already deployed - found code at address");
          setIsDeployed(true);
          return true;
        }
        
        console.log("⚠️ Wallet not deployed - proceeding with deployment");
      }
      
      // Make sure SDK is initialized before deployment
      if (!client || !builder) {
        console.log("SDK not initialized, re-initializing...");
        const result = await ensureSDKInitialized();
        if (!result.success) {
          throw new Error('SDK failed to initialize before deployment');
        }
      }
      
      // Otherwise attempt deployment
      await deployAAWallet();
      return true;
    } catch (err) {
      console.error("❌ Deployment error:", err);
      throw err;
    }
  };

  /**
   * Check if token approval is needed
   */
  const checkTokenApproval = async (tokenAddress) => {
    if (!tokenAddress || !aaWalletAddress) return true;
    
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
    paymentType = 0,
    paymentToken = null,
    useSessionKey = false,
    skipDeploymentCheck = false 
  }) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const tokenToUse = paymentToken || tokenAddress;

      if ((paymentType === 1 || paymentType === 2) && !paymentToken) {
        throw new Error('Payment token is required for token-based gas payment');
      }
      
      // Make sure SDK is initialized
      if (!client || !builder) {
        console.log('Initializing SDK for transaction...');
        const initResult = await ensureSDKInitialized();
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
      
      // Reset any previous operations
      builder.resetOp && builder.resetOp();
      
      // Configure the transaction
      builder.execute(LOTTERY_CONTRACT_ADDRESS, 0, callData);
      
      // Use builder's setPaymasterOptions to configure gas payment
      builder.setPaymasterOptions({
        type: paymentType,
        token: tokenToUse,
        apikey: PAYMASTER_API_KEY,
        rpc: PAYMASTER_URL
      });
      
      // Send the UserOperation
      const result = await client.sendUserOperation(builder);
      const receipt = await result.wait();
      setTxHash(receipt.transactionHash);
      
      // Refresh data if needed
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
      
      // Improved error handling
      let errorMsg = err.message || 'Failed to purchase tickets';
      
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
      }
      
      setError(errorMsg);
      setIsLoading(false);
      throw new Error(errorMsg);
    }
  }, [client, builder, ensureSDKInitialized, address, isDeployed, deployOrWarn, provider, aaWalletAddress]);

  /**
   * Execute a batch ticket purchase operation with proper wallet verification
   */
  const executeBatchPurchase = useCallback(async ({ 
    selections, 
    paymentType = 0,
    paymentToken = null,
    useSessionKey = false,
    skipDeploymentCheck = false
  }) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const tokenToUse = paymentToken || (selections.length > 0 ? selections[0].tokenAddress : null);
      
      // Validate token address for Types 1 & 2
      if ((paymentType === 1 || paymentType === 2) && !tokenToUse) {
        throw new Error('Payment token is required for token-based gas payment');
      }
      
      // Make sure SDK is initialized
      if (!client || !builder) {
        console.log('Initializing SDK for batch transaction...');
        const initResult = await ensureSDKInitialized();
        if (!initResult.success) {
          throw new Error(initResult.error || 'Failed to initialize SDK');
        }
      }
      
      // Make sure wallet is deployed if not skipping check
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
      
      // Ensure token is approved for Paymaster using direct EOA approach
      if (paymentType !== 0 && paymentToken) {
        await ensurePaymasterApproval(paymentToken, builder);
      }
      
      // Configure the execution
      builder.execute(LOTTERY_CONTRACT_ADDRESS, 0, callData);
      
      // Set the paymaster options directly with the SDK
      builder.setPaymasterOptions({
        type: paymentType,
        token: tokenToUse,
        apikey: PAYMASTER_API_KEY,
        rpc: PAYMASTER_URL
      });
      
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
      
      // Better error handling for specific messages
      let errorMsg = err.message || 'Failed to execute batch purchase';
      
      // Check for specific error messages
      if (errorMsg.includes('token not supported') || errorMsg.includes('price error')) {
        errorMsg = 'The selected token is not supported by the Paymaster service. Please try a different token.';
      } else if (errorMsg.includes('insufficient allowance')) {
        errorMsg = 'Insufficient token allowance for gas payment. Please approve the token first.';
      } else if (errorMsg.includes('insufficient balance')) {
        errorMsg = 'Insufficient token balance for gas payment.';
      } else if (errorMsg.includes('account not deployed') || errorMsg.includes('AA20')) {
        errorMsg = 'Smart contract wallet not deployed. Please deploy your wallet first.';
      } else if (errorMsg.includes('AA21')) {
        errorMsg = 'Insufficient funds to deploy your smart wallet. Please add some NERO tokens to continue.';
      }
      
      setError(errorMsg);
      setIsLoading(false);
      throw new Error(errorMsg);
    }
  }, [client, builder, ensureSDKInitialized, ensurePaymasterApproval, isDeployed, deployOrWarn, provider, aaWalletAddress]);

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
        builder
      };
    }
    
    // Return cached result if already initialized
    if (isInitialized && client && builder) {
      return { success: true, client, builder };
    }
    
    isInitializing = true; // Set global flag
      
    if (!isConnected) {
      setError('Wallet not connected');
      isInitializing = false;
      return { success: false, error: 'Wallet not connected' };
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      if (typeof window !== 'undefined' && window.ethereum) {
        try {
          // Ensure wallet access permissions first
          await window.ethereum.request({ method: 'eth_requestAccounts' });
          
          const provider = new ethers.providers.Web3Provider(window.ethereum);
          setProvider(provider);
          const signer = provider.getSigner();
          
          // Initialize AA client
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
          
          setIsInitialized(true);
          setIsLoading(false);
          console.log('SDK initialized successfully');
          isInitializing = false;
          return { success: true, client: aaClient, builder: aaBuilder };
        } catch (err) {
          console.error('Error initializing AA SDK:', err);
          setError(`Failed to initialize AA SDK: ${err.message}`);
          setIsLoading(false);
          isInitializing = false;
          return { success: false, error: err.message };
        }
      } else {
        setError('Ethereum provider not available');
        setIsLoading(false);
        isInitializing = false;
        return { success: false, error: 'Ethereum provider not available' };
      }
    } catch (err) {
      console.error('Error in AA SDK initialization:', err);
      setError(`AA SDK initialization error: ${err.message}`);
      setIsLoading(false);
      isInitializing = false;
      return { success: false, error: err.message };
    }
  }, [isConnected, isInitialized, client, builder, checkAAWalletPrefunding]);

  // Initialize SDK once when wallet is connected
  useEffect(() => {
    if (isConnected && !isInitialized && !isInitializing) {
      console.log('Initializing AA SDK...');
      initSDK().catch(console.error);
    }
  }, [isConnected, initSDK, isInitialized]);

  // Check prefunding status when wallet address changes
  useEffect(() => {
    if (aaWalletAddress && !isDeployed) {
      checkAAWalletPrefunding().catch(console.error);
    }
  }, [aaWalletAddress, isDeployed]);

  return {
    client,
    builder,
    aaWalletAddress,
    isDeployed,
    isLoading,
    error,
    txHash,
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
    ensureSDKInitialized
  };
};

export default useUserOp;