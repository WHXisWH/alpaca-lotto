import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import SUPPORTED_TOKENS from '../constants/tokens';

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
      if (!isConnected && !address) return;

      setIsLoading(true);
      setError(null);

      try {
        // Generate mock data using the correct token addresses for NERO testnet
        const mockTokens = [
          {
            address: SUPPORTED_TOKENS.USDC.address,
            name: SUPPORTED_TOKENS.USDC.name,
            symbol: SUPPORTED_TOKENS.USDC.symbol,
            decimals: SUPPORTED_TOKENS.USDC.decimals,
            balance: '100.0',
            usdPrice: 1
          },
          {
            address: SUPPORTED_TOKENS.DAI.address,
            name: SUPPORTED_TOKENS.DAI.name,
            symbol: SUPPORTED_TOKENS.DAI.symbol,
            decimals: SUPPORTED_TOKENS.DAI.decimals,
            balance: '200.0',
            usdPrice: 1
          },
          {
            address: SUPPORTED_TOKENS.USDT.address,
            name: SUPPORTED_TOKENS.USDT.name,
            symbol: SUPPORTED_TOKENS.USDT.symbol,
            decimals: SUPPORTED_TOKENS.USDT.decimals,
            balance: '150.0',
            usdPrice: 1
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

  // Get only tokens that are supported by the Paymaster
  const getSupportedTokensOnly = () => {
    // In this implementation, all our tokens are supported
    return tokens;
  };

  const refetch = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Same logic as above, but this allows manual refetching
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
    refetch,
    getSupportedTokensOnly
  };
};

export default useTokens;