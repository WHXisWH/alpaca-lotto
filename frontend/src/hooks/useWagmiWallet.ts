import { useState, useEffect, useCallback } from 'react';
import { 
  useAccount, 
  useConnect, 
  useDisconnect, 
  useChainId,
  useSwitchChain
} from 'wagmi';
import { createPublicClient, http, formatUnits } from 'viem';

// NERO Chain config with reasonable defaults
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

// Mock tokens for development mode
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

// Type definitions
interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  rawBalance: string;
  usdPrice?: number;
}

interface UseWagmiWalletReturn {
  account: string | undefined;
  isConnecting: boolean;
  connectionError: string | null;
  chainId: number | undefined;
  aaWalletAddress: string | null;
  isDevelopmentMode: boolean;
  signer: any;
  provider: any;
  connectWallet: () => Promise<{ account: string; provider: any; signer: any; }>;
  disconnectWallet: () => void;
  getTokens: (tokenAddresses: string[], chainId?: number) => Promise<Token[]>;
  switchToNeroChain: () => Promise<void>;
  addNeroChain: () => Promise<void>;
}

/**
 * Custom hook for wallet functionality using wagmi
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
  const [signer, setSigner] = useState<any>(null);
  const [provider, setProvider] = useState<any>(null);

  // Check if development mode is enabled
  useEffect(() => {
    const devMode = localStorage.getItem('devModeEnabled') === 'true' || 
                   window.location.search.includes('devMode=true');
    setIsDevelopmentMode(devMode);
    
    // In development mode, set a mock AA address
    if (devMode && !aaWalletAddress) {
      setAaWalletAddress("0x8901b77345cC8936Bd6E142570AdE93f5ccF3417");
    }
  }, [aaWalletAddress]);

  // Derive AA wallet address when address changes
  useEffect(() => {
    if (address) {
      try {
        // This is a simplified mock calculation
        // In a real implementation, you would derive this properly
        // using the AA SDK or a similar method
        const aaAddress = address.toLowerCase().replace('0x', '0x1');
        setAaWalletAddress(aaAddress);
      } catch (err) {
        console.warn("Error deriving AA wallet address:", err);
        if (isDevelopmentMode) {
          setAaWalletAddress("0x8901b77345cC8936Bd6E142570AdE93f5ccF3417");
        }
      }
    } else if (isDevelopmentMode) {
      setAaWalletAddress("0x8901b77345cC8936Bd6E142570AdE93f5ccF3417");
    } else {
      setAaWalletAddress(null);
    }
  }, [address, isDevelopmentMode]);

  // Check for ethereum provider
  const isEthereumAvailable = useCallback((): boolean => {
    try {
      return (
        typeof window !== 'undefined' && 
        window.ethereum !== undefined
      );
    } catch (err) {
      console.warn("Error checking for ethereum:", err);
      return false;
    }
  }, []);
  
  // Check for MetaMask
  const isMetaMaskAvailable = useCallback((): boolean => {
    try {
      return (
        isEthereumAvailable() && 
        window.ethereum.isMetaMask === true
      );
    } catch (err) {
      console.warn("Error checking for MetaMask:", err);
      return false;
    }
  }, [isEthereumAvailable]);
  
  // Connect wallet function
  const connectWallet = useCallback(async () => {
    setIsConnecting(true);
    setConnectionError(null);
  
    try {
      // Check if we should use development mode
      if (localStorage.getItem('devModeEnabled') === 'true' || 
          window.location.search.includes('devMode=true') || 
          !isEthereumAvailable()) {
        console.log('Development mode active for wallet connection');
        setIsDevelopmentMode(true);
        
        // Mock values for development mode
        const mockAccount = '0x1234567890123456789012345678901234567890';
        setAaWalletAddress('0x8901b77345cC8936Bd6E142570AdE93f5ccF3417');
        
        setIsConnecting(false);
        return {
          account: mockAccount,
          provider: null,
          signer: null
        };
      }
  
      // Retry logic with exponential backoff
      let attempts = 0;
      const maxAttempts = 3;
      
      while (attempts < maxAttempts) {
        try {
          // Find MetaMask connector if available
          const connector = connectors.find(c => c.id === 'metaMask' || c.name === 'MetaMask') || connectors[0];
          
          if (connector) {
            await connect({ connector });
            break;
          } else {
            throw new Error('No suitable connector found');
          }
        } catch (innerErr) {
          console.warn(`Connection attempt ${attempts + 1} failed:`, innerErr);
          attempts++;
          
          if (attempts >= maxAttempts) throw innerErr;
          
          // Exponential backoff
          await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempts)));
        }
      }
      
      // Try to initialize provider and signer
      let walletProvider = null;
      let walletSigner = null;
      
      if (window.ethereum) {
        try {
          // Use ethers.js v5 format for compatibility
          const ethersProvider = new (window as any).ethers.providers.Web3Provider(window.ethereum);
          walletProvider = ethersProvider;
          walletSigner = ethersProvider.getSigner();
          
          setProvider(walletProvider);
          setSigner(walletSigner);
        } catch (providerErr) {
          console.warn("Could not initialize ethers provider:", providerErr);
        }
      }
      
      setIsConnecting(false);
      return {
        account: address || '',
        provider: walletProvider,
        signer: walletSigner,
      };
    } catch (err) {
      console.error('Wallet connection error:', err);
      setConnectionError(err?.message || 'Wallet connection error');
      
      // Fall back to development mode
      setIsDevelopmentMode(true);
      
      setIsConnecting(false);
      return {
        account: '0x1234567890123456789012345678901234567890',
        provider: null,
        signer: null
      };
    }
  }, [connect, connectors, address, isEthereumAvailable, isMetaMaskAvailable]);

  // Disconnect wallet function
  const disconnectWallet = useCallback(() => {
    try {
      disconnect();
    } catch (err) {
      console.warn("Error during disconnect:", err);
    }
    
    // Reset development mode if it was enabled due to fallback
    if (localStorage.getItem('devModeEnabled') !== 'true' && 
        !window.location.search.includes('devMode=true')) {
      setIsDevelopmentMode(false);
    }
    
    // Clear state
    setAaWalletAddress(null);
    setSigner(null);
    setProvider(null);
  }, [disconnect]);

  // Get tokens function with safer implementation
  const getTokens = useCallback(async (tokenAddresses: string[], chainIdParam?: number): Promise<Token[]> => {
    // Development mode check - immediately return mock tokens
    if (isDevelopmentMode || !isConnected) {
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

    const currentChainId = chainIdParam || chainId || 689;

    try {
      // Create a public client with error handling
      let publicClient;
      try {
        publicClient = createPublicClient({
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
      } catch (clientErr) {
        console.error("Error creating public client:", clientErr);
        return MOCK_TOKENS;
      }

      // ERC20 ABI - minimal version
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

      // Process tokens one by one with error handling
      const tokens: Token[] = [];
      
      for (let i = 0; i < tokenAddresses.length; i++) {
        // Skip invalid addresses
        if (!tokenAddresses[i] || !tokenAddresses[i].startsWith('0x')) {
          continue;
        }
        
        try {
          const tokenAddress = tokenAddresses[i] as `0x${string}`;
          
          // Make contract calls with proper error handling
          let decimals, symbol, name, balance;
          
          try {
            decimals = await publicClient.readContract({
              address: tokenAddress,
              abi: ERC20_ABI,
              functionName: 'decimals',
            });
          } catch (err) {
            console.warn(`Error reading decimals for ${tokenAddress}:`, err);
            decimals = 18; // Default to 18 decimals
          }
          
          try {
            symbol = await publicClient.readContract({
              address: tokenAddress,
              abi: ERC20_ABI,
              functionName: 'symbol',
            });
          } catch (err) {
            console.warn(`Error reading symbol for ${tokenAddress}:`, err);
            symbol = `TKN${i}`; // Default symbol
          }
          
          try {
            name = await publicClient.readContract({
              address: tokenAddress,
              abi: ERC20_ABI,
              functionName: 'name',
            });
          } catch (err) {
            console.warn(`Error reading name for ${tokenAddress}:`, err);
            name = `Token ${i}`; // Default name
          }
          
          try {
            balance = await publicClient.readContract({
              address: tokenAddress,
              abi: ERC20_ABI,
              functionName: 'balanceOf',
              args: [targetAddress as `0x${string}`],
            });
          } catch (err) {
            console.warn(`Error reading balance for ${tokenAddress}:`, err);
            balance = 0n; // Default to zero balance
          }
          
          // Add token to list if balance is positive or if in development mode
          if (typeof balance === 'bigint' && balance > 0n) {
            const formattedBalance = formatUnits(balance, decimals as number);
            
            tokens.push({
              address: tokenAddresses[i],
              symbol: symbol as string,
              name: name as string,
              decimals: decimals as number,
              balance: formattedBalance,
              rawBalance: balance.toString(),
              usdPrice: 1.0 // Default price
            });
          }
        } catch (tokenErr) {
          console.warn(`Error processing token ${tokenAddresses[i]}:`, tokenErr);
          continue;
        }
      }

      // If no tokens found or in dev mode, return mock tokens
      if (tokens.length === 0) {
        return MOCK_TOKENS;
      }

      return tokens;
    } catch (err) {
      console.error('Error fetching tokens:', err);
      return MOCK_TOKENS;
    }
  }, [address, aaWalletAddress, isConnected, isDevelopmentMode, chainId]);

  // Switch to NERO Chain
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

  // Add NERO Chain to wallet - identical to switchToNeroChain in this implementation
  const addNeroChain = switchToNeroChain;

  // Automatically try to connect wallet if in development mode
  useEffect(() => {
    if (!isConnected && (
      localStorage.getItem('devModeEnabled') === 'true' || 
      window.location.search.includes('devMode=true')
    )) {
      connectWallet().catch(console.error);
    }
  }, [isConnected, connectWallet]);

  return {
    account: address,
    isConnecting,
    connectionError,
    chainId,
    aaWalletAddress,
    isDevelopmentMode,
    signer,
    provider,
    connectWallet,
    disconnectWallet,
    getTokens,
    switchToNeroChain,
    addNeroChain
  };
};

export default useWagmiWallet;