import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { ethers } from 'ethers';
import { Client, Presets } from 'userop';
import SUPPORTED_TOKENS from '../constants/tokens';
import paymasterService from '../services/paymasterService';
import { EntryPointAbi } from '../constants/abi'; // Import the EntryPoint ABI

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

// Configuration constants
const NERO_RPC_URL = import.meta.env.VITE_NERO_RPC_URL || "https://rpc-testnet.nerochain.io";
const BUNDLER_URL = import.meta.env.VITE_BUNDLER_URL || "https://bundler-testnet.nerochain.io";
const PAYMASTER_URL = import.meta.env.VITE_PAYMASTER_URL || "https://paymaster-testnet.nerochain.io";
const ENTRYPOINT_ADDRESS = import.meta.env.VITE_ENTRYPOINT_ADDRESS || "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
const ACCOUNT_FACTORY_ADDRESS = import.meta.env.VITE_ACCOUNT_FACTORY_ADDRESS || "0x9406Cc6185a346906296840746125a0E44976454";
const LOTTERY_CONTRACT_ADDRESS = import.meta.env.VITE_LOTTERY_CONTRACT_ADDRESS || "";
const TOKEN_PAYMASTER_ADDRESS = ethers.utils.getAddress(import.meta.env.VITE_TOKEN_PAYMASTER_ADDRESS || "0x5a6680dFd4a77FEea0A7be291147768EaA2414ad");

