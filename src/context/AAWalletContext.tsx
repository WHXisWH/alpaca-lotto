import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { ethers, Signer as EthersSigner, BigNumber } from "ethers";
import { Client, UserOperationBuilder, IPresetBuilderOpts, IUserOperation, ISendUserOperationResponse, Presets } from "userop";
import { SimpleAccount } from "@/lib/aa/SimpleAccount";
import {
  RPC_URL,
  ENTRYPOINT_ADDRESS,
  ACCOUNT_FACTORY_ADDRESS,
  BUNDLER_RPC_URL,
  CHAIN_ID,
  CHAIN_NAME,
  NATIVE_CURRENCY_NAME,
  NATIVE_CURRENCY_SYMBOL,
  WEB3AUTH_CLIENT_ID,
  PAYMASTER_RPC_URL,
  PAYMASTER_API_KEY,
} from "../config";
import { Web3Auth } from "@web3auth/modal";
import { CHAIN_NAMESPACES, SafeEventEmitterProvider, UserAuthInfo, ADAPTER_STATUS, WEB3AUTH_NETWORK } from "@web3auth/base";
import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider";


interface AAWalletContextType {
  eoaAddress?: string;
  eoaSigner?: EthersSigner;
  aaWalletAddress?: string;
  simpleAccount?: SimpleAccount;
  client?: Client;
  provider: ethers.providers.Provider;
  loading: boolean;
  isAAWalletInitialized: boolean;
  error?: string | null;
  isSocialLoggedIn: boolean;
  web3authProvider?: SafeEventEmitterProvider | null;
  web3authInstance?: Web3Auth | null;
  initializeAAWallet: (
    eoaAddr: string,
    eoaSign: EthersSigner,
  ) => Promise<void>;
  initializeAAWalletFromSocial: (
    loginProviderHint?: string, 
    email?: string,
  ) => Promise<void>;
  buildUserOp: (
    target: string,
    value: BigNumber,
    callData: string
  ) => Promise<IUserOperation>;
  sendUserOp: (
    userOpOrBuilder: UserOperationBuilder,
    opts?: any
  ) => Promise<ISendUserOperationResponse>;
  clearError: () => void;
  disconnectSocialLogin: () => Promise<void>;
}

const defaultProvider = new ethers.providers.JsonRpcProvider(RPC_URL);

const AAWalletContext = createContext<AAWalletContextType | undefined>(
  undefined
);

