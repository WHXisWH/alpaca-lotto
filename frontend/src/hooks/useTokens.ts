// frontend/src/hooks/useTokens.js
import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import axios from 'axios';

/**
 * Hook for fetching token balances for the connected account
 */
const useTokens = () => {
  const { address, isConnected } = useAccount();
  const [tokens, setTokens] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTokens = async () => {
      if (!isConnected || !address) return;

      setIsLoading(true);
      setError(null);

      try {
        // In a real app, you would call your API or use a service like Moralis/Covalent
        // For demo, we'll return mock data
        const mockTokens = [
          {
            address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            name: 'USD Coin',
            symbol: 'USDC',
            decimals: 6,
            balance: '100.0',
            usdPrice: 1
          },
          {
            address: '0x6b175474e89094c44da98b954eedeac495271d0f',
            name: 'Dai Stablecoin',
            symbol: 'DAI',
            decimals: 18,
            balance: '200.0',
            usdPrice: 1
          },
          {
            address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            name: 'Wrapped Ether',
            symbol: 'WETH',
            decimals: 18,
            balance: '1.5',
            usdPrice: 2800
          },
          {
            address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
            name: 'Wrapped Bitcoin',
            symbol: 'WBTC',
            decimals: 8,
            balance: '0.05',
            usdPrice: 42000
          },
          {
            address: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
            name: 'Uniswap',
            symbol: 'UNI',
            decimals: 18,
            balance: '10.0',
            usdPrice: 8.5
          }
        ];

        setTokens(mockTokens);
        setIsLoading(false);
      } catch (err) {
        console.error('Error fetching tokens:', err);
        setError('Error fetching token balances');
        setIsLoading(false);
      }
    };

    fetchTokens();
  }, [address, isConnected]);

  const refetch = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Same logic as above, but this allows manual refetching
      // In a real app, you'd make a fresh API call here
      // For now, we'll just simulate a delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock updated balances
      const updatedTokens = tokens.map(token => ({
        ...token,
        balance: (parseFloat(token.balance) * (0.9 + Math.random() * 0.2)).toFixed(2)
      }));

      setTokens(updatedTokens);
      setIsLoading(false);
    } catch (err) {
      console.error('Error refetching tokens:', err);
      setError('Error refetching token balances');
      setIsLoading(false);
    }
  };

  return {
    tokens,
    isLoading,
    error,
    refetch
  };
};

export default useTokens;