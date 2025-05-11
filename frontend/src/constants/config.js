export const NERO_RPC_URL = import.meta.env.VITE_NERO_RPC_URL || "https://rpc-testnet.nerochain.io";
export const BUNDLER_URL = import.meta.env.VITE_BUNDLER_URL || "https://bundler-testnet.nerochain.io";
export const PAYMASTER_URL = import.meta.env.VITE_PAYMASTER_URL || "https://paymaster-testnet.nerochain.io";
export const ENTRYPOINT_ADDRESS = import.meta.env.VITE_ENTRYPOINT_ADDRESS || "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
export const ACCOUNT_FACTORY_ADDRESS = import.meta.env.VITE_ACCOUNT_FACTORY_ADDRESS || "0x9406Cc6185a346906296840746125a0E44976454";
export const LOTTERY_CONTRACT_ADDRESS = import.meta.env.VITE_LOTTERY_CONTRACT_ADDRESS || "";
export const TOKEN_PAYMASTER_ADDRESS = import.meta.env.VITE_TOKEN_PAYMASTER_ADDRESS || "0x5a6680dFd4a77FEea0A7be291147768EaA2414ad";
export const PAYMASTER_API_KEY = import.meta.env.VITE_PAYMASTER_API_KEY || "";

export default {
  NERO_RPC_URL,
  BUNDLER_URL,
  PAYMASTER_URL,
  ENTRYPOINT_ADDRESS,
  ACCOUNT_FACTORY_ADDRESS,
  LOTTERY_CONTRACT_ADDRESS,
  TOKEN_PAYMASTER_ADDRESS,
  PAYMASTER_API_KEY
};