export const AAWalletProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [eoaAddress, setEoaAddress] = useState<string | undefined>(undefined);
  const [eoaSigner, setEoaSigner] = useState<EthersSigner | undefined>(undefined);
  const [aaWalletAddress, setAaWalletAddress] = useState<string | undefined>(undefined);
  const [simpleAccount, setSimpleAccount] = useState<SimpleAccount | undefined>(undefined);
  const [client, setClient] = useState<Client | undefined>(undefined);
  const [provider, setProvider] = useState<ethers.providers.Provider>(defaultProvider);
  const [loading, setLoading] = useState<boolean>(false);
  const [isAAWalletInitialized, setIsAAWalletInitialized] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isSocialLoggedIn, setIsSocialLoggedIn] = useState<boolean>(false);
  const [web3Auth, setWeb3Auth] = useState<Web3Auth | null>(null);
  const [web3authProvider, setWeb3authProvider] = useState<SafeEventEmitterProvider | null>(null);

  const clearError = useCallback(() => setError(null), []);
  
  const resetState = useCallback(() => {
    setEoaAddress(undefined);
    setEoaSigner(undefined);
    setAaWalletAddress(undefined);
    setSimpleAccount(undefined);
    setClient(undefined);
    setProvider(defaultProvider);
    setIsAAWalletInitialized(false);
    setIsSocialLoggedIn(false);
    setWeb3authProvider(null);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    const initWeb3Auth = async () => {
      if (!WEB3AUTH_CLIENT_ID || WEB3AUTH_CLIENT_ID === "YOUR_WEB3AUTH_CLIENT_ID_FALLBACK" || WEB3AUTH_CLIENT_ID === "YOUR_WEB3AUTH_CLIENT_ID") {
        const msg = "Web3Auth Client ID is not configured. Social login will not work.";
        console.error(msg); setError(msg); return;
      }
      try {
        const chainConfig = {
          chainNamespace: CHAIN_NAMESPACES.EIP155,
          chainId: `0x${CHAIN_ID.toString(16)}`,
          rpcTarget: RPC_URL,
          displayName: CHAIN_NAME,
          blockExplorerUrl: "https://testnet.neroscan.io",
          ticker: NATIVE_CURRENCY_SYMBOL,
          tickerName: NATIVE_CURRENCY_NAME,
        };

        const privateKeyProvider = new EthereumPrivateKeyProvider({
            config: { chainConfig }
        });

       
        const w3a = new Web3Auth({
          clientId: WEB3AUTH_CLIENT_ID,
          web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_DEVNET,
          privateKeyProvider: privateKeyProvider,
          chainConfig: chainConfig,
          uiConfig: {
            appName: "Alpaca Lotto",
            loginMethodsOrder: ["google", "email_passwordless"],
            mode: "dark",
          },
        });
        

        await w3a.initModal({ modalConfig: {} });
        setWeb3Auth(w3a);

        if (w3a.provider && w3a.status === ADAPTER_STATUS.CONNECTED) {
            setWeb3authProvider(w3a.provider);
        }

      } catch (err: any) {
        console.error("Failed to initialize Web3Auth:", err);
        setError(`Failed to initialize Web3Auth: ${err.message || err.toString()}`);
      }
    };
    initWeb3Auth();
  }, []);

  const initializeAAWallet = useCallback(
    async ( eoaAddr: string, connectedEoaSigner: EthersSigner ) => {
      if (!eoaAddr || !connectedEoaSigner) {
        setError( "EOA address or ethers signer not provided." );
        setIsAAWalletInitialized(false); setLoading(false); return;
      }
      setLoading(true); setError(null); setIsSocialLoggedIn(false);
      setEoaAddress(eoaAddr); setEoaSigner(connectedEoaSigner);
      setProvider(connectedEoaSigner.provider || defaultProvider);
      try {
        const _client = await Client.init( RPC_URL, { overrideBundlerRpc: BUNDLER_RPC_URL, entryPoint: ENTRYPOINT_ADDRESS });
        setClient(_client);
        const paymasterInstance = Presets.Middleware.neroPaymaster(
            PAYMASTER_RPC_URL ? { rpc: PAYMASTER_RPC_URL, apikey: PAYMASTER_API_KEY, type: "0" } : undefined
        );
        const opts: IPresetBuilderOpts = {
            entryPoint: ENTRYPOINT_ADDRESS, factory: ACCOUNT_FACTORY_ADDRESS,
            overrideBundlerRpc: BUNDLER_RPC_URL, paymasterMiddleware: paymasterInstance,
        };
        const aaAccountBuilder = await SimpleAccount.init( connectedEoaSigner, RPC_URL, opts );
        setSimpleAccount(aaAccountBuilder);
        const _aaAddr = await aaAccountBuilder.getSender();
        setAaWalletAddress(_aaAddr as `0x${string}`);
        setIsAAWalletInitialized(true);
      } catch (err: any) {
        console.error("Error initializing AA Wallet (EOA Flow):", err);
        setError(err.message || "Failed to initialize AA Wallet.");
        setIsAAWalletInitialized(false);
      } finally { setLoading(false); }
    },
    []
  );

  const initializeAAWalletFromSocial = useCallback(
    async (loginProviderHint?: string, email?: string) => { 
      if (!web3Auth) {
        setError("Web3Auth not initialized."); setLoading(false); return;
      }
      setLoading(true);
      resetState();

      try {
        const freshW3aProvider = await web3Auth.connect(); 
        
        if (!freshW3aProvider) {
            throw new Error("Web3Auth connect() did not return a provider.");
        }
        setWeb3authProvider(freshW3aProvider);

        if (web3Auth.status !== ADAPTER_STATUS.CONNECTED) {
            throw new Error(`Web3Auth adapter status is not CONNECTED after connect. Status: ${web3Auth.status}`);
        }

        const ethersProvider = new ethers.providers.Web3Provider(freshW3aProvider);
        const socialLoginSigner = ethersProvider.getSigner();
        const signerAddress = await socialLoginSigner.getAddress();
        
        setEoaAddress(signerAddress);
        setEoaSigner(socialLoginSigner);
        setProvider(ethersProvider);

        const _client = await Client.init( RPC_URL, { overrideBundlerRpc: BUNDLER_RPC_URL, entryPoint: ENTRYPOINT_ADDRESS });
        setClient(_client);
        
        const paymasterInstance = Presets.Middleware.neroPaymaster(
            PAYMASTER_RPC_URL ? { rpc: PAYMASTER_RPC_URL, apikey: PAYMASTER_API_KEY, type: "0"} : undefined
        );
        const opts: IPresetBuilderOpts = {
            entryPoint: ENTRYPOINT_ADDRESS, factory: ACCOUNT_FACTORY_ADDRESS,
            overrideBundlerRpc: BUNDLER_RPC_URL, paymasterMiddleware: paymasterInstance,
        };
        const aaAccountBuilder = await SimpleAccount.init( socialLoginSigner, RPC_URL, opts );
        setSimpleAccount(aaAccountBuilder);
        const _aaAddr = await aaAccountBuilder.getSender();
        setAaWalletAddress(_aaAddr as `0x${string}`);
        setIsAAWalletInitialized(true);
        setIsSocialLoggedIn(true);
        
      } catch (err: any) {
        console.error("Social Login: Error during AA Wallet initialization:", err);
        setError(`Social Login Error: ${err.message || err.toString()}`);
        resetState();
        if (web3Auth && web3Auth.status === ADAPTER_STATUS.CONNECTED) {
            try { await web3Auth.logout(); }
            catch (logoutError: any) { console.error("Social Login: Error during auto-logout:", logoutError); }
        }
      } finally { setLoading(false); }
    },
    [web3Auth, resetState]
  );

  const disconnectSocialLogin = useCallback( async () => {
    if (!web3Auth) { 
        resetState();
        return; 
    }
    try { 
      if (web3Auth.status === ADAPTER_STATUS.CONNECTED) { 
        await web3Auth.logout(); 
      }
    } catch (err: any) { 
      setError(err.message || "Failed to logout.");
    } finally {
      resetState();
    }
  }, [web3Auth, resetState]);

  const buildUserOp = useCallback( async ( target: string, value: BigNumber, callData: string ): Promise<IUserOperation> => {
      if (!simpleAccount || !client) { throw new Error("AA Wallet not initialized."); }
      const opBuilder = simpleAccount.execute(target, value, callData);
      return client.buildUserOperation(opBuilder);
    }, [simpleAccount, client] );

  const sendUserOp = useCallback( async ( opBuilder: UserOperationBuilder, opts?: any ): Promise<ISendUserOperationResponse> => {
      if (!client) { throw new Error("Client not initialized."); }
      return client.sendUserOperation(opBuilder, opts);
    }, [client] );

  return (
    <AAWalletContext.Provider
      value={{
        eoaAddress, eoaSigner, aaWalletAddress, simpleAccount, client, provider,
        loading, isAAWalletInitialized, error, isSocialLoggedIn, web3authProvider,
        web3authInstance: web3Auth, initializeAAWallet, initializeAAWalletFromSocial,
        buildUserOp, sendUserOp, clearError, disconnectSocialLogin,
      }}
    >
      {children}
    </AAWalletContext.Provider>
  );
};

export const useAAWallet = (): AAWalletContextType => {
  const context = useContext(AAWalletContext);
  if (context === undefined) { throw new Error("useAAWallet must be used within an AAWalletProvider"); }
  return context;
};