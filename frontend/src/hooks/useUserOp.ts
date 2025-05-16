import { useState, useCallback, useEffect } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { ethers } from 'ethers';
import userOpSDKInstance from '../services/userOpSDK';
import { AlpacaLottoAbi } from '../constants/abi';
import { LOTTERY_CONTRACT_ADDRESS } from '../constants/config';
import paymasterService from '../services/paymasterService';

interface ExecutePurchaseParams {
  lotteryId: number;
  tokenAddress: string;
  quantity: number;
  paymentType: number;
  paymentToken?: string | null;
}

interface ExecuteBatchPurchaseParams {
  selections: { lotteryId: number; tokenAddress: string; quantity: number }[];
  paymentType: number;
  paymentToken?: string | null;
}

const useUserOp = () => {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [aaWalletAddress, setAaWalletAddress] = useState<string | null>(null);
  const [isAaWalletDeployed, setIsAaWalletDeployed] = useState(false);

  const initSDK = useCallback(async () => {
    if (!isConnected || !walletClient || !address) {
      setError('Wallet not connected or client not available.');
      return false;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await userOpSDKInstance.init(walletClient, address);
      if (result.success && result.aaWalletAddress) {
        setAaWalletAddress(result.aaWalletAddress);
        const deployed = await userOpSDKInstance.isWalletDeployed(result.aaWalletAddress);
        setIsAaWalletDeployed(deployed);
        setIsLoading(false);
        return true;
      } else {
        throw new Error(result.error || 'SDK initialization failed');
      }
    } catch (e: any) {
      setError(e.message);
      setIsLoading(false);
      return false;
    }
  }, [isConnected, walletClient, address]);

  useEffect(() => {
    if (isConnected && walletClient && address && !userOpSDKInstance.initialized && !userOpSDKInstance.isInitializing) {
      initSDK();
    }
  }, [isConnected, walletClient, address, initSDK]);

  const deployAAWallet = useCallback(async () => {
    if (!userOpSDKInstance.initialized || !userOpSDKInstance.aaWalletAddress) {
      const initialized = await initSDK();
      if (!initialized || !userOpSDKInstance.aaWalletAddress) {
        setError('SDK could not be initialized or AA address not found for deployment.');
        return false;
      }
    }
    if (isAaWalletDeployed) {
      console.log('AA Wallet already deployed.');
      return true;
    }

    setIsLoading(true);
    setError(null);
    try {
      const emptyCallData = '0x';
      const userOperation = await userOpSDKInstance.buildUserOperationWithGasEstimation(
        emptyCallData,
        ethers.constants.AddressZero,
        0,
        0
      );
      const result = await userOpSDKInstance.sendUserOperation(userOperation);

      if (result.success) {
        setIsAaWalletDeployed(true);
        setTxHash(result.transactionHash);
        setIsLoading(false);
        return true;
      } else {
        throw new Error('AA Wallet deployment failed');
      }
    } catch (e: any) {
      setError(e.message);
      setIsLoading(false);
      return false;
    }
  }, [isAaWalletDeployed, initSDK]);

  const executeTransaction = useCallback(async (callData: string, contractAddress: string, paymentType: number, paymentTokenAddress?: string | null) => {
    if (!userOpSDKInstance.initialized || !userOpSDKInstance.aaWalletAddress) {
      const initialized = await initSDK();
      if(!initialized || !userOpSDKInstance.aaWalletAddress) {
          throw new Error('SDK could not be initialized or AA address not found.');
      }
    }

    if (!isAaWalletDeployed) {
      const deployed = await deployAAWallet();
      if (!deployed) {
        throw new Error('AA Wallet deployment is required before sending transactions.');
      }
    }
    
    if ((paymentType === 1 || paymentType === 2) && paymentTokenAddress) {
        if (!walletClient) throw new Error("Wallet client is needed for token approval.");
        await paymasterService.ensureTokenApproval(walletClient, paymentTokenAddress, userOpSDKInstance.aaWalletAddress);
    }


    setIsLoading(true);
    setError(null);
    try {
      const userOperation = await userOpSDKInstance.buildUserOperationWithGasEstimation(
        callData,
        contractAddress,
        0,
        paymentType,
        paymentTokenAddress
      );
      const result = await userOpSDKInstance.sendUserOperation(userOperation);
      setTxHash(result.transactionHash);
      setIsLoading(false);
      return result.transactionHash;
    } catch (e: any) {
      setError(e.message);
      setIsLoading(false);
      throw e;
    }
  }, [isAaWalletDeployed, deployAAWallet, initSDK, walletClient]);

  const executeTicketPurchase = useCallback(async (params: ExecutePurchaseParams) => {
    const contractInterface = new ethers.utils.Interface(AlpacaLottoAbi);
    const callData = contractInterface.encodeFunctionData('purchaseTickets', [
      params.lotteryId,
      params.tokenAddress,
      params.quantity,
    ]);
    return executeTransaction(callData, LOTTERY_CONTRACT_ADDRESS, params.paymentType, params.paymentToken);
  }, [executeTransaction]);

  const executeBatchPurchase = useCallback(async (params: ExecuteBatchPurchaseParams) => {
    const contractInterface = new ethers.utils.Interface(AlpacaLottoAbi);
    const callData = contractInterface.encodeFunctionData('batchPurchaseTickets', [
      params.selections.map(s => s.lotteryId),
      params.selections.map(s => s.tokenAddress),
      params.selections.map(s => s.quantity),
    ]);
    return executeTransaction(callData, LOTTERY_CONTRACT_ADDRESS, params.paymentType, params.paymentToken);
  }, [executeTransaction]);


  const checkTokenApproval = useCallback(async (tokenAddress: string, ownerAddress?: string) => {
      const effectiveOwnerAddress = ownerAddress || aaWalletAddress;
      if (!effectiveOwnerAddress) {
          return false;
      }
      return paymasterService.isTokenApproved(tokenAddress, effectiveOwnerAddress);
  }, [aaWalletAddress]);

  return {
    aaWalletAddress,
    isAaWalletDeployed,
    isLoading,
    error,
    txHash,
    initSDK,
    deployAAWallet,
    executeTicketPurchase,
    executeBatchPurchase,
    checkTokenApproval,
  };
};

export default useUserOp;