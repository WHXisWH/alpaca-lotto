import { useState, useEffect, useCallback } from 'react';
import { 
  useAccount, 
  useConnect, 
  useDisconnect, 
  useBalance,
  useChainId,
  useSwitchChain
} from 'wagmi';
import { readContract, readContracts } from 'wagmi/actions';
import { mainnet } from 'wagmi/chains';
import { formatUnits } from 'viem';

// Custom NERO Chain config
const neroTestnet = {
  id: 5555003,
  name: 'NERO Chain Testnet',
  nativeCurrency: {
    name: 'NERO',
    symbol: 'NERO',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [import.meta.env.VITE_NERO_RPC_URL || 'https://rpc-testnet.nerochain.io'],
    },
  },
};

// ERC20 ABI for token interactions
const ERC20_ABI = [
  {
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'name',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const; // Add as const assertion for wagmi v2

// Mock tokens for development
const MOCK_TOKENS = [
  {
    address: '0x6b175474e89094c44da98b954eedeac495271d0f',
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    decimals: 18,
    balance: '125.75',
    rawBalance: '125750000000000000000'
  },
  {
    address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    balance: '350.5',
    rawBalance: '350500000'
  },
  {
    address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    balance: '200.0',
    rawBalance: '200000000'
  },
  {
    address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
    symbol: 'WBTC',
    name: 'Wrapped Bitcoin',
    decimals: 8,
    balance: '0.015',
    rawBalance: '1500000'
  },
  {
    address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    balance: '0.25',
    rawBalance: '250000000000000000'
  }
];

interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  rawBalance: string;
}

interface UseWagmiWalletReturn {
  account: string | undefined;
  isConnecting: boolean;
  connectionError: string | null;
  chainId: number | undefined;
  aaWalletAddress: string | null;
  isDevelopmentMode: boolean;
  signer: null;
  provider: null;
  connectWallet: () => Promise<{ account: string; provider: null; signer: null; }>;
  disconnectWallet: () => void;
  getTokens: (tokenAddresses: string[], chainId?: number) => Promise<Token[]>;
  switchToNeroChain: () => Promise<void>;
  addNeroChain: () => Promise<void>;
}

/**
 * Replaces original useWallet hook with wagmi implementation
 * Provides the same API surface as the original hook
 */
export const useWagmiWallet = (): UseWagmiWalletReturn => {
  // wagmi hooks
  const { address, isConnected, isConnecting: connecting } = useAccount();
  const { connect, connectors, error: connectError, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain, error: switchError } = useSwitchChain();
  
  // State variables
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [aaWalletAddress, setAaWalletAddress] = useState<string | null>(null);
  const [isDevelopmentMode, setIsDevelopmentMode] = useState<boolean>(false);

  // Handle AA wallet address derivation
  useEffect(() => {
    if (address) {
      // Generate AA wallet address from the EOA address (same logic as original hook)
      const aaAddress = "0x" + address.slice(2, 12) + "Ab" + address.slice(14);
      setAaWalletAddress(aaAddress);
    } else {
      // In development mode, provide a mock AA address
      if (isDevelopmentMode) {
        setAaWalletAddress("0x8901b77345cC8936Bd6E142570AdE93f5ccF3417");
      } else {
        setAaWalletAddress(null);
      }
    }
  }, [address, isDevelopmentMode]);

  // Check for MetaMask or any other injected provider
  const isMetaMaskAvailable = useCallback((): boolean => {
    return (
      typeof window !== 'undefined' && 
      window.ethereum && 
      window.ethereum.isMetaMask
    );
  }, []);

  // Auto-enable development mode if MetaMask is not available
  useEffect(() => {
    if (!isMetaMaskAvailable()) {
      setIsDevelopmentMode(true);
    }
  }, [isMetaMaskAvailable]);

  // Handle connection errors
  useEffect(() => {
    // Set connection error from wagmi if any
    if (connectError) {
      setConnectionError(connectError.message);
      
      // Fall back to development mode on error
      if (!isConnected) {
        setIsDevelopmentMode(true);
      }
    } else {
      setConnectionError(null);
    }
  }, [connectError, isConnected]);

  // Update isConnecting state
  useEffect(() => {
    setIsConnecting(connecting || isPending);
  }, [connecting, isPending]);
  
  /**
   * Connect wallet
   */
  const connectWallet = useCallback(async () => {
    setIsConnecting(true);
    setConnectionError(null);

    try {
      // Check for MetaMask
      if (!isMetaMaskAvailable()) {
        console.log('MetaMask not detected - activating development mode');
        setIsDevelopmentMode(true);
        setIsConnecting(false);
        
        // Return mock data in development mode
        return {
          account: '0x1234567890123456789012345678901234567890',
          provider: null,
          signer: null
        };
      }

      // Find the appropriate connector (prefer MetaMask)
      const connector = connectors.find(c => c.name === 'MetaMask') || connectors[0];
      
      if (connector) {
        await connect({ connector });
      } else {
        throw new Error('No suitable connector found');
      }
      
      return {
        account: address || '',
        provider: null, // No longer needed with wagmi
        signer: null, // No longer needed with wagmi
      };
    } catch (err: any) {
      console.error('Wallet connection error:', err);
      setConnectionError(err.message || 'Wallet connection error');
      
      // Fall back to development mode
      setIsDevelopmentMode(true);
      
      return {
        account: '0x1234567890123456789012345678901234567890',
        provider: null,
        signer: null
      };
    } finally {
      setIsConnecting(false);
    }
  }, [connect, connectors, address, isMetaMaskAvailable]);

  /**
   * Disconnect wallet
   */
  const disconnectWallet = useCallback(() => {
    disconnect();
    setIsDevelopmentMode(false);
  }, [disconnect]);

  /**
   * Get tokens in wallet - Updated for wagmi v2
   * @param {Array} tokenAddresses - Array of token addresses to check
   * @returns {Array} - Array of token objects with balances and metadata
   */
  const getTokens = useCallback(async (tokenAddresses: string[], chainIdParam?: number): Promise<Token[]> => {
    // Development mode check - immediately return mock tokens if in development mode
    if (isDevelopmentMode || !isConnected) {
      console.log('Using mock tokens in development mode');
      return MOCK_TOKENS;
    }

    if (!address) {
      throw new Error('Wallet not connected');
    }

    // Target address - EOA or AA wallet
    const targetAddress = aaWalletAddress || address;
    if (!targetAddress) {
      throw new Error('No valid address available');
    }

    const currentChainId = chainIdParam || chainId || 5555003;

    try {
      // Create contract calls for tokens using readContracts with allowFailure
      const contractCalls = tokenAddresses.flatMap((tokenAddress) => [
        {
          address: tokenAddress as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'decimals',
          chainId: currentChainId,
          allowFailure: true,
        },
        {
          address: tokenAddress as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'symbol',
          chainId: currentChainId,
          allowFailure: true,
        },
        {
          address: tokenAddress as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'name',
          chainId: currentChainId,
          allowFailure: true,
        },
        {
          address: tokenAddress as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [targetAddress as `0x${string}`],
          chainId: currentChainId,
          allowFailure: true,
        }
      ]);

      // Use readContracts for batch processing
      const responses = await readContracts({ contracts: contractCalls });

      // Process results into token objects
      const tokens: Token[] = [];
      
      for (let i = 0; i < tokenAddresses.length; i++) {
        const offset = i * 4;
        
        // Extract responses for the current token
        const decimalResponse = responses[offset];
        const symbolResponse = responses[offset + 1];
        const nameResponse = responses[offset + 2];
        const balanceResponse = responses[offset + 3];
        
        // Check if any of the responses failed
        if (decimalResponse.status !== 'success' || 
            symbolResponse.status !== 'success' ||
            nameResponse.status !== 'success' ||
            balanceResponse.status !== 'success') {
          console.warn(`Skipping token ${tokenAddresses[i]} due to failed contract call`);
          continue;
        }
        
        // Extract values from responses
        const decimals = decimalResponse.result ?? 18;
        const symbol = symbolResponse.result ?? 'UNKNOWN';
        const name = nameResponse.result ?? 'Unknown Token';
        const balance = balanceResponse.result;
        
        // Only add tokens with positive balances and ensure balance is a bigint
        if (typeof balance === 'bigint' && balance > 0n) {
          const formattedBalance = formatUnits(balance, decimals as number);
          
          tokens.push({
            address: tokenAddresses[i],
            symbol: symbol as string,
            name: name as string,
            decimals: decimals as number,
            balance: formattedBalance,
            rawBalance: balance.toString()
          });
        }
      }

      // If no tokens found and in development mode, return mock tokens
      if (tokens.length === 0 && isDevelopmentMode) {
        return MOCK_TOKENS;
      }

      return tokens;
    } catch (err) {
      console.error('Error fetching tokens:', err);
      if (isDevelopmentMode) {
        return MOCK_TOKENS;
      }
      throw err;
    }
  }, [address, aaWalletAddress, isConnected, isDevelopmentMode, chainId]);

  /**
   * Switch to NERO Chain
   */
  const switchToNeroChain = useCallback(async () => {
    if (isDevelopmentMode) {
      console.log('Development mode: Pretending to switch to NERO Chain');
      return;
    }

    try {
      await switchChain({ chainId: neroTestnet.id });
    } catch (err) {
      console.error('Error switching to NERO Chain:', err);
      throw err;
    }
  }, [isDevelopmentMode, switchChain]);

  /**
   * Add NERO Chain to wallet
   * Note: With wagmi v2, switching to a chain will automatically
   * add it if it's not already added to the wallet
   */
  const addNeroChain = switchToNeroChain;

  return {
    account: address,
    isConnecting,
    connectionError,
    chainId,
    aaWalletAddress,
    isDevelopmentMode,
    signer: null, 
    provider: null, 
    connectWallet,
    disconnectWallet,
    getTokens,
    switchToNeroChain,
    addNeroChain
  };
};

export default useWagmiWallet;
