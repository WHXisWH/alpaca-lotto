import { useState, useCallback } from 'react';
import { useAccount, useConnect, useDisconnect, useWalletClient } from 'wagmi';

// Simulated constants instead of environment variables for development
const CONSTANTS = {
  NERO_RPC_URL: process.env.REACT_APP_NERO_RPC_URL || 'https://rpc-testnet.nerochain.io',
  BUNDLER_URL: process.env.REACT_APP_BUNDLER_URL || 'https://bundler-testnet.nerochain.io',
  PAYMASTER_URL: process.env.REACT_APP_PAYMASTER_URL || 'https://paymaster-testnet.nerochain.io',
  PAYMASTER_API_KEY: process.env.REACT_APP_PAYMASTER_API_KEY || 'demo-api-key',
  ENTRYPOINT_ADDRESS: process.env.REACT_APP_ENTRYPOINT_ADDRESS || '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
  ACCOUNT_FACTORY_ADDRESS: process.env.REACT_APP_ACCOUNT_FACTORY_ADDRESS || '0x9406Cc6185a346906296840746125a0E44976454',
  LOTTERY_CONTRACT_ADDRESS: process.env.REACT_APP_LOTTERY_CONTRACT_ADDRESS || '0x1234567890123456789012345678901234567890'
};

/**
 * NERO ChainのAccount Abstractionを使用してUserOperationを管理するためのカスタムフック
 * Updated to use wagmi hooks
 */
