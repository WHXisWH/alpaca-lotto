import { Buffer } from 'buffer';
(window as any).Buffer = Buffer;

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { WagmiProvider, createConfig, http } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AAWalletProvider } from "@/context/AAWalletContext.tsx";
import { PaymasterProvider } from "@/context/PaymasterContext.tsx";
import { LotteryProvider } from "@/context/LotteryContext.tsx";
import { Provider as UIProvider } from "@/components/ui/provider";
import { Toaster } from "@/components/ui/toaster";
import { type Chain } from "viem";
import {
  RPC_URL,
  CHAIN_ID,
  CHAIN_NAME,
  NATIVE_CURRENCY_NAME,
  NATIVE_CURRENCY_SYMBOL,
  NATIVE_CURRENCY_DECIMALS,
  WALLET_CONNECT_PROJECT_ID
} from "./config";

export const neroChain = {
  id: CHAIN_ID,
  name: CHAIN_NAME,
  nativeCurrency: {
    name: NATIVE_CURRENCY_NAME,
    symbol: NATIVE_CURRENCY_SYMBOL,
    decimals: NATIVE_CURRENCY_DECIMALS,
  },
  rpcUrls: {
    default: { http: [RPC_URL] },
    public: { http: [RPC_URL] },
  },
} as const satisfies Chain;

const projectId = WALLET_CONNECT_PROJECT_ID;

const wagmiConfig = createConfig({
  chains: [neroChain],
  connectors: [
    walletConnect({
      projectId,
      metadata: {
        name: 'Alpaca Lotto',
        description: 'Alpaca Lotto - A fun and fair lottery game!',
        url: 'https://alpaca-lotto.vercel.app',
        icons: ['https://github.com/WHXisWH/alpaca-lotto/blob/main/public/images/alpaca-logo.png']
      }
    }),
    injected(),
  ],
  transports: {
    [neroChain.id]: http(),
  },
});

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <UIProvider>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <AAWalletProvider>
            <PaymasterProvider>
              <LotteryProvider>
                <App />
                <Toaster />
              </LotteryProvider>
            </PaymasterProvider>
          </AAWalletProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </UIProvider>
  </React.StrictMode>
);