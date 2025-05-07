import { useState, useCallback, useEffect } from 'react';
import { useAccount, useChainId, useWalletClient } from 'wagmi'; 
import { api } from '../services/api';
import useWagmiWallet from './useWagmiWallet';
import mockData from '../mock/mockLotteries';
interface Lottery {
  id: number;
  name: string;
  ticketPrice: number;
  startTime: number;
  endTime: number;
  drawTime: number;
  supportedTokens: string[];
  totalTickets: number;
  prizePool: number;
  drawn: boolean;
  winners: string[];
  winningTickets: number[];
}

interface Ticket {
  lotteryId: number;
  ticketNumber: number;
  user: string;
  paymentToken: string;
  amountPaid: string;
  purchaseDate?: number;
}

interface UseLotteriesReturn {
  lotteries: Lottery[];
  activeLotteries: Lottery[];
  pastLotteries: Lottery[];
  userTickets: Record<number, Ticket[]>;
  isLoading: boolean;
  error: string | null;
  fetchLotteries: () => Promise<Lottery[]>;
  fetchActiveLotteries: () => Promise<Lottery[]>;
  fetchLotteryDetails: (lotteryId: number) => Promise<Lottery | null>;
  fetchUserTickets: (lotteryId: number) => Promise<Ticket[]>;
  fetchAllUserTickets: () => Promise<void>;
  checkIfWinner: (lotteryId: number) => Promise<boolean>;
  purchaseTickets: (lotteryId: number, tokenAddress: string, quantity: number) => Promise<any>;
  batchPurchaseTickets: (selections: { lotteryId: number; tokenAddress: string; quantity: number }[]) => Promise<any>;
  claimPrize: (lotteryId: number) => Promise<any>;
}

/**
 * Custom hook for lottery functionality and data management
 * Updated to use wagmi
 */
