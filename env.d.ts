interface ImportMetaEnv {
    readonly VITE_NERO_RPC_URL: string;
    readonly VITE_BUNDLER_URL: string;
    readonly VITE_PAYMASTER_URL: string;
    readonly VITE_PAYMASTER_API_KEY: string;
    readonly VITE_ENTRYPOINT_ADDRESS: string;
    readonly VITE_ACCOUNT_FACTORY_ADDRESS: string;
    readonly VITE_LOTTERY_CONTRACT_ADDRESS: string;
    readonly VITE_API_BASE_URL: string;
    readonly VITE_WALLET_CONNECT_PROJECT_ID: string;
  }
  
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }