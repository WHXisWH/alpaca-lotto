// frontend/src/hooks/useLotteries.js

import { useState, useCallback, useEffect } from 'react';
import { useAccount, useNetwork, useWalletClient } from 'wagmi'; // Using wagmi hooks
import { api } from '../services/api';
import useWagmiWallet from './useWagmiWallet';

/**
 * Custom hook for lottery functionality and data management
 * Updated to use wagmi
 */
export const useLotteries = () => {
  // Using wagmi hooks
  const { address, isConnected } = useAccount();
  const { chain } = useNetwork();
  const { data: walletClient } = useWalletClient();
  
  // Using our custom wagmi wallet hook
  const { isDevelopmentMode } = useWagmiWallet();
  
  // State
  const [lotteries, setLotteries] = useState([]);
  const [activeLotteries, setActiveLotteries] = useState([]);
  const [pastLotteries, setPastLotteries] = useState([]);
  const [userTickets, setUserTickets] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  /**
   * Fetch all lotteries
   */
  const fetchLotteries = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await api.getLotteries();
      
      if (response.success && response.lotteries) {
        setLotteries(response.lotteries);
        
        // Get current time
        const currentTime = Math.floor(Date.now() / 1000);
        
        // Categorize active and past lotteries
        const active = response.lotteries.filter(lottery => 
          lottery.endTime > currentTime
        );
        const past = response.lotteries.filter(lottery => 
          lottery.endTime <= currentTime
        );
        
        setActiveLotteries(active);
        setPastLotteries(past);
        
        setIsLoading(false);
        return response.lotteries;
      }
      
      setIsLoading(false);
      return [];
    } catch (err) {
      console.error('Error fetching lotteries:', err);
      setError(err.message || 'Error fetching lotteries');
      setIsLoading(false);
      return [];
    }
  }, []);
  
  /**
   * Fetch only active lotteries
   */
  const fetchActiveLotteries = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await api.getActiveLotteries();
      
      if (response.success && response.lotteries) {
        setActiveLotteries(response.lotteries);
        setIsLoading(false);
        return response.lotteries;
      }
      
      setIsLoading(false);
      return [];
    } catch (err) {
      console.error('Error fetching active lotteries:', err);
      setError(err.message || 'Error fetching active lotteries');
      setIsLoading(false);
      return [];
    }
  }, []);
  
  /**
   * Fetch details of a specific lottery
   * @param {number} lotteryId - Lottery ID
   */
  const fetchLotteryDetails = useCallback(async (lotteryId) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await api.getLotteryDetails(lotteryId);
      
      if (response.success && response.lottery) {
        // Update existing lottery list
        setLotteries(prevLotteries => {
          const updatedLotteries = [...prevLotteries];
          const index = updatedLotteries.findIndex(l => l.id === lotteryId);
          
          if (index !== -1) {
            updatedLotteries[index] = response.lottery;
          } else {
            updatedLotteries.push(response.lottery);
          }
          
          return updatedLotteries;
        });
        
        setIsLoading(false);
        return response.lottery;
      }
      
      setIsLoading(false);
      return null;
    } catch (err) {
      console.error(`Error fetching lottery details (ID: ${lotteryId}):`, err);
      setError(err.message || 'Error fetching lottery details');
      setIsLoading(false);
      return null;
    }
  }, []);
  
  /**
   * Fetch user tickets
   * @param {number} lotteryId - Lottery ID
   */
  const fetchUserTickets = useCallback(async (lotteryId) => {
    if (!address && !isDevelopmentMode) {
      return [];
    }
    
    setIsLoading(true);
    
    try {
      const userAddr = address || (isDevelopmentMode ? '0x1234567890123456789012345678901234567890' : null);
      const response = await api.getUserTickets(lotteryId, userAddr);
      
      if (response.success && response.tickets) {
        // Update ticket data
        setUserTickets(prev => ({
          ...prev,
          [lotteryId]: response.tickets
        }));
        
        setIsLoading(false);
        return response.tickets;
      }
      
      setIsLoading(false);
      return [];
    } catch (err) {
      console.error(`Error fetching user tickets (Lottery: ${lotteryId}, User: ${address}):`, err);
      setIsLoading(false);
      return [];
    }
  }, [address, isDevelopmentMode]);
  
  /**
   * Fetch user tickets for all lotteries
   */
  const fetchAllUserTickets = useCallback(async () => {
    if (!address && !isDevelopmentMode) {
      return;
    }
    
    if (lotteries.length === 0) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      const userAddr = address || (isDevelopmentMode ? '0x1234567890123456789012345678901234567890' : null);
      const promises = lotteries.map(lottery => 
        api.getUserTickets(lottery.id, userAddr)
      );
      
      const results = await Promise.all(promises);
      
      const ticketsByLottery = {};
      results.forEach((response, index) => {
        if (response.success && response.tickets) {
          ticketsByLottery[lotteries[index].id] = response.tickets;
        }
      });
      
      setUserTickets(ticketsByLottery);
      setIsLoading(false);
    } catch (err) {
      console.error('Error fetching all user tickets:', err);
      setIsLoading(false);
    }
  }, [address, lotteries, isDevelopmentMode]);
  
  /**
   * Check if user is a winner for a lottery
   * @param {number} lotteryId - Lottery ID
   */
  const checkIfWinner = useCallback(async (lotteryId) => {
    if (!address && !isDevelopmentMode) {
      return false;
    }
    
    try {
      const userAddr = address || (isDevelopmentMode ? '0x1234567890123456789012345678901234567890' : null);
      const response = await api.checkIfWinner(lotteryId, userAddr);
      
      if (response.success) {
        return response.isWinner;
      }
      
      return false;
    } catch (err) {
      console.error(`Error checking winner status (Lottery: ${lotteryId}, User: ${address}):`, err);
      return false;
    }
  }, [address, isDevelopmentMode]);
  
  /**
   * Purchase lottery tickets
   * @param {number} lotteryId - Lottery ID
   * @param {string} tokenAddress - Payment token address
   * @param {number} quantity - Number of tickets
   */
  const purchaseTickets = useCallback(async (lotteryId, tokenAddress, quantity) => {
    if (!isConnected && !isDevelopmentMode) {
      throw new Error('Wallet is not connected');
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Generate a signature if we have a wallet client
      let signature = null;
      if (walletClient) {
        const message = `Purchase ${quantity} tickets for lottery #${lotteryId} using token ${tokenAddress}`;
        // In a real implementation, we would sign the message
        // signature = await walletClient.signMessage({ message });
      }
      
      const response = await api.purchaseTickets(lotteryId, tokenAddress, quantity, signature);
      
      if (response.success) {
        // Refetch tickets after purchase
        await fetchUserTickets(lotteryId);
        
        setIsLoading(false);
        return response;
      }
      
      throw new Error(response.error || 'Failed to purchase tickets');
    } catch (err) {
      console.error(`Error purchasing tickets (Lottery: ${lotteryId}):`, err);
      setError(err.message || 'Error purchasing tickets');
      setIsLoading(false);
      throw err;
    }
  }, [isConnected, walletClient, fetchUserTickets, isDevelopmentMode]);
  
  /**
   * Batch purchase tickets for multiple lotteries
   * @param {Array} selections - Array of purchase selections [{lotteryId, tokenAddress, quantity}]
   */
  const batchPurchaseTickets = useCallback(async (selections) => {
    if (!isConnected && !isDevelopmentMode) {
      throw new Error('Wallet is not connected');
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Generate a signature if we have a wallet client
      let signature = null;
      if (walletClient) {
        const message = `Batch purchase tickets for ${selections.length} lotteries`;
        // In a real implementation, we would sign the message
        // signature = await walletClient.signMessage({ message });
      }
      
      const response = await api.batchPurchaseTickets(selections, signature);
      
      if (response.success) {
        // Refetch all tickets after purchase
        const lotteryIds = [...new Set(selections.map(s => s.lotteryId))];
        await Promise.all(lotteryIds.map(id => fetchUserTickets(id)));
        
        setIsLoading(false);
        return response;
      }
      
      throw new Error(response.error || 'Failed to batch purchase tickets');
    } catch (err) {
      console.error('Error batch purchasing tickets:', err);
      setError(err.message || 'Error batch purchasing tickets');
      setIsLoading(false);
      throw err;
    }
  }, [isConnected, walletClient, fetchUserTickets, isDevelopmentMode]);
  
  /**
   * Claim prize
   * @param {number} lotteryId - Lottery ID
   */
  const claimPrize = useCallback(async (lotteryId) => {
    if (!isConnected && !isDevelopmentMode) {
      throw new Error('Wallet is not connected');
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Generate a signature if we have a wallet client
      let signature = null;
      if (walletClient) {
        const message = `Claim prize for lottery #${lotteryId}`;
        // In a real implementation, we would sign the message
        // signature = await walletClient.signMessage({ message });
      }
      
      const response = await api.claimPrize(lotteryId, signature);
      
      if (response.success) {
        setIsLoading(false);
        return response;
      }
      
      throw new Error(response.error || 'Failed to claim prize');
    } catch (err) {
      console.error(`Error claiming prize (Lottery: ${lotteryId}):`, err);
      setError(err.message || 'Error claiming prize');
      setIsLoading(false);
      throw err;
    }
  }, [isConnected, walletClient, isDevelopmentMode]);
  
  // Fetch lotteries on initial load or account change
  useEffect(() => {
    fetchLotteries();
  }, [fetchLotteries]);
  
  // Refetch user tickets when account changes
  useEffect(() => {
    if ((address || isDevelopmentMode) && lotteries.length > 0) {
      fetchAllUserTickets();
    }
  }, [address, lotteries.length, fetchAllUserTickets, isDevelopmentMode]);
  
  // Refetch lotteries when chain changes
  useEffect(() => {
    if (chain) {
      fetchLotteries();
    }
  }, [chain, fetchLotteries]);
  
  return {
    lotteries,
    activeLotteries,
    pastLotteries,
    userTickets,
    isLoading,
    error,
    fetchLotteries,
    fetchActiveLotteries,
    fetchLotteryDetails,
    fetchUserTickets,
    fetchAllUserTickets,
    checkIfWinner,
    purchaseTickets,
    batchPurchaseTickets,
    claimPrize
  };
};

export default useLotteries;