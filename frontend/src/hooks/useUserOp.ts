import { useState, useCallback, useRef } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
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

/**
 * Custom hook for NERO Chain's Account Abstraction functionality
 */
const useUserOp = () => {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  
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

  // Use refs for stable references across renders
  const clientRef = useRef(null);
  const builderRef = useRef(null);
  const isInitializingRef = useRef(false);

  /**
   * Check if the AA wallet has enough prefunding in the EntryPoint contract
   */
  const checkAAWalletPrefunding = async () => {
    if (!aaWalletAddress) return false;
    
    try {
      // Create provider and EntryPoint contract instance
      const provider = new ethers.providers.JsonRpcProvider(NERO_RPC_URL);
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
      const provider = new ethers.providers.JsonRpcProvider(NERO_RPC_URL);
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
    if (isInitialized && client && builder) {
      return { success: true, client, builder };
    }
    
    if (isInitializingRef.current) {
      console.log('SDK initialization already in progress, waiting...');
      return new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (!isInitializingRef.current) {
            clearInterval(checkInterval);
            if (isInitialized && clientRef.current && builderRef.current) {
              resolve({ success: true, client: clientRef.current, builder: builderRef.current });
            } else {
              resolve({ success: false, error: 'Initialization completed but SDK not ready' });
            }
          }
        }, 100);
      });
    }
    
    try {
      const result = await initSDK();
      if (result.success) {
        clientRef.current = result.client;
        builderRef.current = result.builder;
      }
      return { 
        success: result.success, 
        client: result.success ? result.client : null,
        builder: result.success ? result.builder : null,
        error: result.error
      };
    } catch (err) {
      console.error("Error initializing SDK:", err);
      return { success: false, error: err.message || 'Unknown initialization error' };
    }
  };
  
  const initSDK = useCallback(async () => {
    if (isInitializingRef.current) {
      console.log('SDK initialization already in progress, waiting...');
      return new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (!isInitializingRef.current) {
            clearInterval(checkInterval);
            if (isInitialized && client && builder) {
              resolve({ 
                success: true, 
                client, 
                builder 
              });
            } else {
              resolve({ 
                success: false, 
                error: 'Initialization completed but SDK not ready' 
              });
            }
          }
        }, 100);
      });
    }
    
    if (isInitialized && client && builder) {
      return { success: true, client, builder };
    }
    
    isInitializingRef.current = true;
    
    // Check for connected wallet, wallet client, and address
    if (!isConnected || !walletClient || !address) {
      console.error('Wallet not connected, wallet client not available, or address missing');
      isInitializingRef.current = false;
      return { success: false, error: 'Wallet not connected, wallet client not available, or address missing' };
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      if (typeof window !== 'undefined' && window.ethereum) {
        try {
          await window.ethereum.request({ method: 'eth_requestAccounts' });
          
          const providerInstance = new ethers.providers.Web3Provider(window.ethereum);
          setProvider(providerInstance);
          
          // Get signer from wallet client - WITH ADDRESS EXPLICITLY SPECIFIED
          const signer = providerInstance.getSigner();
          
          // Initialize AA Client
          const aaClient = await Client.init(NERO_RPC_URL, {
            overrideBundlerRpc: BUNDLER_URL,
            entryPoint: ENTRYPOINT_ADDRESS,
          });
          
          // Store in refs instead of window globals
          clientRef.current = aaClient;
          setClient(aaClient);
          
          // Initialize SimpleAccount builder
          const aaBuilder = await Presets.Builder.SimpleAccount.init(
            signer, 
            NERO_RPC_URL,
            {
              overrideBundlerRpc: BUNDLER_URL,
              entryPoint: ENTRYPOINT_ADDRESS,
              factory: ACCOUNT_FACTORY_ADDRESS,
            }
          );
          
          // Store in refs instead of window globals
          builderRef.current = aaBuilder;
          setBuilder(aaBuilder);
          
          const aaAddress = await aaBuilder.getSender();
          const normalizedAAAddress = ethers.utils.getAddress(aaAddress);
          setAaWalletAddress(normalizedAAAddress);
          
          const code = await providerInstance.getCode(normalizedAAAddress);
          const deployed = code !== '0x';
          setIsDeployed(deployed);
          
          if (code === '0x') {
            const isPrefunded = await checkAAWalletPrefunding();
            setNeedsNeroTokens(!isPrefunded);
          }
          
          // Set initialized flag to true
          setIsInitialized(true);
          setIsLoading(false);
          isInitializingRef.current = false;
          
          return { 
            success: true, 
            client: aaClient, 
            builder: aaBuilder 
          };
        } catch (err) {
          console.error('Error initializing AA SDK:', err);
          setError(`Failed to initialize AA SDK: ${err.message}`);
          setIsLoading(false);
          isInitializingRef.current = false;
          return { success: false, error: err.message };
        }
      } else {
        setError('Ethereum provider not available');
        setIsLoading(false);
        isInitializingRef.current = false;
        return { success: false, error: 'Ethereum provider not available' };
      }
    } catch (err) {
      console.error('Error in AA SDK initialization:', err);
      setError(`AA SDK initialization error: ${err.message}`);
      setIsLoading(false);
      isInitializingRef.current = false;
      return { success: false, error: err.message };
    }
  }, [isConnected, isInitialized, client, builder, walletClient, address, checkAAWalletPrefunding]);

 /**
 * Deploy AA wallet with integrated verification
 */
const deployAAWallet = useCallback(async () => {
  const _builder = builderRef.current;
  const _client  = clientRef.current;

  if (!_builder == null || _client == null) {
    throw new Error('SDK still not ready');
  }

  setIsLoading(true);
  setError(null);

  try {
    console.log('🚀 Attempting to deploy AA wallet…');
    _builder.resetOp && _builder.resetOp();

    _builder.execute(ethers.constants.AddressZero, 0, '0x');

    _builder.setPaymasterOptions({
      type: 0,
      apikey: PAYMASTER_API_KEY,
      rpc: PAYMASTER_URL,
    });

    const userOp     = await _builder.buildOp();
    const opResponse = await _client.sendUserOperation(userOp);

    console.log('🔄 Waiting tx to be mined…');
    const receipt = await opResponse.wait();
    console.log('📝 Tx mined:', receipt.transactionHash);

    await new Promise((r) => setTimeout(r, 3_000));

    if (provider && aaWalletAddress) {
      const code = await provider.getCode(
        ethers.utils.getAddress(aaWalletAddress),
      );
      if (code === '0x') {
        throw new Error('Wallet deployment failed – no code at address');
      }
    }

    console.log('✅ AA wallet deployed:', receipt.transactionHash);
    setIsDeployed(true);
    setNeedsNeroTokens(false);
    return receipt;
  } catch (err: any) {
    console.error('❌ Failed to deploy AA wallet:', err);
    setNeedsNeroTokens(
      err.message?.includes('AA21') || err.message?.includes('funds'),
    );
    throw err;
  } finally {
    setIsLoading(false);
  }
}, [provider, aaWalletAddress]);


  /**
   * Main deployment function with verification
   * This serves as the single entry point for deployment checks
   */
  const deployOrWarn = async () => {
    if (isDeployed) return true;
    
    try {
      if (aaWalletAddress && provider) {
        console.log("🔍 Verifying wallet deployment status at:", aaWalletAddress);
        
        try {
          const normalizedAddress = ethers.utils.getAddress(aaWalletAddress);
          const code = await provider.getCode(normalizedAddress);
          
          if (code !== '0x') {
            console.log("✅ Wallet already deployed - found code at address");
            setIsDeployed(true);
            return true;
          }
          
          console.log("⚠️ Wallet not deployed - proceeding with deployment");
        } catch (checkErr) {
          console.error("Error checking deployment status:", checkErr);
        }
      }
      
    const { success } = await ensureSDKInitialized(); 
    if (!success) throw new Error('SDK init failed before deployment');
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
      const provider = new ethers.providers.JsonRpcProvider(NERO_RPC_URL);
      
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
      // For Type 0, don't pass token to paymaster
      const tokenToUse = paymentType === 0 ? null : (paymentToken || tokenAddress);
  
      if ((paymentType === 1 || paymentType === 2) && !tokenToUse) {
        throw new Error('Payment token is required for token-based gas payment');
      }
      
      // Make sure SDK is initialized
      console.log('Initializing SDK for transaction...');
      const initResult = await ensureSDKInitialized();
      if (!initResult.success) {
        throw new Error(initResult.error || 'Failed to initialize SDK');
      }
      
      // Use the client and builder from initialization result directly
      const aaClient = initResult.client, aaBuilder = initResult.builder;
      
      // Make sure the wallet is deployed if not skipping check
      if (!skipDeploymentCheck && !isDeployed) {
        await deployOrWarn();
      }
      
      const contractInterface = new ethers.utils.Interface([
        'function purchaseTickets(uint256 _lotteryId, address _tokenAddress, uint256 _quantity) returns (bool)'
      ]);
      
      const callData = contractInterface.encodeFunctionData(
        'purchaseTickets',
        [lotteryId, tokenAddress, quantity]
      );
      
      // Reset any previous operations
      aaBuilder.resetOp && aaBuilder.resetOp();
      
      // Configure the transaction
      aaBuilder.execute(LOTTERY_CONTRACT_ADDRESS, 0, callData);
      
      // Configure paymaster options - Type 0 does not include token
      const paymasterOptions = {
        type: paymentType,
        apikey: PAYMASTER_API_KEY,
        rpc: PAYMASTER_URL
      };
      
      // Only add token for Type 1 and 2
      if (paymentType !== 0 && tokenToUse) {
        paymasterOptions.token = tokenToUse;
      }
      
      // Set the options
      aaBuilder.setPaymasterOptions(paymasterOptions);
      
      // Log the UserOp before sending for debugging
      console.log('UserOp before sending:', JSON.stringify(aaBuilder, null, 2));
      
      // Use buildOp for newer SDK versions if available
      const userOp = aaBuilder.buildOp ? await aaBuilder.buildOp() : aaBuilder;
      
      // Send the UserOperation
      const result = await aaClient.sendUserOperation(userOp);
      console.log('UserOperation result:', result);
      
      const receipt = await result.wait();
      console.log('Transaction receipt:', receipt);
      
      setTxHash(receipt.transactionHash);
      
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
  }, [ensureSDKInitialized, isDeployed, deployOrWarn]);

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
      // For Type 0, don't pass token to paymaster
      const tokenToUse = paymentType === 0 ? null : (paymentToken || (selections.length > 0 ? selections[0].tokenAddress : null));
      
      // Validate token address for Types 1 & 2
      if ((paymentType === 1 || paymentType === 2) && !tokenToUse) {
        throw new Error('Payment token is required for token-based gas payment');
      }
      
      // Make sure SDK is initialized
      console.log('Initializing SDK for batch transaction...');
      const initResult = await ensureSDKInitialized();
      if (!initResult.success) {
        throw new Error(initResult.error || 'Failed to initialize SDK');
      }
      
      // Use the client and builder from initialization result directly
      const aaClient = initResult.client, aaBuilder = initResult.builder;
      
      // Make sure wallet is deployed if not skipping check
      if (!skipDeploymentCheck && !isDeployed) {
        await deployOrWarn();
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
      aaBuilder.resetOp && aaBuilder.resetOp();
      
      // Configure the execution
      aaBuilder.execute(LOTTERY_CONTRACT_ADDRESS, 0, callData);
      
      // Configure paymaster options - Type 0 does not include token
      const paymasterOptions = {
        type: paymentType,
        apikey: PAYMASTER_API_KEY,
        rpc: PAYMASTER_URL
      };
      
      // Only add token for Type 1 and 2
      if (paymentType !== 0 && tokenToUse) {
        paymasterOptions.token = tokenToUse;
      }
      
      // Set the paymaster options
      aaBuilder.setPaymasterOptions(paymasterOptions);
      
      // Log the UserOp before sending for debugging
      console.log('Batch UserOp before sending:', JSON.stringify(aaBuilder, null, 2));
      
      // Use buildOp for newer SDK versions if available
      const userOp = aaBuilder.buildOp ? await aaBuilder.buildOp() : aaBuilder;
      
      // Send the UserOperation
      const result = await aaClient.sendUserOperation(userOp);
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
  }, [ensureSDKInitialized, isDeployed, deployOrWarn]);

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
    checkAAWalletPrefunding,
    ensureSDKInitialized,
    deployOrWarn,
    checkTokenApproval
  };
};

export default useUserOp;