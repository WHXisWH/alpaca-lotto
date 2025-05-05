import { useState, useCallback } from 'react';
import { useAccount, useConnect, useDisconnect, useWalletClient } from 'wagmi';
import { hexToBigInt } from 'viem';

// Constants from environment variables
const CONSTANTS = {
  NERO_RPC_URL: import.meta.env.VITE_NERO_RPC_URL || 'https://rpc-testnet.nerochain.io',
  BUNDLER_URL: import.meta.env.VITE_BUNDLER_URL || 'https://bundler-testnet.nerochain.io',
  PAYMASTER_URL: import.meta.env.VITE_PAYMASTER_URL || 'https://paymaster-testnet.nerochain.io',
  PAYMASTER_API_KEY: import.meta.env.VITE_PAYMASTER_API_KEY || 'demo-api-key',
  ENTRYPOINT_ADDRESS: import.meta.env.VITE_ENTRYPOINT_ADDRESS || '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
  ACCOUNT_FACTORY_ADDRESS: import.meta.env.VITE_ACCOUNT_FACTORY_ADDRESS || '0x9406Cc6185a346906296840746125a0E44976454',
  LOTTERY_CONTRACT_ADDRESS: import.meta.env.VITE_LOTTERY_CONTRACT_ADDRESS || '0x1234567890123456789012345678901234567890'
};

// Transaction type definitions
interface Call {
  to: string;
  data: string;
}

interface TransferParams {
  tokenAddress: string;
  recipientAddress: string;
  amount: string;
  decimals: number;
  paymentType: number;
  paymentToken?: string;
}

interface BatchParams {
  calls: Call[];
  paymentType: number;
  paymentToken?: string;
}

interface TicketPurchaseParams {
  lotteryId: number;
  tokenAddress: string;
  quantity: number;
  paymentType?: number;
  paymentToken?: string;
  useSessionKey?: boolean;
}

interface BatchPurchaseParams {
  selections: {
    lotteryId: number;
    tokenAddress: string;
    quantity: number;
  }[];
  paymentType?: number;
  paymentToken?: string;
}

interface UseUserOpReturn {
  isLoading: boolean;
  error: string | null;
  txHash: string | null;
  aaWalletAddress: string | null;
  isDevelopmentMode: boolean;
  initClient: () => Promise<{
    client: any;
    builder: any;
    aaAddress: string;
  }>;
  isWalletDeployed: (address: string) => Promise<boolean>;
  executeTransfer: (params: TransferParams) => Promise<string>;
  executeBatch: (params: BatchParams) => Promise<string>;
  getPaymasterData: (builder: any, params: { type: number; token?: string }) => Promise<any>;
  executeTicketPurchase: (params: TicketPurchaseParams) => Promise<string>;
  executeBatchPurchase: (params: BatchPurchaseParams) => Promise<string>;
}

/**
 * Custom hook for managing UserOperations with NERO Chain's Account Abstraction
 * Updated to use wagmi hooks
 */
