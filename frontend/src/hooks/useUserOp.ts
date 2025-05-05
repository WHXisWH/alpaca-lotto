import { useState, useCallback, useEffect } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import userOpSDK from '../services/userOpSDK';
import useWagmiWallet from './useWagmiWallet';

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

interface SessionKeyParams {
  duration: number;
  paymentType?: number;
  paymentToken?: string;
}

interface UseUserOpReturn {
  isLoading: boolean;
  error: string | null;
  txHash: string | null;
  aaWalletAddress: string | null;
  isDevelopmentMode: boolean;
  initSDK: () => Promise<{ client: any; builder: any; aaAddress: string }>;
  isWalletDeployed: (address: string) => Promise<boolean>;
  executeTransfer: (params: TransferParams) => Promise<string>;
  executeBatch: (params: BatchParams) => Promise<string>;
  executeTicketPurchase: (params: TicketPurchaseParams) => Promise<string>;
  executeBatchPurchase: (params: BatchPurchaseParams) => Promise<string>;
  createSessionKey: (params: SessionKeyParams) => Promise<string>;
  revokeSessionKey: (sessionKey: string) => Promise<string>;
  claimPrize: (lotteryId: number) => Promise<string>;
  getSupportedTokens: () => Promise<any[]>;
}

/**
 * Custom hook for managing UserOperations with NERO Chain's Account Abstraction
 * Using the UserOpSDK service
 */
export const useUserOp = (): UseUserOpReturn => {
  // Use wagmi hooks
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { isDevelopmentMode } = useWagmiWallet();
  
  // State
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [aaWalletAddress, setAaWalletAddress] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  
  // Initialize SDK
  const initSDK = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Check if development mode
      if (isDevelopmentMode || !walletClient) {
        console.log('Using development mode for UserOp SDK');
        
        // Mock wallet
        const mockWallet = {
          getAddress: async () => address || '0x1234567890123456789012345678901234567890',
          signMessage: async (message: string) => '0x123456'
        };
        
        // Initialize with mock signer
        const { client, builder, aaWalletAddress: aaAddress } = await userOpSDK.init(mockWallet);
        
        setAaWalletAddress(aaAddress);
        setIsLoading(false);
        
        return { client, builder, aaAddress };
      }

      // Initialize with real wallet client
      const signer = {
        getAddress: async () => address!,
        signMessage: async (message: { message: string }) => {
          return await walletClient.signMessage({
            message: message.message
          });
        }
      };
      
      const { client, builder, aaWalletAddress: aaAddress } = await userOpSDK.init(signer);
      
      setAaWalletAddress(aaAddress);
      setIsLoading(false);
      
      return { client, builder, aaAddress };
    } catch (err: any) {
      console.error('Error initializing UserOp SDK:', err);
      setError(err.message || 'Failed to initialize UserOp SDK');
      setIsLoading(false);
      throw err;
    }
  }, [address, walletClient, isDevelopmentMode]);
  
  // Check if AA wallet is deployed
  const isWalletDeployed = useCallback(async (address: string): Promise<boolean> => {
    try {
      return await userOpSDK.isWalletDeployed(address);
    } catch (err) {
      console.error('Error checking wallet deployment:', err);
      return false;
    }
  }, []);
  
  // Execute token transfer
  const executeTransfer = useCallback(async (params: TransferParams): Promise<string> => {
    setIsLoading(true);
    setError(null);
    setTxHash(null);
    
    try {
      // Initialize SDK if not already
      if (!userOpSDK.initialized) {
        await initSDK();
      }
      
      // Create ERC20 transfer UserOperation
      userOpSDK.createERC20Transfer(
        params.tokenAddress,
        params.recipientAddress,
        params.amount,
        params.decimals
      );
      
      // Set paymaster options
      userOpSDK.setPaymasterOptions(
        params.paymentType,
        params.paymentToken
      );
      
      // Estimate and set gas parameters
      const gasEstimation = await userOpSDK.estimateGas();
      userOpSDK.setGasParameters(gasEstimation);
      
      // Send UserOperation
      const result = await userOpSDK.sendUserOperation();
      
      if (result.success) {
        setTxHash(result.transactionHash);
        setIsLoading(false);
        return result.transactionHash;
      } else {
        throw new Error('Failed to send UserOperation');
      }
    } catch (err: any) {
      console.error('Error executing transfer:', err);
      setError(err.message || 'Failed to execute transfer');
      setIsLoading(false);
      throw err;
    }
  }, [initSDK]);
  
  // Execute batch operations
  const executeBatch = useCallback(async (params: BatchParams): Promise<string> => {
    setIsLoading(true);
    setError(null);
    setTxHash(null);
    
    try {
      // Initialize SDK if not already
      if (!userOpSDK.initialized) {
        await initSDK();
      }
      
      // Create batch UserOperation
      userOpSDK.createBatchOperation(params.calls);
      
      // Set paymaster options
      userOpSDK.setPaymasterOptions(
        params.paymentType,
        params.paymentToken
      );
      
      // Estimate and set gas parameters
      const gasEstimation = await userOpSDK.estimateGas();
      userOpSDK.setGasParameters(gasEstimation);
      
      // Send UserOperation
      const result = await userOpSDK.sendUserOperation();
      
      if (result.success) {
        setTxHash(result.transactionHash);
        setIsLoading(false);
        return result.transactionHash;
      } else {
        throw new Error('Failed to send batch UserOperation');
      }
    } catch (err: any) {
      console.error('Error executing batch operation:', err);
      setError(err.message || 'Failed to execute batch operation');
      setIsLoading(false);
      throw err;
    }
  }, [initSDK]);
  
  // Execute ticket purchase
  const executeTicketPurchase = useCallback(async (params: TicketPurchaseParams): Promise<string> => {
    setIsLoading(true);
    setError(null);
    setTxHash(null);
    
    try {
      // Initialize SDK if not already
      if (!userOpSDK.initialized) {
        await initSDK();
      }
      
      // Create ticket purchase UserOperation
      userOpSDK.createTicketPurchaseOp(
        params.lotteryId,
        params.tokenAddress,
        params.quantity
      );
      
      // Set paymaster options
      userOpSDK.setPaymasterOptions(
        params.paymentType || 0,
        params.paymentToken
      );
      
      // Estimate and set gas parameters
      const gasEstimation = await userOpSDK.estimateGas();
      userOpSDK.setGasParameters(gasEstimation);
      
      // Send UserOperation
      const result = await userOpSDK.sendUserOperation();
      
      if (result.success) {
        setTxHash(result.transactionHash);
        setIsLoading(false);
        return result.transactionHash;
      } else {
        throw new Error('Failed to send ticket purchase UserOperation');
      }
    } catch (err: any) {
      console.error('Error executing ticket purchase:', err);
      setError(err.message || 'Failed to execute ticket purchase');
      setIsLoading(false);
      throw err;
    }
  }, [initSDK]);
  
  // Execute batch ticket purchase
  const executeBatchPurchase = useCallback(async (params: BatchPurchaseParams): Promise<string> => {
    setIsLoading(true);
    setError(null);
    setTxHash(null);
    
    try {
      // Initialize SDK if not already
      if (!userOpSDK.initialized) {
        await initSDK();
      }
      
      // Create batch ticket purchase UserOperation
      userOpSDK.createBatchTicketPurchaseOp(params.selections);
      
      // Set paymaster options
      userOpSDK.setPaymasterOptions(
        params.paymentType || 0,
        params.paymentToken
      );
      
      // Estimate and set gas parameters
      const gasEstimation = await userOpSDK.estimateGas();
      userOpSDK.setGasParameters(gasEstimation);
      
      // Send UserOperation
      const result = await userOpSDK.sendUserOperation();
      
      if (result.success) {
        setTxHash(result.transactionHash);
        setIsLoading(false);
        return result.transactionHash;
      } else {
        throw new Error('Failed to send batch ticket purchase UserOperation');
      }
    } catch (err: any) {
      console.error('Error executing batch ticket purchase:', err);
      setError(err.message || 'Failed to execute batch ticket purchase');
      setIsLoading(false);
      throw err;
    }
  }, [initSDK]);
  
  // Create session key
  const createSessionKey = useCallback(async (params: SessionKeyParams): Promise<string> => {
    setIsLoading(true);
    setError(null);
    setTxHash(null);
    
    try {
      // Initialize SDK if not already
      if (!userOpSDK.initialized) {
        await initSDK();
      }
      
      // Generate new session key
      const sessionKeyAddress = '0x' + [...Array(40)].map(() => 
        Math.floor(Math.random() * 16).toString(16)
      ).join('');
      
      // Create session key UserOperation
      userOpSDK.createSessionKeyOp(sessionKeyAddress, params.duration);
      
      // Set paymaster options
      userOpSDK.setPaymasterOptions(
        params.paymentType || 0,
        params.paymentToken
      );
      
      // Estimate and set gas parameters
      const gasEstimation = await userOpSDK.estimateGas();
      userOpSDK.setGasParameters(gasEstimation);
      
      // Send UserOperation
      const result = await userOpSDK.sendUserOperation();
      
      if (result.success) {
        setTxHash(result.transactionHash);
        setIsLoading(false);
        return sessionKeyAddress;
      } else {
        throw new Error('Failed to create session key');
      }
    } catch (err: any) {
      console.error('Error creating session key:', err);
      setError(err.message || 'Failed to create session key');
      setIsLoading(false);
      throw err;
    }
  }, [initSDK]);
  
  // Revoke session key
  const revokeSessionKey = useCallback(async (sessionKey: string): Promise<string> => {
    setIsLoading(true);
    setError(null);
    setTxHash(null);
    
    try {
      // Initialize SDK if not already
      if (!userOpSDK.initialized) {
        await initSDK();
      }
      
      // Create revoke session key UserOperation
      userOpSDK.createRevokeSessionKeyOp(sessionKey);
      
      // Set paymaster options - Type 0 (sponsored) for better UX
      userOpSDK.setPaymasterOptions(0);
      
      // Estimate and set gas parameters
      const gasEstimation = await userOpSDK.estimateGas();
      userOpSDK.setGasParameters(gasEstimation);
      
      // Send UserOperation
      const result = await userOpSDK.sendUserOperation();
      
      if (result.success) {
        setTxHash(result.transactionHash);
        setIsLoading(false);
        return result.transactionHash;
      } else {
        throw new Error('Failed to revoke session key');
      }
    } catch (err: any) {
      console.error('Error revoking session key:', err);
      setError(err.message || 'Failed to revoke session key');
      setIsLoading(false);
      throw err;
    }
  }, [initSDK]);
  
  // Claim lottery prize
  const claimPrize = useCallback(async (lotteryId: number): Promise<string> => {
    setIsLoading(true);
    setError(null);
    setTxHash(null);
    
    try {
      // Initialize SDK if not already
      if (!userOpSDK.initialized) {
        await initSDK();
      }
      
      // Create claim prize UserOperation
      userOpSDK.createClaimPrizeOp(lotteryId);
      
      // Set paymaster options - Type 0 (sponsored) for better UX
      userOpSDK.setPaymasterOptions(0);
      
      // Estimate and set gas parameters
      const gasEstimation = await userOpSDK.estimateGas();
      userOpSDK.setGasParameters(gasEstimation);
      
      // Send UserOperation
      const result = await userOpSDK.sendUserOperation();
      
      if (result.success) {
        setTxHash(result.transactionHash);
        setIsLoading(false);
        return result.transactionHash;
      } else {
        throw new Error('Failed to claim prize');
      }
    } catch (err: any) {
      console.error('Error claiming prize:', err);
      setError(err.message || 'Failed to claim prize');
      setIsLoading(false);
      throw err;
    }
  }, [initSDK]);
  
  // Get supported tokens from Paymaster
  const getSupportedTokens = useCallback(async (): Promise<any[]> => {
    try {
      // Initialize SDK if not already
      if (!userOpSDK.initialized) {
        await initSDK();
      }
      
      return await userOpSDK.getSupportedTokens();
    } catch (err: any) {
      console.error('Error getting supported tokens:', err);
      setError(err.message || 'Failed to get supported tokens');
      return [];
    }
  }, [initSDK]);
  
  // Initialize SDK on mount if wallet is connected
  useEffect(() => {
    if (isConnected && !userOpSDK.initialized) {
      initSDK().catch(console.error);
    }
  }, [isConnected, initSDK]);
  
  return {
    isLoading,
    error,
    txHash,
    aaWalletAddress,
    isDevelopmentMode,
    initSDK,
    isWalletDeployed,
    executeTransfer,
    executeBatch,
    executeTicketPurchase,
    executeBatchPurchase,
    createSessionKey,
    revokeSessionKey,
    claimPrize,
    getSupportedTokens
  };
};

export default useUserOp;