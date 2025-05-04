import { createConfig, http } from 'wagmi'
import { mainnet, sepolia } from 'wagmi/chains'
import { injected, metaMask, walletConnect } from 'wagmi/connectors'

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

// WalletConnect projectId - should be stored in env variable in production
const projectId = import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID || 'YOUR_PROJECT_ID'

// Create the config
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
})

export default config