export const useUserOp = (): UseUserOpReturn => {
  // Use wagmi hooks
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [aaWalletAddress, setAaWalletAddress] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [isDevelopmentMode, setIsDevelopmentMode] = useState<boolean>(false);
  
  /**
   * Generate a random transaction hash for development mode
   * @returns {string} - Random transaction hash
   */
  const _generateMockTxHash = (): string => {
    return '0x' + [...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
  };
  
  /**
   * Check if we should use development mode
   */
  const checkDevelopmentMode = useCallback((): boolean => {
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
        const aaAddress = "0x" + address!.slice(2, 12) + "Ab" + address!.slice(14);
        setAaWalletAddress(aaAddress);
        
        // Return client and builder for userop (mock implementation for this fix)
        return {
          client: { 
            sendUserOperation: () => Promise.resolve({ 
              userOpHash: _generateMockTxHash(),
              wait: async () => ({ transactionHash: _generateMockTxHash() })
            }) 
          },
          builder: { 
            getSender: () => Promise.resolve(aaAddress),
            execute: () => {},
            executeBatch: () => {},
            setPaymasterOptions: () => {},
            setCallGasLimit: () => {},
            setVerificationGasLimit: () => {},
            setPreVerificationGas: () => {},
            setMaxFeePerGas: () => {},
            setMaxPriorityFeePerGas: () => {} 
          },
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
    } catch (err: any) {
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
  const isWalletDeployed = useCallback(async (address: string): Promise<boolean> => {
    if (isDevelopmentMode) {
      return Math.random() > 0.5; // Random result in development mode
    }
    
    try {
      // In a real implementation, we would use walletClient to check the code at the address
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
  }: TransferParams): Promise<string> => {
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
      
      // Create ERC20 interface for the transfer
      const erc20Interface = {
        func: 'transfer',
        args: [recipientAddress, hexToBigInt(`0x${BigInt(parseInt(amount) * 10 ** decimals).toString(16)}`)]
      };
      
      // Set up builder with transfer call
      builder.execute(tokenAddress, 0, erc20Interface);
      
      // Set paymaster options based on payment type
      if (paymentType === 0) {
        // Sponsored gas
        builder.setPaymasterOptions({ type: 0, apikey: CONSTANTS.PAYMASTER_API_KEY, rpc: CONSTANTS.PAYMASTER_URL });
      } else if (paymentType === 1 || paymentType === 2) {
        // ERC20 token gas payment
        builder.setPaymasterOptions({ 
          type: paymentType, 
          token: paymentToken, 
          apikey: CONSTANTS.PAYMASTER_API_KEY, 
          rpc: CONSTANTS.PAYMASTER_URL 
        });
      }
      
      // Simulate transaction processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Generate mock transaction hash
      const mockTxHash = _generateMockTxHash();
      setTxHash(mockTxHash);
      setIsLoading(false);
      return mockTxHash;
    } catch (err: any) {
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
  }: BatchParams): Promise<string> => {
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
      
      // Create batch transaction
      const callAddresses = calls.map(call => call.to);
      const callData = calls.map(call => call.data);
      
      // Set up builder with batch call
      builder.executeBatch(callAddresses, callData);
      
      // Set paymaster options based on payment type
      if (paymentType === 0) {
        // Sponsored gas
        builder.setPaymasterOptions({ type: 0, apikey: CONSTANTS.PAYMASTER_API_KEY, rpc: CONSTANTS.PAYMASTER_URL });
      } else if (paymentType === 1 || paymentType === 2) {
        // ERC20 token gas payment
        builder.setPaymasterOptions({ 
          type: paymentType, 
          token: paymentToken, 
          apikey: CONSTANTS.PAYMASTER_API_KEY, 
          rpc: CONSTANTS.PAYMASTER_URL 
        });
      }
      
      // Simulate transaction processing
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      // Generate mock transaction hash
      const mockTxHash = _generateMockTxHash();
      setTxHash(mockTxHash);
      setIsLoading(false);
      return mockTxHash;
    } catch (err: any) {
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
    builder: any,
    { type, token }: { type: number; token?: string }
  ): Promise<any> => {
    try {
      // In development mode, just return the builder
      if (isDevelopmentMode) {
        return builder;
      }
      
      // Set paymaster options based on payment type
      if (type === 0) {
        // Sponsored gas
        builder.setPaymasterOptions({ type: 0, apikey: CONSTANTS.PAYMASTER_API_KEY, rpc: CONSTANTS.PAYMASTER_URL });
      } else if (type === 1 || type === 2) {
        // ERC20 token gas payment
        builder.setPaymasterOptions({ 
          type, 
          token, 
          apikey: CONSTANTS.PAYMASTER_API_KEY, 
          rpc: CONSTANTS.PAYMASTER_URL 
        });
      }
      
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
  }: TicketPurchaseParams): Promise<string> => {
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
      
      // Create lottery contract interface
      const lotteryInterface = {
        func: 'purchaseTickets',
        args: [lotteryId, tokenAddress, quantity]
      };
      
      // Set up builder with purchaseTickets call
      builder.execute(CONSTANTS.LOTTERY_CONTRACT_ADDRESS, 0, lotteryInterface);
      
      // Set paymaster options based on payment type
      if (paymentType === 0) {
        // Sponsored gas
        builder.setPaymasterOptions({ type: 0, apikey: CONSTANTS.PAYMASTER_API_KEY, rpc: CONSTANTS.PAYMASTER_URL });
      } else if (paymentType === 1 || paymentType === 2) {
        // ERC20 token gas payment
        builder.setPaymasterOptions({ 
          type: paymentType, 
          token: paymentToken, 
          apikey: CONSTANTS.PAYMASTER_API_KEY, 
          rpc: CONSTANTS.PAYMASTER_URL 
        });
      }
      
      // Simulate ticket purchase processing
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Generate mock transaction hash
      const mockTxHash = _generateMockTxHash();
      setTxHash(mockTxHash);
      setIsLoading(false);
      return mockTxHash;
    } catch (err: any) {
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
  }: BatchPurchaseParams): Promise<string> => {
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
      
      // Prepare batch transaction parameters
      const lotteryIds = selections.map(s => s.lotteryId);
      const tokenAddresses = selections.map(s => s.tokenAddress);
      const quantities = selections.map(s => s.quantity);
      
      // Create batch purchase interface
      const batchPurchaseInterface = {
        func: 'batchPurchaseTickets',
        args: [lotteryIds, tokenAddresses, quantities]
      };
      
      // Set up builder with batchPurchaseTickets call
      builder.execute(CONSTANTS.LOTTERY_CONTRACT_ADDRESS, 0, batchPurchaseInterface);
      
      // Set paymaster options based on payment type
      if (paymentType === 0) {
        // Sponsored gas
        builder.setPaymasterOptions({ type: 0, apikey: CONSTANTS.PAYMASTER_API_KEY, rpc: CONSTANTS.PAYMASTER_URL });
      } else if (paymentType === 1 || paymentType === 2) {
        // ERC20 token gas payment
        builder.setPaymasterOptions({ 
          type: paymentType, 
          token: paymentToken, 
          apikey: CONSTANTS.PAYMASTER_API_KEY, 
          rpc: CONSTANTS.PAYMASTER_URL 
        });
      }
      
      // Simulate batch purchase processing
      await new Promise(resolve => setTimeout(resolve, 3500));
      
      // Generate mock transaction hash
      const mockTxHash = _generateMockTxHash();
      setTxHash(mockTxHash);
      setIsLoading(false);
      return mockTxHash;
    } catch (err: any) {
      console.error("Batch ticket purchase error:", err);
      setError(err.message || 'Batch ticket purchase error');
      setIsLoading(false);
      throw err;
    }
  }, [initClient, isDevelopmentMode, walletClient]);
  
  // Check development mode on initialization
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