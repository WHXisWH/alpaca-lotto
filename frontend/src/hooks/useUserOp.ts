// frontend/src/hooks/useUserOp.js
import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { ethers } from 'ethers';
import { Client, Presets } from 'userop';

// Constants for AA setup
const NERO_RPC_URL = "https://rpc-testnet.nerochain.io";
const BUNDLER_URL = "https://bundler.service.nerochain.io";
const PAYMASTER_URL = "https://paymaster-testnet.nerochain.io";
const ENTRYPOINT_ADDRESS = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
const ACCOUNT_FACTORY_ADDRESS = "0x9406Cc6185a346906296840746125a0E44976454";

/**
 * Hook for Account Abstraction functionality
 */
const useUserOp = () => {
  const { address, isConnected } = useAccount();
  const [client, setClient] = useState(null);
  const [builder, setBuilder] = useState(null);
  const [aaWalletAddress, setAaWalletAddress] = useState('');
  const [isDeployed, setIsDeployed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Initialize the AA SDK
   */
  const initSDK = useCallback(async () => {
    if (!isConnected || !address) {
      setError('Wallet not connected');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Create a signer from the connected wallet
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      
      // Initialize the AA Client
      const aaClient = await Client.init(NERO_RPC_URL, {
        overrideBundlerRpc: BUNDLER_URL,
        entryPoint: ENTRYPOINT_ADDRESS,
      });
      setClient(aaClient);

      // Create a SimpleAccount builder
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

      // Get the AA wallet address
      const simpleAccountAddress = await aaBuilder.getSender();
      setAaWalletAddress(simpleAccountAddress);

      // Check if the AA wallet is deployed
      const code = await provider.getCode(simpleAccountAddress);
      setIsDeployed(code !== '0x');

      setIsLoading(false);
    } catch (err) {
      console.error('Error initializing AA SDK:', err);
      setError(`Error initializing AA SDK: ${err.message}`);
      setIsLoading(false);
    }
  }, [isConnected, address]);

  // Initialize SDK when wallet is connected
  useEffect(() => {
    if (isConnected && !client) {
      initSDK();
    }
  }, [isConnected, client, initSDK]);

  /**
   * Create and send a UserOperation
   */
  const sendUserOp = useCallback(async (callData, to, value = 0, paymasterOptions = null) => {
    if (!client || !builder) {
      throw new Error('AA SDK not initialized');
    }

    try {
      // Reset the builder to avoid stale state
      builder.resetOp();
      
      // Set the execution parameters
      builder.execute(to, value, callData);
      
      // Set paymaster options if provided
      if (paymasterOptions) {
        builder.setPaymasterOptions(paymasterOptions);
      }
      
      // Send the UserOperation
      const result = await client.sendUserOperation(builder);
      
      // Return the transaction result
      return result;
    } catch (err) {
      console.error('Error sending UserOperation:', err);
      throw err;
    }
  }, [client, builder]);

  /**
   * Create and send a batch of UserOperations
   */
  const sendBatchUserOp = useCallback(async (callDatas, targets, values = [], paymasterOptions = null) => {
    if (!client || !builder) {
      throw new Error('AA SDK not initialized');
    }
    
    if (callDatas.length !== targets.length) {
      throw new Error('CallDatas and targets length mismatch');
    }
    
    // Ensure values array is populated
    const finalValues = values.length === targets.length 
      ? values 
      : targets.map(() => 0);
    
    try {
      // Reset the builder to avoid stale state
      builder.resetOp();
      
      // Set the batch execution parameters
      builder.executeBatch(targets, callDatas, finalValues);
      
      // Set paymaster options if provided
      if (paymasterOptions) {
        builder.setPaymasterOptions(paymasterOptions);
      }
      
      // Send the UserOperation
      const result = await client.sendUserOperation(builder);
      
      // Return the transaction result
      return result;
    } catch (err) {
      console.error('Error sending batch UserOperation:', err);
      throw err;
    }
  }, [client, builder]);

  return {
    client,
    builder,
    aaWalletAddress,
    isDeployed,
    isLoading,
    error,
    initSDK,
    sendUserOp,
    sendBatchUserOp
  };
};

export default useUserOp;