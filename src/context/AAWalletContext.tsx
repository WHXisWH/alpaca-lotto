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
} from "../config";

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
  initializeAAWallet: (
    eoaAddr: string,
    eoaSign: EthersSigner,
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
}

const defaultProvider = new ethers.providers.JsonRpcProvider(RPC_URL);

const AAWalletContext = createContext<AAWalletContextType | undefined>(
  undefined
);

export const AAWalletProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [eoaAddress, setEoaAddress] = useState<string | undefined>(undefined);
  const [eoaSigner, setEoaSigner] = useState<EthersSigner | undefined>(
    undefined
  );
  const [aaWalletAddress, setAaWalletAddress] = useState<string | undefined>(
    undefined
  );
  const [simpleAccount, setSimpleAccount] = useState<
    SimpleAccount | undefined
  >(undefined);
  const [client, setClient] = useState<Client | undefined>(undefined);
  const [provider, setProvider] =
    useState<ethers.providers.Provider>(defaultProvider);
  const [loading, setLoading] = useState<boolean>(false);
  const [isAAWalletInitialized, setIsAAWalletInitialized] =
    useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const initializeAAWallet = useCallback(
    async (
        eoaAddr: string,
        connectedEoaSigner: EthersSigner,
        ) => {
      if (!eoaAddr || !connectedEoaSigner) {
        setError(
          "EOA address or ethers signer not provided for AA wallet initialization."
        );
        setIsAAWalletInitialized(false);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      setEoaAddress(eoaAddr);
      setEoaSigner(connectedEoaSigner);
      const currentProvider =
        connectedEoaSigner.provider || defaultProvider;
      setProvider(currentProvider);
      try {
        const _client = await Client.init(
          RPC_URL,
          {
            overrideBundlerRpc: BUNDLER_RPC_URL,
            entryPoint: ENTRYPOINT_ADDRESS,
          }
        );
        setClient(_client);

        const neroPaymasterMiddlewareInstance = Presets.Middleware.neroPaymaster();

        const optsForSimpleAccount: IPresetBuilderOpts = {
            entryPoint: ENTRYPOINT_ADDRESS,
            factory: ACCOUNT_FACTORY_ADDRESS,
            overrideBundlerRpc: BUNDLER_RPC_URL,
            paymasterMiddleware: neroPaymasterMiddlewareInstance,
        };
        
        console.log(
          "AAWalletContext: Initializing SimpleAccount with opts:", 
          JSON.stringify({
            entryPoint: optsForSimpleAccount.entryPoint,
            factory: optsForSimpleAccount.factory,
            overrideBundlerRpc: optsForSimpleAccount.overrideBundlerRpc,
            paymasterMiddlewareExists: !!optsForSimpleAccount.paymasterMiddleware,
          }, null, 2)
        );
        
        const simpleAccountBuilder =
          await SimpleAccount.init(
            connectedEoaSigner,
            RPC_URL,
            optsForSimpleAccount
          );
        setSimpleAccount(simpleAccountBuilder);
        const _aaWalletAddress = await simpleAccountBuilder.getSender();
        console.log("AAWalletContext: SimpleAccount initialized. AA Wallet Address:", _aaWalletAddress);
        setAaWalletAddress(_aaWalletAddress as `0x${string}`);
        setIsAAWalletInitialized(true);
      } catch (err: any) {
        console.error("Error initializing AA Wallet (AAWalletContext):", err);
        setError(err.message || "Failed to initialize AA Wallet.");
        setIsAAWalletInitialized(false);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const buildUserOp = useCallback(
    async (
      target: string,
      value: ethers.BigNumber,
      callData: string
    ): Promise<IUserOperation> => {
      if (!simpleAccount || !client) {
        throw new Error("AA Wallet not initialized or client missing.");
      }
      const userOpBuilder = simpleAccount.execute(target, value, callData);
      return client.buildUserOperation(userOpBuilder);
    },
    [simpleAccount, client]
  );

  const sendUserOp = useCallback(
    async (
      userOpBuilder: UserOperationBuilder,
      opts?: any
    ): Promise<ISendUserOperationResponse> => {
      if (!client) {
        throw new Error("Client not initialized.");
      }
      return client.sendUserOperation(userOpBuilder, opts);
    },
    [client]
  );

  return (
    <AAWalletContext.Provider
      value={{
        eoaAddress,
        eoaSigner,
        aaWalletAddress,
        simpleAccount,
        client,
        provider,
        loading,
        isAAWalletInitialized,
        error,
        initializeAAWallet,
        buildUserOp,
        sendUserOp,
        clearError,
      }}
    >
      {children}
    </AAWalletContext.Provider>
  );
};

export const useAAWallet = (): AAWalletContextType => {
  const context = useContext(AAWalletContext);
  if (context === undefined) {
    throw new Error("useAAWallet must be used within an AAWalletProvider");
  }
  return context;
};