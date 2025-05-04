import { useState, useCallback, useEffect } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { api } from '../services/api';
import useWagmiWallet from './useWagmiWallet'; // Using wagmi wallet hook

// Common token addresses (for test/demo)
const COMMON_TOKENS = [
  // Stablecoins
  '0x6b175474e89094c44da98b954eedeac495271d0f', // DAI
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
  '0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT
  '0x853d955acef822db058eb8505911ed77f175b99e', // FRAX
  
  // Major cryptocurrencies
  '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', // WBTC
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH
  
  // DeFi tokens
  '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984', // UNI
  '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9', // AAVE
];

/**
 * @typedef {Object} Token
 * @property {string} address - Token address
 * @property {string} symbol - Token symbol
 * @property {string} name - Token name
 * @property {number} decimals - Token decimals
 * @property {string} balance - Token balance (as string)
 * @property {string} rawBalance - Raw token balance (as string)
 * @property {number} [usdBalance] - Token balance in USD
 * @property {number} [score] - Token score
 * @property {boolean} [recommended] - Whether it is the recommended token
 * @property {string[]} [reasons] - Reasons for recommendation
 */

/**
 * @typedef {Object} Recommendation
 * @property {Token} recommendedToken - Recommended token
 * @property {Token[]} allScores - All tokens with their scores
 * @property {number} supportedCount - Number of supported tokens
 */

/**
 * Custom hook for managing and recommending tokens
 * Updated to use wagmi
 */
export const useTokens = () => {
  // Using wagmi hooks
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  
  // Using our custom hook for additional functionality
  const { aaWalletAddress, isDevelopmentMode, getTokens: fetchWalletTokens } = useWagmiWallet();
  
  // State
  const [tokens, setTokens] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [supportedTokens, setSupportedTokens] = useState([]);
  const [recommendation, setRecommendation] = useState(null);
  
  /**
   * Retrieve tokens from wallet
   */
  const getTokens = useCallback(async () => {
    if (!address && !aaWalletAddress && !isDevelopmentMode) {
      setError('Wallet is not connected');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const walletTokens = await fetchWalletTokens(COMMON_TOKENS);
      setTokens(walletTokens);
      
      await getSupportedTokens();
      
      setIsLoading(false);
      return walletTokens;
    } catch (err) {
      console.error('Token fetch error:', err);
      setError(err.message || 'Failed to fetch tokens');
      setIsLoading(false);
    }
  }, [address, aaWalletAddress, isDevelopmentMode, fetchWalletTokens]);
  
  /**
   * Get tokens supported by the Paymaster
   */
  const getSupportedTokens = useCallback(async () => {
    try {
      const response = await api.getSupportedTokens();
      
      if (response.success && response.tokens) {
        const addresses = response.tokens.map((token) => 
          token.address.toLowerCase()
        );
        
        setSupportedTokens(addresses);
        return addresses;
      }
      
      return [];
    } catch (err) {
      console.error('Failed to fetch supported tokens:', err);
      return [];
    }
  }, []);
  
  /**
   * Get token recommendation from API
   * @param {Array} targetTokens - Tokens to analyze (defaults to current tokens)
   * @param {number} [ticketPrice] - Ticket price in USD (affects recommendation logic)
   */
  const getRecommendation = useCallback(async (targetTokens = null, ticketPrice = null) => {
    const tokensToUse = targetTokens || tokens;
    
    if (tokensToUse.length === 0) {
      setError('No tokens found');
      return null;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const userPreferences = {};
      if (ticketPrice) {
        if (ticketPrice >= 50) {
          userPreferences.weights = {
            balance: 0.5,
            volatility: 0.25,
            slippage: 0.25
          };
        }
      }
      
      const response = await api.optimizeToken(tokensToUse, userPreferences);
      
      if (response.success && response.recommendedToken) {
        setRecommendation(response);
        
        const updatedTokens = tokensToUse.map(token => {
          if (token.address.toLowerCase() === response.recommendedToken.address.toLowerCase()) {
            return {
              ...token,
              ...response.recommendedToken,
              recommended: true
            };
          }
          
          const scoreInfo = response.allScores.find(
            (t) => t.address.toLowerCase() === token.address.toLowerCase()
          );
          
          if (scoreInfo) {
            return {
              ...token,
              ...scoreInfo,
              recommended: false
            };
          }
          
          return token;
        });
        
        setTokens(updatedTokens);
        setIsLoading(false);
        return response;
      }
      
      setIsLoading(false);
      return null;
    } catch (err) {
      console.error('Token recommendation fetch error:', err);
      setError(err.message || 'Failed to fetch token recommendation');
      setIsLoading(false);
      return null;
    }
  }, [tokens]);
  
  /**
   * Check if a token is supported by the Paymaster
   * @param {string} tokenAddress - Token address to check
   * @returns {boolean} - Whether the token is supported
   */
  const isTokenSupported = useCallback((tokenAddress) => {
    if (!tokenAddress || supportedTokens.length === 0) {
      return false;
    }
    
    return supportedTokens.includes(tokenAddress.toLowerCase());
  }, [supportedTokens]);
  
  /**
   * Filter only supported tokens
   * @returns {Array} - Array of supported tokens
   */
  const getSupportedTokensOnly = useCallback(() => {
    return tokens.filter(token => 
      isTokenSupported(token.address)
    );
  }, [tokens, isTokenSupported]);
  
  // Load tokens when wallet is connected
  useEffect(() => {
    if (isConnected || aaWalletAddress || isDevelopmentMode) {
      getTokens();
    }
  }, [isConnected, aaWalletAddress, isDevelopmentMode, getTokens]);
  
  // Reload tokens when chain changes
  useEffect(() => {
    if (isConnected && chainId) {
      getTokens();
    }
  }, [chainId, isConnected, getTokens]);
  
  return {
    tokens,
    isLoading,
    error,
    supportedTokens,
    recommendation,
    getTokens,
    getSupportedTokens,
    getRecommendation,
    isTokenSupported,
    getSupportedTokensOnly
  };
};

export default useTokens;