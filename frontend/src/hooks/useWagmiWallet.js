import { useState, useEffect, useCallback } from 'react';
import { 
  useAccount, 
  useConnect, 
  useDisconnect, 
  useBalance,
  useReadContracts,
  useNetwork,
  useSwitchChain
} from 'wagmi';
import { readContracts } from '@wagmi/core';
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
      http: [process.env.REACT_APP_NERO_RPC_URL || 'https://rpc-testnet.nerochain.io'],
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
];

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

/**
 * Replaces original useWallet hook with wagmi implementation
 * Provides the same API surface as the original hook
 */
export const useWagmiWallet = () => {
  // wagmi hooks
  const { address, isConnected, isConnecting: connecting } = useAccount();
  const { connect, connectors, error: connectError, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { chain } = useNetwork();
  const { switchChain, error: switchError } = useSwitchChain();
  
  // State variables
  const [connectionError, setConnectionError] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [aaWalletAddress, setAaWalletAddress] = useState(null);
  const [isDevelopmentMode, setIsDevelopmentMode] = useState(false);

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
  const isMetaMaskAvailable = useCallback(() => {
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
        account: address,
        provider: null, // No longer needed with wagmi
        signer: null, // No longer needed with wagmi
      };
    } catch (err) {
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
   * Get tokens in wallet
   * @param {Array} tokenAddresses - Array of token addresses to check
   * @returns {Array} - Array of token objects with balances and metadata
   */
  const getTokens = useCallback(async (tokenAddresses) => {
    if (isDevelopmentMode || !isConnected) {
      console.log('Using mock tokens in development mode');
      return MOCK_TOKENS;
    }

    if (!address) {
      throw new Error('Wallet not connected');
    }

    // Target address - EOA or AA wallet
    const targetAddress = aaWalletAddress || address;

    try {
      // Get tokens data using wagmi
      const contracts = tokenAddresses.map(tokenAddress => ({
        address: tokenAddress,
        abi: ERC20_ABI,
      }));

      // First, let's get all the tokens metadata
      const metadataCalls = tokenAddresses.flatMap(tokenAddress => [
        {
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'decimals',
        },
        {
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'symbol',
        },
        {
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'name',
        },
      ]);

      const metadataResults = await readContracts({
        contracts: metadataCalls,
      });

      // Then, get balances for each token
      const balanceCalls = tokenAddresses.map(tokenAddress => ({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [targetAddress],
      }));

      const balanceResults = await readContracts({
        contracts: balanceCalls,
      });

      // Process the results
      const tokens = [];
      for (let i = 0; i < tokenAddresses.length; i++) {
        try {
          const decimals = metadataResults[i * 3];
          const symbol = metadataResults[i * 3 + 1];
          const name = metadataResults[i * 3 + 2];
          const rawBalance = balanceResults[i];

          if (rawBalance && rawBalance > 0n) {
            const formattedBalance = formatUnits(rawBalance, decimals);
            
            tokens.push({
              address: tokenAddresses[i],
              symbol,
              name,
              decimals,
              balance: formattedBalance,
              rawBalance: rawBalance.toString()
            });
          }
        } catch (err) {
          console.error(`Error processing token ${tokenAddresses[i]}:`, err);
        }
      }

      // If no tokens found, return mock tokens in development mode
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
  }, [address, aaWalletAddress, isConnected, isDevelopmentMode]);

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
    chainId: chain?.id,
    aaWalletAddress,
    isDevelopmentMode,
    signer: null, // No longer use ethers signer
    provider: null, // No longer use ethers provider
    connectWallet,
    disconnectWallet,
    getTokens,
    switchToNeroChain,
    addNeroChain
  };
};

export default useWagmiWallet;