/**
 * Custom hook for NERO Chain's Account Abstraction functionality
 * Enhanced with prefunding capability
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
  const [isDevelopmentMode, setIsDevelopmentMode] = useState(false);
  const [needsNeroTokens, setNeedsNeroTokens] = useState(false);

  const [walletNeedsPrefunding, setWalletNeedsPrefunding] = useState(false);
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
      setWalletNeedsPrefunding(!hasDeposit);
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
   * Attempt to deploy AA wallet with proper error handling
   */
  const deployAAWallet = async () => {
    if (!builder || !client) {
      throw new Error('SDK not initialized');
    }
 
    setIsLoading(true);
    setError(null);
    
    try {
      console.log("Attempting to deploy AA wallet...");
      builder.resetOp && builder.resetOp();
      
      // Check if wallet is prefunded first
      const isPrefunded = await checkAAWalletPrefunding();
      if (!isPrefunded) {
        setNeedsNeroTokens(true);
        throw new Error("Your wallet needs to be prefunded with NERO tokens in the EntryPoint contract. Please use the 'Prefund Wallet' button first.");
      }
      
      // Use a minimal transaction to deploy
      builder.execute(ethers.constants.AddressZero, 0, "0x");
      
      // Try to send the operation
      const result = await client.sendUserOperation(builder);
      const receipt = await result.wait();
      console.log("AA wallet deployed successfully", receipt);
      
      // Update deployment status
      setIsDeployed(true);
      setNeedsNeroTokens(false);
      setIsLoading(false);
      
      return receipt;
    } catch (err) {
      console.error("Error deploying AA wallet:", err);
      setIsLoading(false);
      
      // Handle specific error cases
      if (err.message?.includes('AA21')) {
        setNeedsNeroTokens(true);
        throw new Error("Your wallet needs NERO tokens to deploy a smart contract wallet. Please add some NERO tokens to continue.");
      }
      
      throw err;
    }
  };

  /**
   * Ensure token approval for Paymaster with improved error handling
   */
  const ensurePaymasterApproval = async (tokenAddress, builder) => {
    if (!tokenAddress || !builder || isDevelopmentMode) return true;
    
    try {
      // Normalize addresses
      const normalizedTokenAddress = ethers.utils.getAddress(tokenAddress);
      const normalizedPaymasterAddress = ethers.utils.getAddress(TOKEN_PAYMASTER_ADDRESS);
      const normalizedAAWalletAddress = ethers.utils.getAddress(aaWalletAddress);
      
      // Create provider and token contract
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      
      const tokenContract = new ethers.Contract(
        normalizedTokenAddress,
        ['function allowance(address owner, address spender) view returns (uint256)',
         'function approve(address spender, uint256 amount) returns (bool)'],
        signer
      );
      
      // Check current allowance
      console.log(`Checking allowance for token ${normalizedTokenAddress} to paymaster ${normalizedPaymasterAddress}`);
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
        
        // Check if prefunded
        const isPrefunded = await checkAAWalletPrefunding();
        if (!isPrefunded) {
          setNeedsNeroTokens(true);
          throw new Error("Your wallet needs to be prefunded with NERO tokens in the EntryPoint contract. Please use the 'Prefund Wallet' button first.");
        }
        
        const deploySuccess = await deployAAWallet();
        if (!deploySuccess) {
          console.warn('Failed to deploy AA wallet');
          throw new Error('Failed to deploy smart contract wallet. Please try again later.');
        }
      }
      
      console.log('Insufficient allowance, approving token for Paymaster...');
      
      // Reset any previous operations
      builder.resetOp && builder.resetOp();
      
      // Encode approve function call
      const approveData = tokenContract.interface.encodeFunctionData(
        'approve',
        [normalizedPaymasterAddress, ethers.constants.MaxUint256]
      );
      
      // Create approval operation using Type 1 (prepay)
      // Always use Type 1 for approvals since it's most reliable
      const approvalOptions = {
        type: 1,
        apikey: import.meta.env.VITE_PAYMASTER_API_KEY || '',
        rpc: PAYMASTER_URL,
        token: SUPPORTED_TOKENS.USDC.address // Use USDC for approval
      };
      
      builder.setPaymasterOptions(approvalOptions);
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
   * Initialize the Account Abstraction SDK
   */
  const initSDK = useCallback(async () => {
    if (!isConnected) {
      if (localStorage.getItem('devModeEnabled') === 'true' ||
          window.location.search.includes('devMode=true')) {
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
      if (typeof window !== 'undefined' && window.ethereum) {
        try {

          await ensureWalletAccess();
          
          const provider = new ethers.providers.Web3Provider(window.ethereum);
          const signer = provider.getSigner();
          

          const signerAddress = await signer.getAddress();
          
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
          
          setIsLoading(false);
          return { success: true };
        } catch (err) {
          console.error('Error initializing AA SDK:', err);
          setIsDevelopmentMode(true);
          setAaWalletAddress('0x1234567890123456789012345678901234567890');
          setIsLoading(false);
          return { success: true, isDevelopmentMode: true };
        }
      } else {
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
  }, [isConnected, checkAAWalletPrefunding]);  

  /**
   * Execute a ticket purchase operation with improved error handling
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
      
      if (!client || !builder) {
        const initResult = await initSDK();
        if (!initResult.success) {
          throw new Error(initResult.error || 'Failed to initialize SDK');
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
      

      const finalPaymentType = paymentType === 0 ? 1 : paymentType;
      const finalPaymentToken = paymentToken || SUPPORTED_TOKENS.USDC.address;
      

      if (!skipDeploymentCheck && !isDeployed) {
        const isPrefunded = await checkAAWalletPrefunding();
        
        if (!isPrefunded) {
          setNeedsNeroTokens(true);

          setIsLoading(false);
          return {
            success: false,
            needsDeployment: true,
            message: "Smart contract wallet not deployed. You can continue without deployment, but transactions may be more likely to fail."
          };
        }
      }
      
      if (finalPaymentType !== 0) {
        await ensurePaymasterApproval(finalPaymentToken);
      }
      
      builder.execute(LOTTERY_CONTRACT_ADDRESS, 0, callData);
      
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
        

        if (sponsorError.message?.includes('account not deployed') || 
            sponsorError.message?.includes('AA20')) {
          
          setIsLoading(false);

          return {
            success: false,
            needsDeployment: true,
            error: sponsorError.message,
            message: "Smart contract wallet not deployed. Would you like to deploy it now?"
          };
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
      

      if (err.message?.includes('prefund') ||
          err.message?.includes('NERO tokens') ||
          err.message?.includes('AA20') ||
          err.message?.includes('AA21')) {
        
        setWalletNeedsPrefunding(true);
        setNeedsNeroTokens(true);
        setError("Smart contract wallet not deployed. You can continue without deployment, but transactions may be more likely to fail.");
        
        setIsLoading(false);
        return {
          success: false,
          needsDeployment: true,
          error: err.message,
          message: "Smart contract wallet not deployed. Would you like to deploy it now?"
        };
      }
      
      let errorMsg = err.message || 'Failed to purchase tickets';
      
      if (errorMsg.includes('token not supported') || errorMsg.includes('price error')) {
        errorMsg = 'The selected token is not supported by the Paymaster service. Please try a different token.';
      } else if (errorMsg.includes('insufficient allowance')) {
        errorMsg = 'Insufficient token allowance for gas payment. Please approve the token first.';
      } else if (errorMsg.includes('insufficient balance')) {
        errorMsg = 'Insufficient token balance for gas payment.';
      } else if (errorMsg.includes('account not deployed') || errorMsg.includes('AA20')) {
        errorMsg = 'Smart contract wallet not deployed. You can continue without deployment, but transactions may be more likely to fail.';
        
        setIsLoading(false);
        return {
          success: false,
          needsDeployment: true,
          error: err.message,
          message: "Smart contract wallet not deployed. Would you like to deploy it now?"
        };
      } else if (errorMsg.includes('AA21')) {
        errorMsg = 'Insufficient funds to deploy your smart wallet.';
      }
      
      setError(errorMsg);
      setIsLoading(false);
      throw new Error(errorMsg);
    }
  }, [client, builder, initSDK, isDevelopmentMode, address, isDeployed, checkAAWalletPrefunding, ensurePaymasterApproval]);

  /**
   * Execute a batch ticket purchase operation
   */
  const executeBatchPurchase = useCallback(async ({ 
    selections, 
    paymentType = 1,
    paymentToken = null,
    useSessionKey = false,
    skipApprovalCheck = false
  }) => {
    setIsLoading(true);
    setError(null);
    if (!isDeployed) {
      const isPrefunded = await checkAAWalletPrefunding();
      if (!isPrefunded) {
        setWalletNeedsPrefunding(true);
        setNeedsNeroTokens(true);
        setIsLoading(false);
        return {
          success: false,
          needsPrefunding: true,
          error: "Your wallet needs to be prefunded with NERO tokens in the EntryPoint contract."
        };
      }
    } 
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
      
      // Force Type 1 payment since Type 0 may not be supported
      const finalPaymentType = paymentType === 0 ? 1 : paymentType;
      const finalPaymentToken = paymentToken || SUPPORTED_TOKENS.USDC.address;
      
      // Check if the wallet is deployed
      if (!isDeployed) {
        const isPrefunded = await checkAAWalletPrefunding();
        if (!isPrefunded) {
          setNeedsNeroTokens(true);
          throw new Error("Your wallet needs to be prefunded with NERO tokens in the EntryPoint contract. Please use the 'Prefund Wallet' button first.");
        }
      }
      
      // Ensure token is approved for Paymaster (unless explicitly skipped)
      if (finalPaymentType !== 0 && !skipApprovalCheck) {
        await ensurePaymasterApproval(finalPaymentToken, builder);
      }
      
      // Configure the execution
      builder.execute(LOTTERY_CONTRACT_ADDRESS, 0, callData);
      
      // Get raw operation for sponsoring
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

      // Sponsor the operation
      const paymasterOpts = { 
        type: finalPaymentType.toString(),
        token: finalPaymentToken 
      };
      
      try {
        const pmData = await paymasterService.sponsorUserOp(userOp, paymasterOpts);
        userOp.paymasterAndData = pmData;
        builder.setOp(userOp);
      } catch (sponsorError) {
        console.error("Error sponsoring batch operation:", sponsorError);
        
        // If the account is not deployed, we need to deploy it first
        if (sponsorError.message?.includes('account not deployed')) {
          throw new Error("Smart contract wallet not deployed. Please add some NERO tokens to your wallet to deploy it.");
        }
        
        throw sponsorError;
      }
      
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
      } else if (errorMsg.includes('account not deployed') || errorMsg.includes('AA20')) {
        errorMsg = 'Smart contract wallet not deployed. Please add some NERO tokens to your wallet to deploy it.';
      } else if (errorMsg.includes('AA21')) {
        errorMsg = 'Insufficient funds to deploy your smart wallet. Please add some NERO tokens to continue.';
      }
      
      setError(errorMsg);
      setIsLoading(false);
      throw new Error(errorMsg);
    }
  }, [client, builder, initSDK, isDevelopmentMode, ensurePaymasterApproval, isDeployed, checkAAWalletPrefunding]);

  // Automatically initialize SDK when wallet is connected
  useEffect(() => {
    if ((isConnected) || 
        localStorage.getItem('devModeEnabled') === 'true' || 
        window.location.search.includes('devMode=true')) {
      initSDK().catch(console.error);
    }
  }, [isConnected, initSDK]);

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
    isDevelopmentMode,
    needsNeroTokens,
    isPrefundingWallet,
    walletNeedsPrefunding,
    initSDK,
    executeTicketPurchase,
    executeBatchPurchase,
    deployAAWallet,
    prefundAAWallet,
    checkAAWalletPrefunding,
    checkTokenApproval
  };
};

export default useUserOp;