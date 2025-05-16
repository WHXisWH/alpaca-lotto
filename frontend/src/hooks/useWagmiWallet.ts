import { useState, useEffect, useCallback } from 'react';
import {
  useAccount,
  useConnect,
  useDisconnect,
  useChainId,
  useSwitchChain,
  useWalletClient,
} from 'wagmi';
import { createPublicClient, http, formatUnits, type WalletClient } from 'viem';
import { providers as ethersProviders, Signer as EthersSigner } from 'ethers';

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

function walletClientToEthers5Signer(walletClient: WalletClient): EthersSigner | null {
  if (!walletClient) return null;
  const { account, chain, transport } = walletClient;
  if (!account || !chain || !transport) {
    console.warn('WalletClient is missing required properties for Signer conversion.');
    return null;
  }
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  };
  const provider = new ethersProviders.Web3Provider(transport as any, network); 
  const signer = provider.getSigner(account.address);
  return signer;
}


interface UseWagmiWalletReturn {
  account: string | undefined;
  isConnecting: boolean;
  connectionError: string | null;
  chainId: number | undefined;
  aaWalletAddress: string | null; 
  ethersSigner: EthersSigner | null; 
  provider: ethersProviders.Web3Provider | null; 
  connectWallet: () => Promise<void>; 
  disconnectWallet: () => void;
  getTokens: (tokenAddresses: string[], chainId?: number) => Promise<Token[]>;
  switchToNeroChain: () => Promise<void>;
  addNeroChain: () => Promise<void>;
  isDevelopmentMode: boolean;
}

export const useWagmiWallet = (): UseWagmiWalletReturn => {
  const { address, isConnected, isConnecting: wagmiIsConnecting } = useAccount();
  const { connect, connectors, error: connectErrorHook, isPending: wagmiIsPending } = useConnect();
  const { disconnect } = useDisconnect();
  const currentChainId = useChainId();
  const { switchChain, error: switchErrorHook } = useSwitchChain();
  const { data: walletClient } = useWalletClient();

  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [ethersSigner, setEthersSigner] = useState<EthersSigner | null>(null);
  const [ethersProvider, setEthersProvider] = useState<ethersProviders.Web3Provider | null>(null);
  const [aaWalletAddress, setAaWalletAddress] = useState<string | null>(null); 


  const isDevelopmentMode = import.meta.env.MODE === 'development';


  useEffect(() => {
    if (connectErrorHook) {
      setConnectionError(connectErrorHook.message);
    } else if (switchErrorHook) {
      setConnectionError(switchErrorHook.message);
    } else {
      setConnectionError(null);
    }
  }, [connectErrorHook, switchErrorHook]);

  useEffect(() => {
    if (walletClient) {
      const signerInstance = walletClientToEthers5Signer(walletClient);
      setEthersSigner(signerInstance);
      if (signerInstance && signerInstance.provider instanceof ethersProviders.Web3Provider) {
        setEthersProvider(signerInstance.provider);
      } else if (walletClient.transport) {
          // Fallback if provider cannot be derived directly from signer
          const { chain } = walletClient;
          if (chain) {
             const network = { chainId: chain.id, name: chain.name };
             setEthersProvider(new ethersProviders.Web3Provider(walletClient.transport as any, network));
          }
      }
    } else {
      setEthersSigner(null);
      setEthersProvider(null);
    }
  }, [walletClient]);

  useEffect(() => {
    if (address) {
      setAaWalletAddress(address);
    } else {
      setAaWalletAddress(null);
    }
  }, [address]);


  const connectWallet = useCallback(async () => {
    setConnectionError(null);
    const injectedConnector = connectors.find(c => c.id === 'injected' || c.name === 'MetaMask');
    if (injectedConnector) {
      try {
        await connect({ connector: injectedConnector });
      } catch (err: any) {
        console.error('Wallet connection error:', err);
        setConnectionError(err.message || 'Failed to connect wallet.');
      }
    } else {
      setConnectionError('MetaMask or injected provider not found.');
      console.error('MetaMask or injected provider not found.');
    }
  }, [connect, connectors]);

  const disconnectWallet = useCallback(() => {
    disconnect();
    setEthersSigner(null);
    setEthersProvider(null);
  }, [disconnect]);

  const getTokens = useCallback(async (tokenAddresses: string[], chainIdParam?: number): Promise<Token[]> => {
    if (!isConnected || !address || !ethersProvider) {
      // setError('Wallet not connected or provider not available.');
      console.warn('getTokens: Wallet not connected or provider not available.');
      return [];
    }

    const targetAddress = aaWalletAddress || address;
    if (!targetAddress) {
        console.warn('getTokens: No valid address available.');
        return [];
    }

    try {
      const tokens: Token[] = [];
      for (const tokenAddr of tokenAddresses) {
        try {
          const contract = new ethers.Contract(tokenAddr, ERC20_ABI, ethersProvider);
          const [decimals, symbol, name, balance] = await Promise.all([
            contract.decimals(),
            contract.symbol(),
            contract.name(),
            contract.balanceOf(targetAddress),
          ]);

          if (balance && balance.gt(0)) {
            tokens.push({
              address: tokenAddr,
              symbol,
              name,
              decimals,
              balance: formatUnits(balance, decimals),
              rawBalance: balance.toString(),
            });
          }
        } catch (err) {
          console.warn(`Skipping token ${tokenAddr} due to error:`, err);
        }
      }
      return tokens;
    } catch (err: any) {
      console.error('Error fetching tokens:', err);
      // setError(err.message || 'Failed to fetch tokens.');
      return [];
    }
  }, [isConnected, address, ethersProvider, aaWalletAddress]);

  const switchToNeroChain = useCallback(async () => {
    if (!switchChain) {
        console.error("switchChain function is not available from wagmi's useSwitchChain.");
        setConnectionError("Failed to switch network: Function not available.");
        return;
    }
    try {
      await switchChain({ chainId: neroTestnet.id });
    } catch (err: any) {
      console.error('Error switching to NERO Chain:', err);
      setConnectionError(err.message || 'Failed to switch to NERO Chain.');
      if (err.code === 4902 || err.message?.includes('Unrecognized chain ID')) { 
        try {
          await addNeroChain();
        } catch (addError: any) {
            console.error('Error adding NERO Chain:', addError);
            setConnectionError(addError.message || 'Failed to add NERO Chain.');
        }
      }
    }
  }, [switchChain]);

  const addNeroChain = useCallback(async () => {
    if (!walletClient || !walletClient.transport || typeof (walletClient.transport as any).request !== 'function') {
        console.error("Wallet client or transport.request is not available to add chain.");
        setConnectionError("Cannot add chain: Wallet client not configured correctly.");
        return;
    }
    try {
      await (walletClient.transport as any).request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: `0x${neroTestnet.id.toString(16)}`,
            chainName: neroTestnet.name,
            nativeCurrency: neroTestnet.nativeCurrency,
            rpcUrls: neroTestnet.rpcUrls.default.http,
            blockExplorerUrls: [neroTestnet.blockExplorers?.default.url],
          },
        ],
      });
    } catch (err: any) {
      console.error('Error adding NERO Chain:', err);
      setConnectionError(err.message || 'Failed to add NERO Chain.');
      throw err;
    }
  }, [walletClient]);


  return {
    account: address,
    isConnecting: wagmiIsConnecting || wagmiIsPending,
    connectionError,
    chainId: currentChainId,
    aaWalletAddress,
    ethersSigner,
    provider: ethersProvider,
    connectWallet,
    disconnectWallet,
    getTokens,
    switchToNeroChain,
    addNeroChain,
    isDevelopmentMode,
  };
};

export default useWagmiWallet;