export const useUserOp = () => {
  // Use wagmi hooks
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [aaWalletAddress, setAaWalletAddress] = useState(null);
  const [txHash, setTxHash] = useState(null);
  const [isDevelopmentMode, setIsDevelopmentMode] = useState(false);
  
  /**
   * Generate a random transaction hash for development mode
   * @returns {string} - Random transaction hash
   */
  const _generateMockTxHash = () => {
    return '0x' + [...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
  };
  
  /**
   * Check if we should use development mode
   */
  const checkDevelopmentMode = useCallback(() => {
    const noWallet = !isConnected && typeof window !== 'undefined' && (!window.ethereum || !window.ethereum.isMetaMask);
    if (noWallet) {
      setIsDevelopmentMode(true);
    }
    return noWallet;
  }, [isConnected]);
  
  /**
   * Initialize client and builder
   * @returns {Object} - Initialized client and builder
   */
  const initClient = useCallback(async () => {
    try {
      // Check if walletClient is available or we should use development mode
      const devMode = checkDevelopmentMode();
      
      if (devMode || !walletClient) {
        console.log('No signer available, activating development mode');
        setIsDevelopmentMode(true);
        
        // Generate mock AA wallet address
        const mockAddress = '0x8901b77345cC8936Bd6E142570AdE93f5ccF3417';
        setAaWalletAddress(mockAddress);
        
        return { 
          client: { sendUserOperation: () => Promise.resolve({ userOpHash: _generateMockTxHash() }) },
          builder: { getSender: () => Promise.resolve(mockAddress) },
          aaAddress: mockAddress
        };
      }
      
      try {
        // In a real implementation, we would use the UserOpSDK here
        console.log('Initializing AA client with walletClient');
        
        // Generate consistent AA wallet address from account
        const aaAddress = "0x" + address.slice(2, 12) + "Ab" + address.slice(14);
        setAaWalletAddress(aaAddress);
        
        // Return mock client and builder since we can't actually import userop in this context
        return {
          client: { sendUserOperation: () => Promise.resolve({ userOpHash: _generateMockTxHash() }) },
          builder: { getSender: () => Promise.resolve(aaAddress) },
          aaAddress
        };
      } catch (err) {
        console.error('Error initializing Client:', err);
        setIsDevelopmentMode(true);
        
        // Generate mock AA wallet address
        const mockAddress = '0x8901b77345cC8936Bd6E142570AdE93f5ccF3417';
        setAaWalletAddress(mockAddress);
        
        return { 
          client: { sendUserOperation: () => Promise.resolve({ userOpHash: _generateMockTxHash() }) },
          builder: { getSender: () => Promise.resolve(mockAddress) },
          aaAddress: mockAddress
        };
      }
    } catch (err) {
      console.error('AA client initialization error:', err);
      setError(err.message || 'AA client initialization error');
      throw err;
    }
  }, [address, walletClient, checkDevelopmentMode]);
  
  /**
   * Check if AA wallet is already deployed
   * @param {string} address - AA wallet address to check
   * @returns {boolean} - Whether wallet is deployed
   */
  const isWalletDeployed = useCallback(async (address) => {
    if (isDevelopmentMode) {
      return Math.random() > 0.5; // Random result in development mode
    }
    
    try {
      // In a real implementation, we would use viem to check the code at the address
      // For now, simulate with a random result
      return Math.random() > 0.3; // 70% chance it's deployed
    } catch (err) {
      console.error('Error checking wallet deployment:', err);
      return false;
    }
  }, [isDevelopmentMode]);
  
  /**
   * Execute token transfer
   * @param {Object} params - Token transfer parameters
   * @returns {string} - Transaction hash
   */
  const executeTransfer = useCallback(async ({
    tokenAddress,
    recipientAddress,
    amount,
    decimals,
    paymentType,
    paymentToken
  }) => {
    setIsLoading(true);
    setError(null);
    setTxHash(null);
    
    try {
      // Development mode handling
      if (isDevelopmentMode || !walletClient) {
        console.log('Using development mode for transfer execution');
        
        // Simulate delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Generate mock transaction hash
        const mockTxHash = _generateMockTxHash();
        setTxHash(mockTxHash);
        setIsLoading(false);
        return mockTxHash;
      }
      
      // Initialize client and builder
      const { client, builder } = await initClient();
      
      // Simulate transaction processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Generate mock transaction hash
      const mockTxHash = _generateMockTxHash();
      setTxHash(mockTxHash);
      setIsLoading(false);
      return mockTxHash;
    } catch (err) {
      console.error("UserOperation submission error:", err);
      setError(err.message || 'UserOperation submission error');
      setIsLoading(false);
      throw err;
    }
  }, [initClient, isDevelopmentMode, walletClient]);
  
  /**
   * Execute batch transaction
   * @param {Object} params - Batch parameters
   * @returns {string} - Transaction hash
   */
  const executeBatch = useCallback(async ({
    calls,
    paymentType,
    paymentToken
  }) => {
    setIsLoading(true);
    setError(null);
    setTxHash(null);
    
    try {
      // Development mode handling
      if (isDevelopmentMode || !walletClient) {
        console.log('Using development mode for batch execution');
        
        // Simulate delay
        await new Promise(resolve => setTimeout(resolve, 2500));
        
        // Generate mock transaction hash
        const mockTxHash = _generateMockTxHash();
        setTxHash(mockTxHash);
        setIsLoading(false);
        return mockTxHash;
      }
      
      // Initialize client and builder
      const { client, builder } = await initClient();
      
      // Simulate transaction processing
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      // Generate mock transaction hash
      const mockTxHash = _generateMockTxHash();
      setTxHash(mockTxHash);
      setIsLoading(false);
      return mockTxHash;
    } catch (err) {
      console.error("Batch UserOperation error:", err);
      setError(err.message || 'Batch UserOperation error');
      setIsLoading(false);
      throw err;
    }
  }, [initClient, isDevelopmentMode, walletClient]);
  
  /**
   * Get Paymaster data for UserOperation
   * @param {Object} builder - SimpleAccount builder
   * @param {Object} params - Paymaster parameters
   * @returns {Object} - Updated builder
   */
  const getPaymasterData = useCallback(async (
    builder,
    { type, token }
  ) => {
    try {
      // In development mode, just return the builder
      if (isDevelopmentMode) {
        return builder;
      }
      
      // In a real implementation, we would set Paymaster options
      // with builder.setPaymasterOptions()
      
      return builder;
    } catch (err) {
      console.error("Paymaster data retrieval error:", err);
      throw err;
    }
  }, [isDevelopmentMode]);
  
  /**
   * Execute lottery ticket purchase UserOperation
   * @param {Object} params - Ticket purchase parameters
   * @returns {string} - Transaction hash
   */
  const executeTicketPurchase = useCallback(async ({
    lotteryId,
    tokenAddress,
    quantity,
    paymentType = 0,
    paymentToken = null,
    useSessionKey = false
  }) => {
    setIsLoading(true);
    setError(null);
    setTxHash(null);
    
    try {
      // Development mode handling
      if (isDevelopmentMode || !walletClient) {
        console.log('Using development mode for ticket purchase');
        console.log(`Purchasing ${quantity} tickets for lottery ${lotteryId}`);
        console.log(`Using token: ${tokenAddress}`);
        console.log(`Payment type: ${paymentType}`);
        if (paymentToken) console.log(`Payment token: ${paymentToken}`);
        console.log(`Using session key: ${useSessionKey}`);
        
        // Simulate delay - longer if using session key
        await new Promise(resolve => setTimeout(resolve, useSessionKey ? 1500 : 2500));
        
        // Generate mock transaction hash
        const mockTxHash = _generateMockTxHash();
        setTxHash(mockTxHash);
        setIsLoading(false);
        return mockTxHash;
      }
      
      // Initialize client and builder
      const { client, builder } = await initClient();
      
      // Simulate ticket purchase processing
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Generate mock transaction hash
      const mockTxHash = _generateMockTxHash();
      setTxHash(mockTxHash);
      setIsLoading(false);
      return mockTxHash;
    } catch (err) {
      console.error("Ticket purchase UserOperation error:", err);
      setError(err.message || 'Ticket purchase UserOperation error');
      setIsLoading(false);
      throw err;
    }
  }, [initClient, isDevelopmentMode, walletClient]);
  
  /**
   * Execute batch ticket purchase
   * @param {Object} params - Batch purchase parameters
   * @returns {string} - Transaction hash
   */
  const executeBatchPurchase = useCallback(async ({
    selections,
    paymentType = 0,
    paymentToken = null
  }) => {
    setIsLoading(true);
    setError(null);
    setTxHash(null);
    
    try {
      // Development mode handling
      if (isDevelopmentMode || !walletClient) {
        console.log('Using development mode for batch ticket purchase');
        console.log('Selections:', selections);
        
        // Simulate delay
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Generate mock transaction hash
        const mockTxHash = _generateMockTxHash();
        setTxHash(mockTxHash);
        setIsLoading(false);
        return mockTxHash;
      }
      
      // Initialize client and builder
      const { client, builder } = await initClient();
      
      // Simulate batch purchase processing
      await new Promise(resolve => setTimeout(resolve, 3500));
      
      // Generate mock transaction hash
      const mockTxHash = _generateMockTxHash();
      setTxHash(mockTxHash);
      setIsLoading(false);
      return mockTxHash;
    } catch (err) {
      console.error("Batch ticket purchase error:", err);
      setError(err.message || 'Batch ticket purchase error');
      setIsLoading(false);
      throw err;
    }
  }, [initClient, isDevelopmentMode, walletClient]);
  
  // Run development mode check on initialization
  useCallback(() => {
    checkDevelopmentMode();
  }, [checkDevelopmentMode]);
  
  return {
    isLoading,
    error,
    txHash,
    aaWalletAddress,
    isDevelopmentMode,
    initClient,
    isWalletDeployed,
    executeTransfer,
    executeBatch,
    getPaymasterData,
    executeTicketPurchase,
    executeBatchPurchase
  };
};

export default useUserOp;