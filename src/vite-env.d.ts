/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_LOTTERY_CONTRACT_ADDRESS: string;
    readonly VITE_TOKEN_PAYMASTER_ADDRESS: string;
    readonly VITE_TEST_ERC20_TOKEN_1: string;
    readonly VITE_TEST_ERC20_TOKEN_2: string;
    readonly VITE_SESSION_KEY_MANAGER_ADDRESS: string;
    readonly VITE_WALLET_CONNECT_PROJECT_ID: string;
    readonly VITE_ACCOUNT_FACTORY_ADDRESS: string;
    readonly VITE_ENTRYPOINT_ADDRESS: string;
    readonly VITE_PAYMASTER_API_KEY: string;
    readonly VITE_PAYMASTER_URL: string;
    readonly VITE_BUNDLER_URL: string;
    readonly VITE_NERO_RPC_URL: string;
  }
  
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }