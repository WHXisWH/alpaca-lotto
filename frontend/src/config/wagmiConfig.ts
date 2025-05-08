// frontend/src/config/wagmiConfig.ts
import { createConfig, http } from 'wagmi'
import { mainnet, sepolia } from 'wagmi/chains'
import { injected, metaMask, walletConnect } from 'wagmi/connectors'

// Create a custom NERO Chain configuration
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
    public: {
      http: [import.meta.env.VITE_NERO_RPC_URL || 'https://rpc-testnet.nerochain.io'],
    },
  },
  blockExplorers: {
    default: {
      name: 'NERO Chain Testnet Explorer',
      url: 'https://testnet.neroscan.io/',
    },
  },
  testnet: true,
}

// WalletConnect projectId - should be stored in env variable in production
const projectId = import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID || 'YOUR_PROJECT_ID'

// Create wagmi config with safer fallbacks and error handling
const createSafeConfig = () => {
  try {
    return createConfig({
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
    });
  } catch (err) {
    console.error("Error creating wagmi config:", err);
    
    // Return a minimal config that won't crash the application
    return {
      connectors: [],
      publicClient: null,
      chains: [neroTestnet, mainnet, sepolia]
    };
  }
};

// Export the safely created config
export const config = createSafeConfig();

export default config;