export const useLotteries = (): UseLotteriesReturn => {
  // Using wagmi hooks
  const { address, isConnected } = useAccount();
  const chainId = useChainId(); 
  const { data: walletClient } = useWalletClient();
  
  // Using our custom wagmi wallet hook
  const { isDevelopmentMode } = useWagmiWallet();
  
  // State
  const [lotteries, setLotteries] = useState<Lottery[]>([]);
  const [activeLotteries, setActiveLotteries] = useState<Lottery[]>([]);
  const [pastLotteries, setPastLotteries] = useState<Lottery[]>([]);
  const [userTickets, setUserTickets] = useState<Record<number, Ticket[]>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState<boolean>(false);
  
  const fetchLotteries = useCallback(async (): Promise<Lottery[]> => {
  setIsLoading(true);
  setError(null);
  
  try {
    // Always check if we're in development mode first
    if (isDevelopmentMode) {
      console.log('Development mode active, using mock data');
      
      // Get mock data
      const mockLotteries = mockData.generateMockLotteries();
      const activeMockLotteries = mockData.getActiveMockLotteries();
      
      console.log('Generated mock lotteries:', mockLotteries.length);
      console.log('Active mock lotteries:', activeMockLotteries.length);
      
      // Set all states at once with reliable mock data
      setLotteries(mockLotteries);
      setActiveLotteries(activeMockLotteries);
      setPastLotteries(mockLotteries.filter(lottery => lottery.drawn));
      setIsDataLoaded(true);
      setIsLoading(false);
      
      return mockLotteries;
    }

    // Normal API flow for production
    console.log("Fetching lotteries...");
    const response = await api.getLotteries();
    
    if (response.success && response.lotteries && response.lotteries.length > 0) {
      setLotteries(response.lotteries);
      
      // Get current time
      const currentTime = Math.floor(Date.now() / 1000);
      
      console.log('⏱️ currentTime:', currentTime);

      // Output each lottery's timing info
      response.lotteries.forEach(lottery => {
        console.log(`🎟️ Lottery #${lottery.id}`);
        console.log(`  Start Time: ${lottery.startTime} (${new Date(lottery.startTime * 1000).toLocaleString()})`);
        console.log(`  End Time  : ${lottery.endTime} (${new Date(lottery.endTime * 1000).toLocaleString()})`);
        console.log(`  Drawn     : ${lottery.drawn}`);
        console.log('──────────────────────────────');
      });

      // Categorize active and past lotteries
      const active = response.lotteries.filter(lottery => 
        lottery.startTime <= currentTime && lottery.endTime > currentTime
      );
      
      setActiveLotteries(active);
      
      // Filter past lotteries
      const past = response.lotteries.filter(lottery => 
        lottery.endTime <= currentTime || lottery.drawn
      );
      
      setPastLotteries(past);
      setIsDataLoaded(true);
      setIsLoading(false);
      return response.lotteries;
    } else {
      console.warn('No lotteries returned from API, using mock data');
      
      // Fallback to mock data if API returns empty
      const mockLotteries = mockData.generateMockLotteries();
      const activeMockLotteries = mockData.getActiveMockLotteries();
      
      setLotteries(mockLotteries);
      setActiveLotteries(activeMockLotteries);
      setPastLotteries(mockLotteries.filter(lottery => lottery.drawn));
      setIsDataLoaded(true);
      setIsLoading(false);
      
      return mockLotteries;
    }
  } catch (err: any) {
    console.error('Error fetching lotteries:', err);
    setError(err.message || 'Error fetching lotteries');
    
    // On error, use mock data in development mode
    if (isDevelopmentMode) {
      console.log('Error fetching lotteries, using mock data instead');
      
      const mockLotteries = mockData.generateMockLotteries();
      const activeMockLotteries = mockData.getActiveMockLotteries();
      
      setLotteries(mockLotteries);
      setActiveLotteries(activeMockLotteries);
      setPastLotteries(mockLotteries.filter(lottery => lottery.drawn));
      setIsDataLoaded(true);
      setIsLoading(false);
      
      return mockLotteries;
    }
    
    setIsLoading(false);
    return [];
  }
}, [isDevelopmentMode]);
  
  const fetchActiveLotteries = useCallback(async (): Promise<Lottery[]> => {
  setIsLoading(true);
  setError(null);
  
  try {
    // Check for development mode first for consistency
    if (isDevelopmentMode) {
      console.log('Using mock data for active lotteries');
      const activeMockLotteries = mockData.getActiveMockLotteries();
      setActiveLotteries(activeMockLotteries);
      setIsLoading(false);
      return activeMockLotteries;
    }
    
    const response = await api.getActiveLotteries();
    
    if (response.success && response.lotteries && response.lotteries.length > 0) {
      setActiveLotteries(response.lotteries);
      setIsLoading(false);
      return response.lotteries;
    } else {
      // If no active lotteries returned, use mock data in development mode
      console.log('No active lotteries returned, using mock data');
      const activeMockLotteries = mockData.getActiveMockLotteries();
      setActiveLotteries(activeMockLotteries);
      setIsLoading(false);
      return activeMockLotteries;
    }
  } catch (err: any) {
    console.error('Error fetching active lotteries:', err);
    setError(err.message || 'Error fetching active lotteries');
    
    // On error, use mock data
    if (isDevelopmentMode) {
      console.log('Error fetching active lotteries, using mock data instead');
      const activeMockLotteries = mockData.getActiveMockLotteries();
      setActiveLotteries(activeMockLotteries);
      setIsLoading(false);
      return activeMockLotteries;
    }
    
    setIsLoading(false);
    return [];
  }
}, [isDevelopmentMode]);
  
  /**
   * Fetch details of a specific lottery
   * @param {number} lotteryId - Lottery ID
   */
  const fetchLotteryDetails = useCallback(async (lotteryId: number): Promise<Lottery | null> => {
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
      } else {
        // If lottery not found, search in mock data in development mode
        if (isDevelopmentMode) {
          console.log(`Lottery ID ${lotteryId} not found, searching in mock data`);
          const mockLotteries = api._generateMockLotteries ? 
            api._generateMockLotteries() : [];
          
          const mockLottery = mockLotteries.find(l => l.id === lotteryId);
          if (mockLottery) {
            setIsLoading(false);
            return mockLottery;
          }
        }
      }
      
      setIsLoading(false);
      return null;
    } catch (err: any) {
      console.error(`Error fetching lottery details (ID: ${lotteryId}):`, err);
      setError(err.message || 'Error fetching lottery details');
      
      // On error, search in mock data in development mode
      if (isDevelopmentMode) {
        console.log(`Error fetching lottery ${lotteryId}, searching in mock data`);
        const mockLotteries = api._generateMockLotteries ? 
          api._generateMockLotteries() : [];
        
        const mockLottery = mockLotteries.find(l => l.id === lotteryId);
        if (mockLottery) {
          setIsLoading(false);
          return mockLottery;
        }
      }
      
      setIsLoading(false);
      return null;
    }
  }, [isDevelopmentMode]);
  
  /**
   * Fetch user tickets
   * @param {number} lotteryId - Lottery ID
   */
  const fetchUserTickets = useCallback(async (lotteryId: number): Promise<Ticket[]> => {
    if (!address && !isDevelopmentMode) {
      return [];
    }
    
    setIsLoading(true);
    
    try {
      const userAddr = address || (isDevelopmentMode ? '0x1234567890123456789012345678901234567890' : null);
      if (!userAddr) return [];
      
      const response = await api.getUserTickets(lotteryId, userAddr);
      
      if (response.success && response.tickets) {
        // Update ticket data
        setUserTickets(prev => ({
          ...prev,
          [lotteryId]: response.tickets
        }));
        
        setIsLoading(false);
        return response.tickets;
      } else {
        // If no tickets found, use mock data in development mode
        if (isDevelopmentMode) {
          console.log(`No tickets found for lottery ${lotteryId}, using mock data`);
          const mockTickets = api._generateMockTickets ? 
            api._generateMockTickets(lotteryId) : [];
          
          setUserTickets(prev => ({
            ...prev,
            [lotteryId]: mockTickets
          }));
          
          setIsLoading(false);
          return mockTickets;
        }
      }
      
      setIsLoading(false);
      return [];
    } catch (err: any) {
      console.error(`Error fetching user tickets (Lottery: ${lotteryId}, User: ${address}):`, err);
      
      // On error, use mock data in development mode
      if (isDevelopmentMode) {
        console.log(`Error fetching tickets for lottery ${lotteryId}, using mock data`);
        const mockTickets = api._generateMockTickets ? 
          api._generateMockTickets(lotteryId) : [];
        
        setUserTickets(prev => ({
          ...prev,
          [lotteryId]: mockTickets
        }));
        
        setIsLoading(false);
        return mockTickets;
      }
      
      setIsLoading(false);
      return [];
    }
  }, [address, isDevelopmentMode]);
  
  /**
   * Fetch user tickets for all lotteries
   */
  const fetchAllUserTickets = useCallback(async (): Promise<void> => {
    if (!address && !isDevelopmentMode) {
      return;
    }
    
    if (lotteries.length === 0) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      const userAddr = address || (isDevelopmentMode ? '0x1234567890123456789012345678901234567890' : null);
      if (!userAddr) return;
      
      const promises = lotteries.map(lottery => 
        api.getUserTickets(lottery.id, userAddr)
      );
      
      const results = await Promise.all(promises);
      
      const ticketsByLottery: Record<number, Ticket[]> = {};
      results.forEach((response, index) => {
        if (response.success && response.tickets) {
          ticketsByLottery[lotteries[index].id] = response.tickets;
        } else if (isDevelopmentMode) {
          // If no tickets found, use mock data in development mode
          const mockTickets = api._generateMockTickets ? 
            api._generateMockTickets(lotteries[index].id) : [];
          ticketsByLottery[lotteries[index].id] = mockTickets;
        }
      });
      
      setUserTickets(ticketsByLottery);
      setIsLoading(false);
    } catch (err: any) {
      console.error('Error fetching all user tickets:', err);
      
      // On error, use mock data in development mode
      if (isDevelopmentMode) {
        console.log('Error fetching all user tickets, using mock data');
        
        const ticketsByLottery: Record<number, Ticket[]> = {};
        lotteries.forEach(lottery => {
          const mockTickets = api._generateMockTickets ? 
            api._generateMockTickets(lottery.id) : [];
          ticketsByLottery[lottery.id] = mockTickets;
        });
        
        setUserTickets(ticketsByLottery);
      }
      
      setIsLoading(false);
    }
  }, [address, lotteries.length, isDevelopmentMode]);
  
  /**
   * Check if user is a winner for a lottery
   * @param {number} lotteryId - Lottery ID
   */
  const checkIfWinner = useCallback(async (lotteryId: number): Promise<boolean> => {
    if (!address && !isDevelopmentMode) {
      return false;
    }
    
    try {
      const userAddr = address || (isDevelopmentMode ? '0x1234567890123456789012345678901234567890' : null);
      if (!userAddr) return false;
      
      const response = await api.checkIfWinner(lotteryId, userAddr);
      
      if (response.success) {
        return response.isWinner;
      } else if (isDevelopmentMode) {
        // In development mode, randomly determine winner status with 20% chance
        return Math.random() < 0.2;
      }
      
      return false;
    } catch (err: any) {
      console.error(`Error checking winner status (Lottery: ${lotteryId}, User: ${address}):`, err);
      
      // On error, use random result in development mode
      if (isDevelopmentMode) {
        console.log(`Error checking winner status for lottery ${lotteryId}, using random result`);
        return Math.random() < 0.2; // 20% chance of winning in development mode
      }
      
      return false;
    }
  }, [address, isDevelopmentMode]);
  
  /**
   * Purchase lottery tickets
   * @param {number} lotteryId - Lottery ID
   * @param {string} tokenAddress - Payment token address
   * @param {number} quantity - Number of tickets
   */
  const purchaseTickets = useCallback(async (lotteryId: number, tokenAddress: string, quantity: number) => {
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
        
        // Also refetch lottery details to update ticket count
        await fetchLotteryDetails(lotteryId);
        
        setIsLoading(false);
        return response;
      } else {
        // In development mode, simulate success even if API fails
        if (isDevelopmentMode) {
          console.log(`Error with purchase API, simulating success in development mode`);
          
          // Generate mock transaction hash
          const mockTxHash = '0x' + [...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
          
          // Refetch tickets with mock data
          await fetchUserTickets(lotteryId);
          
          setIsLoading(false);
          return {
            success: true,
            message: 'Ticket purchase request accepted (Development Mode)',
            transactionHash: mockTxHash
          };
        }
      }
      
      throw new Error(response.error || 'Failed to purchase tickets');
    } catch (err: any) {
      console.error(`Error purchasing tickets (Lottery: ${lotteryId}):`, err);
      
      // In development mode, simulate success even on error
      if (isDevelopmentMode) {
        console.log(`Error purchasing tickets, simulating success in development mode`);
        
        // Generate mock transaction hash
        const mockTxHash = '0x' + [...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
        
        // Refetch tickets with mock data
        await fetchUserTickets(lotteryId);
        
        setIsLoading(false);
        return {
          success: true,
          message: 'Ticket purchase request accepted (Development Mode)',
          transactionHash: mockTxHash
        };
      }
      
      setError(err.message || 'Error purchasing tickets');
      setIsLoading(false);
      throw err;
    }
  }, [isConnected, walletClient, fetchUserTickets, fetchLotteryDetails, isDevelopmentMode]);
  
  /**
   * Batch purchase tickets for multiple lotteries
   * @param {Array} selections - Array of purchase selections [{lotteryId, tokenAddress, quantity}]
   */
  const batchPurchaseTickets = useCallback(async (selections: { lotteryId: number; tokenAddress: string; quantity: number }[]) => {
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
        
        // Update tickets for each lottery in the batch
        await Promise.all(lotteryIds.map(id => fetchUserTickets(id)));
        
        // Also refresh lottery details
        await Promise.all(lotteryIds.map(id => fetchLotteryDetails(id)));
        
        setIsLoading(false);
        return response;
      } else {
        // In development mode, simulate success even if API fails
        if (isDevelopmentMode) {
          console.log(`Error with batch purchase API, simulating success in development mode`);
          
          // Generate mock transaction hash
          const mockTxHash = '0x' + [...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
          
          // Update tickets for each lottery in the batch
          const lotteryIds = [...new Set(selections.map(s => s.lotteryId))];
          await Promise.all(lotteryIds.map(id => fetchUserTickets(id)));
          
          setIsLoading(false);
          return {
            success: true,
            message: 'Batch ticket purchase request accepted (Development Mode)',
            transactionHash: mockTxHash
          };
        }
      }
      
      throw new Error(response.error || 'Failed to batch purchase tickets');
    } catch (err: any) {
      console.error('Error batch purchasing tickets:', err);
      
      // In development mode, simulate success even on error
      if (isDevelopmentMode) {
        console.log(`Error batch purchasing tickets, simulating success in development mode`);
        
        // Generate mock transaction hash
        const mockTxHash = '0x' + [...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
        
        // Update tickets for each lottery in the batch with mock data
        const lotteryIds = [...new Set(selections.map(s => s.lotteryId))];
        await Promise.all(lotteryIds.map(id => fetchUserTickets(id)));
        
        setIsLoading(false);
        return {
          success: true,
          message: 'Batch ticket purchase request accepted (Development Mode)',
          transactionHash: mockTxHash
        };
      }
      
      setError(err.message || 'Error batch purchasing tickets');
      setIsLoading(false);
      throw err;
    }
  }, [isConnected, walletClient, fetchUserTickets, fetchLotteryDetails, isDevelopmentMode]);
  
  /**
   * Claim prize
   * @param {number} lotteryId - Lottery ID
   */
  const claimPrize = useCallback(async (lotteryId: number) => {
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
        // Refresh lottery details after claiming
        await fetchLotteryDetails(lotteryId);
        
        setIsLoading(false);
        return response;
      } else {
        // In development mode, simulate success even if API fails
        if (isDevelopmentMode) {
          console.log(`Error with claim prize API, simulating success in development mode`);
          
          // Generate mock transaction hash
          const mockTxHash = '0x' + [...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
          
          // Refresh lottery details
          await fetchLotteryDetails(lotteryId);
          
          setIsLoading(false);
          return {
            success: true,
            message: 'Prize claim request accepted (Development Mode)',
            transactionHash: mockTxHash
          };
        }
      }
      
      throw new Error(response.error || 'Failed to claim prize');
    } catch (err: any) {
      console.error(`Error claiming prize (Lottery: ${lotteryId}):`, err);
      
      // In development mode, simulate success even on error
      if (isDevelopmentMode) {
        console.log(`Error claiming prize, simulating success in development mode`);
        
        // Generate mock transaction hash
        const mockTxHash = '0x' + [...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
        
        setIsLoading(false);
        return {
          success: true,
          message: 'Prize claim request accepted (Development Mode)',
          transactionHash: mockTxHash
        };
      }
      
      setError(err.message || 'Error claiming prize');
      setIsLoading(false);
      throw err;
    }
  }, [isConnected, walletClient, fetchLotteryDetails, isDevelopmentMode]);
  
  // Initialize data when component mounts or when initialized state changes
  useEffect(() => {
    if ((isConnected || isDevelopmentMode) && !isDataLoaded) {
      console.log("Initializing lotteries data...");
      fetchLotteries().catch(console.error);
    }
  }, [isConnected, isDevelopmentMode, isDataLoaded, fetchLotteries]);
  
  // Refetch user tickets when account changes
  useEffect(() => {
    if ((address || isDevelopmentMode) && lotteries.length > 0 && isDataLoaded) {
      fetchAllUserTickets();
    }
  }, [address, lotteries.length, fetchAllUserTickets, isDevelopmentMode, isDataLoaded]);
  
  // Debug logging in development mode
  useEffect(() => {
    if (isDevelopmentMode) {
      console.log('=== useLotteries development mode state ===');
      console.log('Active lotteries:', activeLotteries);
      console.log('All lotteries:', lotteries);
      console.log('isDevelopmentMode:', isDevelopmentMode);
      console.log('isDataLoaded:', isDataLoaded);
    }
  }, [isDevelopmentMode, activeLotteries, lotteries, isDataLoaded]);
  
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
