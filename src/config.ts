export const RPC_URL =
  import.meta.env.VITE_NERO_RPC_URL || "https://rpc-testnet.nerochain.io";

export const BUNDLER_RPC_URL =
  import.meta.env.VITE_BUNDLER_URL || RPC_URL;

export const PAYMASTER_RPC_URL =
  import.meta.env.VITE_PAYMASTER_URL || "";

export const PAYMASTER_API_KEY =
  import.meta.env.VITE_PAYMASTER_API_KEY || "";

export const ENTRYPOINT_ADDRESS =
  import.meta.env.VITE_ENTRYPOINT_ADDRESS ||
  "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";

export const ACCOUNT_FACTORY_ADDRESS =
  import.meta.env.VITE_ACCOUNT_FACTORY_ADDRESS ||
  "YOUR_ACCOUNT_FACTORY_ADDRESS";

export const LOTTERY_CONTRACT_ADDRESS =
  import.meta.env.VITE_LOTTERY_CONTRACT_ADDRESS ||
  "YOUR_LOTTERY_CONTRACT_ADDRESS";

export const CHAIN_ID = 689;
export const CHAIN_NAME = "Nero Testnet";
export const NATIVE_CURRENCY_NAME = "NERO";
export const NATIVE_CURRENCY_SYMBOL = "NERO";
export const NATIVE_CURRENCY_DECIMALS = 18;

export const USDC_TOKEN_ADDRESS = "0xc86fed58edf0981e927160c50ecb8a8b05b32fed";
export const USDC_DECIMALS = 6;

export const WEB3AUTH_CLIENT_ID = import.meta.env.VITE_WEB3AUTH_CLIENT_ID || "YOUR_WEB3AUTH_CLIENT_ID";