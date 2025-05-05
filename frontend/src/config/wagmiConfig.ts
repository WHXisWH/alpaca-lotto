import { createConfig, http } from 'wagmi'
import { mainnet, sepolia } from 'wagmi/chains'
import { injected, metaMask, walletConnect } from 'wagmi/connectors'
import { createPublicClient, http as viemHttp } from 'viem'

// Create a custom NERO Chain configuration
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
    public: {
      http: [import.meta.env.VITE_NERO_RPC_URL || 'https://rpc-testnet.nerochain.io'],
    },
  },
  blockExplorers: {
    default: {
      name: 'NERO Chain Testnet Explorer',
      url: 'https://explorer-testnet.nerochain.io',
    },
  },
  testnet: true,
}

// Create public client for multicall
const publicClient = createPublicClient({
  chain: neroTestnet,
  transport: viemHttp(neroTestnet.rpcUrls.default.http[0])
});

// WalletConnect projectId - should be stored in env variable in production
const projectId = import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID || 'YOUR_PROJECT_ID'

// Create the config according to wagmi v2 specs
export const config = createConfig({
  chains: [neroTestnet, mainnet, sepolia],
  connectors: [
    injected(),
    metaMask(),
    walletConnect({ projectId }),
  ],
  transports: {
    [neroTestnet.id]: http(neroTestnet.rpcUrls.default.http[0]),
    [mainnet.id]: http(),
    [sepolia.id]: http(),
  },
  // Add multicall configuration
  multicall: {
    batchSize: 1024, // Maximum size of encoded batch calldata
    wait: 500, // Wait time in milliseconds between requests
  }
})

export default config