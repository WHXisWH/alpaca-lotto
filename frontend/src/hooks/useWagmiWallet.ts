import { useState, useEffect, useCallback } from 'react';
import { 
  useAccount, 
  useConnect, 
  useDisconnect, 
  useChainId,
  useSwitchChain
} from 'wagmi';
import { createPublicClient, http, formatUnits } from 'viem';

// Custom NERO Chain config
const neroTestnet = {
  id: 689,
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
] as const;

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

  // Handle AA wallet address derivation
  useEffect(() => {
    if (address) {
      // For now, use the EOA address until a proper AA address generation is implemented
      setAaWalletAddress(address);
    } else {
      setAaWalletAddress(null);
    }
  }, [address]);

  // Check for MetaMask or any other injected provider
  const isMetaMaskAvailable = useCallback((): boolean => {
    try {
      return (
        typeof window !== 'undefined' && 
        window.ethereum && 
        window.ethereum.isMetaMask
      );
    } catch (err) {
      console.warn("Error checking for MetaMask:", err);
      return false;
    }
  }, []);
  
  const connectWallet = useCallback(async () => {
    setIsConnecting(true);
    setConnectionError(null);
  
    try {
      // Check for MetaMask with error handling
      if (!isMetaMaskAvailable()) {
        console.log('MetaMask not detected');
        setConnectionError('No wallet detected. Please install MetaMask or another Ethereum wallet.');
        setIsConnecting(false);
        throw new Error('No wallet detected');
      }
  
      // Retry logic with exponential backoff
      let attempts = 0;
      const maxAttempts = 3;
      
      while (attempts < maxAttempts) {
        try {
          const connector = connectors.find(c => c.name === 'MetaMask') || connectors[0];
          if (connector) {
            await connect({ connector });
            break;
          }
        } catch (innerErr) {
          console.warn(`Connection attempt ${attempts + 1} failed:`, innerErr);
          attempts++;
          if (attempts >= maxAttempts) throw innerErr;
          // Exponential backoff
          await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempts)));
        }
      }
      
      return {
        account: address || '',
        provider: null,
        signer: null,
      };
    } catch (err) {
      console.error('Wallet connection error:', err);
      setConnectionError(err.message || 'Wallet connection error');
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, [connect, connectors, address, isMetaMaskAvailable]);

  /**
   * Disconnect wallet
   */
  const disconnectWallet = useCallback(() => {
    disconnect();
  }, [disconnect]);

  /**
   * Get tokens in wallet - Updated to avoid multicall3 dependency
   * @param {Array} tokenAddresses - Array of token addresses to check
   * @returns {Array} - Array of token objects with balances and metadata
   */
  const getTokens = useCallback(async (tokenAddresses: string[], chainIdParam?: number): Promise<Token[]> => {
    if (!isConnected) {
      throw new Error('Wallet not connected');
    }

    if (!address) {
      throw new Error('Wallet not connected');
    }

    // Target address - EOA or AA wallet
    const targetAddress = aaWalletAddress || address;
    if (!targetAddress) {
      throw new Error('No valid address available');
    }

    const currentChainId = chainIdParam || chainId || 689;

    try {
      // Create a viem public client for the current chain - without multicall configuration
      const publicClient = createPublicClient({
        chain: {
          id: currentChainId,
          name: currentChainId === 689 ? 'NERO Chain Testnet' : 'Unknown Chain',
          rpcUrls: {
            default: {
              http: [currentChainId === 689 
                ? (import.meta.env.VITE_NERO_RPC_URL || 'https://rpc-testnet.nerochain.io')
                : 'https://ethereum.publicnode.com'
              ],
            },
          },
        },
        transport: http(),
      });

      // Process results into token objects
      const tokens: Token[] = [];
      
      // Process each token one by one instead of using multicall
      for (let i = 0; i < tokenAddresses.length; i++) {
        const tokenAddress = tokenAddresses[i] as `0x${string}`;
        
        try {
          // Individual contract calls for each token
          const decimalsPromise = publicClient.readContract({
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: 'decimals',
          });
          
          const symbolPromise = publicClient.readContract({
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: 'symbol',
          });
          
          const namePromise = publicClient.readContract({
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: 'name',
          });
          
          const balancePromise = publicClient.readContract({
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [targetAddress as `0x${string}`],
          });
          
          // Execute all promises in parallel
          const [decimals, symbol, name, balance] = await Promise.all([
            decimalsPromise,
            symbolPromise,
            namePromise,
            balancePromise
          ]);
          
          // Only add tokens with positive balances
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
        } catch (err) {
          console.warn(`Skipping token ${tokenAddresses[i]} due to failed contract call:`, err);
          continue;
        }
      }

      return tokens;
    } catch (err) {
      console.error('Error fetching tokens:', err);
      throw err;
    }
  }, [address, aaWalletAddress, isConnected, chainId]);

  /**
   * Switch to NERO Chain
   */
  const switchToNeroChain = useCallback(async () => {
    try {
      await switchChain({ chainId: neroTestnet.id });
    } catch (err) {
      console.error('Error switching to NERO Chain:', err);
      throw err;
    }
  }, [switchChain]);

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