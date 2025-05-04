import { useState, useCallback, useEffect } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { api } from '../services/api';
import useWagmiWallet from './useWagmiWallet';

// Common token addresses (for test/demo)
const COMMON_TOKENS = [
  import.meta.env.VITE_TEST_ERC20_TOKEN_1,
  import.meta.env.VITE_TEST_ERC20_TOKEN_2,
].filter(Boolean);

export interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  rawBalance: string;
  usdBalance?: number;
  usdPrice?: number;
  score?: number;
  volatility?: number;
  slippage?: number;
  recommended?: boolean;
  reasons?: string[];
}

export interface Recommendation {
  recommendedToken: Token;
  allScores: Token[];
  factors: {
    balanceWeight: number;
    volatilityWeight: number;
    slippageWeight: number;
  };
}

interface UseTokensReturn {
  tokens: Token[];
  isLoading: boolean;
  error: string | null;
  supportedTokens: string[];
  recommendation: Recommendation | null;
  getTokens: () => Promise<Token[]>;
  getSupportedTokens: () => Promise<string[]>;
  getRecommendation: (targetTokens?: Token[] | null, ticketPrice?: number | null) => Promise<Recommendation | null>;
  isTokenSupported: (tokenAddress: string) => boolean;
  getSupportedTokensOnly: () => Token[];
}

export const useTokens = (): UseTokensReturn => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { aaWalletAddress, isDevelopmentMode, getTokens: fetchWalletTokens } = useWagmiWallet();

  const [tokens, setTokens] = useState<Token[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [supportedTokens, setSupportedTokens] = useState<string[]>([]);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);

  const getSupportedTokens = useCallback(async (): Promise<string[]> => {
    try {
      const response = await api.getSupportedTokens();
      if (response.success && response.tokens) {
        const addresses = response.tokens.map((token: any) => token.address.toLowerCase());
        setSupportedTokens(addresses);
        return addresses;
      }
      return [];
    } catch (err) {
      console.error('Failed to fetch supported tokens:', err);
      return [];
    }
  }, []);

  const getTokens = useCallback(async (): Promise<Token[]> => {
    if (!isConnected && !isDevelopmentMode) {
      setError('Wallet is not connected');
      return [];
    }

    if (!address && !aaWalletAddress && !isDevelopmentMode) {
      setError('No valid address available');
      return [];
    }

    setIsLoading(true);
    setError(null);

    try {
      const tokensToFetch = COMMON_TOKENS;
      const walletTokens = await fetchWalletTokens(tokensToFetch, chainId || 5555003);
      setTokens(walletTokens);
      await getSupportedTokens();
      setIsLoading(false);
      return walletTokens;
    } catch (err: any) {
      console.error('Token fetch error:', err);
      setError(err.message || 'Failed to fetch tokens');
      setIsLoading(false);
      return [];
    }
  }, [address, aaWalletAddress, isConnected, isDevelopmentMode, fetchWalletTokens, chainId, getSupportedTokens]);

  const getRecommendation = useCallback(async (targetTokens: Token[] | null = null, ticketPrice: number | null = null): Promise<Recommendation | null> => {
    const tokensToUse = targetTokens || tokens;
    if (tokensToUse.length === 0) {
      setError('No tokens found');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const userPreferences: Record<string, any> = {};
      if (ticketPrice && ticketPrice >= 50) {
        userPreferences.weights = {
          balance: 0.5,
          volatility: 0.25,
          slippage: 0.25
        };
      }

      const response = await api.optimizeToken(tokensToUse, userPreferences);
      if (response.success && response.recommendedToken) {
        setRecommendation(response);

        const updatedTokens = tokensToUse.map(token => {
          if (token.address.toLowerCase() === response.recommendedToken.address.toLowerCase()) {
            return { ...token, ...response.recommendedToken, recommended: true };
          }
          const scoreInfo = response.allScores.find(t => t.address.toLowerCase() === token.address.toLowerCase());
          if (scoreInfo) {
            return { ...token, ...scoreInfo, recommended: false };
          }
          return token;
        });

        setTokens(updatedTokens);
        setIsLoading(false);
        return response;
      }

      setIsLoading(false);
      return null;
    } catch (err: any) {
      console.error('Token recommendation fetch error:', err);
      setError(err.message || 'Failed to fetch token recommendation');
      setIsLoading(false);
      return null;
    }
  }, [tokens]);

  const isTokenSupported = useCallback((tokenAddress: string): boolean => {
    if (!tokenAddress || supportedTokens.length === 0) {
      return false;
    }
    return supportedTokens.includes(tokenAddress.toLowerCase());
  }, [supportedTokens]);

  const getSupportedTokensOnly = useCallback((): Token[] => {
    return tokens.filter(token => isTokenSupported(token.address));
  }, [tokens, isTokenSupported]);

  useEffect(() => {
    if (!isConnected && !isDevelopmentMode) {
      setIsLoading(false);
      return;
    }

    if (isConnected && address) {
      getTokens();
    } else if (aaWalletAddress) {
      getTokens();
    } else if (isDevelopmentMode) {
      const fetchMockTokens = async () => {
        const mockTokens = await fetchWalletTokens(COMMON_TOKENS, chainId || 5555003);
        setTokens(mockTokens);
      };
      fetchMockTokens();
    }
  }, [isConnected, address, aaWalletAddress, isDevelopmentMode, getTokens, fetchWalletTokens, chainId]);

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
