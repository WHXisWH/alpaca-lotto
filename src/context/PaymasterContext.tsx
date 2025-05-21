import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { ethers, BigNumber } from "ethers";
import { UserOperationBuilder, Presets, IUserOperationMiddlewareCtx, IUserOperation, ISendUserOperationResponse } from "userop";
import { OpToJSON } from "userop/dist/utils";
import { useAAWallet } from "./AAWalletContext";
import { SimpleAccount } from "@/lib/aa/SimpleAccount";
import {
  PAYMASTER_API_KEY,
  PAYMASTER_RPC_URL,
  USDC_TOKEN_ADDRESS,
  USDC_DECIMALS,
  NATIVE_CURRENCY_SYMBOL,
  NATIVE_CURRENCY_DECIMALS,
  RPC_URL,
  ENTRYPOINT_ADDRESS,
} from "../config";

export enum PaymasterType {
  NATIVE = "NATIVE",
  FREE_GAS = "FREE_GAS",
  TOKEN = "TOKEN",
}

export interface SupportedToken {
  address: string;
  symbol: string;
  decimals: number;
  price?: number;
  type?: number;
}

export interface NativeTokenPaymasterInfo {
  gas?: string;
  price?: number;
  decimals?: number;
  symbol?: string;
}

export interface GasCost {
  native?: { raw: BigNumber; formatted: string };
  erc20?: { raw: BigNumber; formatted: string; token: SupportedToken };
}

export interface PaymasterContextType {
  selectedPaymasterType: PaymasterType;
  setSelectedPaymasterType: (type: PaymasterType) => void;
  supportedTokens: SupportedToken[];
  selectedToken: SupportedToken | null;
  setSelectedToken: (token: SupportedToken | null) => void;
  applyPaymasterToBuilder: (
    userOpBuilder: UserOperationBuilder,
  ) => Promise<UserOperationBuilder>;
  approveTokenForPaymaster: (
    tokenAddress: string,
    amount: BigNumber,
    spenderAddress: string
  ) => Promise<ISendUserOperationResponse | null >;
  estimateGasCost: (
    builderForGasEst: UserOperationBuilder
  ) => Promise<void>;
  gasCost: GasCost;
  loading: boolean;
  error: string | null;
  clearError: () => void;
  fetchSupportedTokens: () => Promise<void>;
  isFreeGasAvailable?: boolean;
  isLoadingTokens?: boolean;
  nativeTokenPaymasterInfo?: NativeTokenPaymasterInfo | null;
}

const PaymasterContext = createContext<PaymasterContextType | undefined>(
  undefined
);

// Define minimum preVerificationGas based on bundler requirements
const MIN_BUNDLER_PRE_VERIFICATION_GAS = BigNumber.from(50009);
const RECOMMENDED_PRE_VERIFICATION_GAS = BigNumber.from(60000);


export const PaymasterProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const {
    simpleAccount,
    isAAWalletInitialized,
    sendUserOp: aaSendUserOp,
  } = useAAWallet();

  const [selectedPaymasterType, setSelectedPaymasterTypeInternal] =
    useState<PaymasterType>(PaymasterType.NATIVE);
  const [supportedTokens, setSupportedTokens] = useState<SupportedToken[]>([]);
  const [selectedToken, setSelectedTokenInternal] =
    useState<SupportedToken | null>(null);
  const [nativeTokenPaymasterInfo, setNativeTokenPaymasterInfo] = useState<NativeTokenPaymasterInfo | null>(null);
  const [gasCost, setGasCost] = useState<GasCost>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [isLoadingTokensState, setIsLoadingTokensState] =
    useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isFreeGasAvailableState, setIsFreeGasAvailableState] =
    useState<boolean>(false);
  const [fetchedTokensOnce, setFetchedTokensOnce] = useState<boolean>(false);

  const clearError = useCallback(() => setError(null), []);

  const applyPaymasterToBuilder = useCallback(
    async (
      userOpBuilder: UserOperationBuilder,
    ): Promise<UserOperationBuilder> => {
      if (typeof (userOpBuilder as any).setPaymasterOptions !== 'function') {
        console.error("[PaymasterContext] UserOperationBuilder instance does not have setPaymasterOptions method. Paymaster integration will likely fail.");
        return userOpBuilder;
      }

      if (selectedPaymasterType === PaymasterType.NATIVE) {
        (userOpBuilder as any).setPaymasterOptions({ type: "none" });
        return userOpBuilder;
      }

      if (!PAYMASTER_RPC_URL || !PAYMASTER_API_KEY) {
        console.warn("[PaymasterContext] Paymaster RPC URL or API Key is missing. Falling back to native gas.");
        (userOpBuilder as any).setPaymasterOptions({ type: "none" });
        return userOpBuilder;
      }

      let paymasterOpts: any = {
        rpc: PAYMASTER_RPC_URL,
        apikey: PAYMASTER_API_KEY,
      };

      if (selectedPaymasterType === PaymasterType.FREE_GAS) {
        paymasterOpts.type = "0";
      } else if (selectedPaymasterType === PaymasterType.TOKEN && selectedToken) {
        if (selectedToken.type === 1 || selectedToken.type === 2) {
            paymasterOpts.type = selectedToken.type.toString();
            paymasterOpts.token = selectedToken.address;
        } else {
            console.warn(`[PaymasterContext] Selected token ${selectedToken.symbol} does not have a valid paymaster type (1 or 2). Falling back to native gas.`);
            (userOpBuilder as any).setPaymasterOptions({ type: "none" });
            return userOpBuilder;
        }
      } else {
        console.warn("[PaymasterContext] Unsupported paymaster type or missing token for token paymaster. Falling back to native gas.");
        (userOpBuilder as any).setPaymasterOptions({ type: "none" });
        return userOpBuilder;
      }
      (userOpBuilder as any).setPaymasterOptions(paymasterOpts);
      return userOpBuilder;
    },
    [selectedPaymasterType, selectedToken]
  );

  const fetchSupportedTokens = useCallback(async () => {
    if (isLoadingTokensState) {
      console.debug("[PaymasterContext] fetchSupportedTokens: Already loading, skipping.");
      return;
    }
    console.debug("[PaymasterContext] fetchSupportedTokens called. PAYMASTER_RPC_URL:", PAYMASTER_RPC_URL, "PAYMASTER_API_KEY:", PAYMASTER_API_KEY ? "Exists" : "MISSING/EMPTY");
    setIsLoadingTokensState(true);
    setError(null);
    setNativeTokenPaymasterInfo(null); 
    try {
      if (!PAYMASTER_RPC_URL || !PAYMASTER_API_KEY || !simpleAccount) {
        console.warn("[PaymasterContext] fetchSupportedTokens - Missing PAYMASTER_RPC_URL, API_KEY, or simpleAccount. Using fallback tokens.");
        setSupportedTokens([
            { address: ethers.constants.AddressZero, symbol: NATIVE_CURRENCY_SYMBOL, decimals: NATIVE_CURRENCY_DECIMALS, type: -1 },
            { address: USDC_TOKEN_ADDRESS, symbol: "USDC", decimals: USDC_DECIMALS, price: 1, type: 2 }
        ]);
        setIsFreeGasAvailableState(!!(PAYMASTER_RPC_URL && PAYMASTER_API_KEY));
        return;
      }

      const baseBuilder = simpleAccount.execute(
        ethers.constants.AddressZero,
        BigNumber.from(0),
        "0x"
      );

      const builderWithPaymasterOptions = await applyPaymasterToBuilder(baseBuilder);
      const opForTokenFetch = builderWithPaymasterOptions.getOp();

      opForTokenFetch.nonce = await simpleAccount.getSenderNonce();
      opForTokenFetch.initCode = await simpleAccount.getSenderInitCode();

      if (BigNumber.from(opForTokenFetch.callGasLimit).isZero()) opForTokenFetch.callGasLimit = BigNumber.from(21000);
      if (BigNumber.from(opForTokenFetch.verificationGasLimit).isZero()) opForTokenFetch.verificationGasLimit = BigNumber.from(100000);
      if (BigNumber.from(opForTokenFetch.preVerificationGas).isZero()) opForTokenFetch.preVerificationGas = BigNumber.from(50000);


      const rpcFriendlyUserOp = OpToJSON(opForTokenFetch);
      console.debug("[PaymasterContext] fetchSupportedTokens: Sending rpcFriendlyUserOp to pm_supported_tokens:", JSON.stringify(rpcFriendlyUserOp, null, 2));

      const pmProvider = new ethers.providers.JsonRpcProvider(PAYMASTER_RPC_URL);
      const rawRpcResponse = await pmProvider.send("pm_supported_tokens", [
          rpcFriendlyUserOp,
          PAYMASTER_API_KEY,
          ENTRYPOINT_ADDRESS
      ]);
      console.debug("[PaymasterContext] fetchSupportedTokens: Received raw response from pm_supported_tokens:", JSON.stringify(rawRpcResponse, null, 2));

      const paymasterResponseData = (typeof rawRpcResponse === 'object' && rawRpcResponse !== null && 'result' in rawRpcResponse) 
        ? rawRpcResponse.result 
        : rawRpcResponse;

      if (!paymasterResponseData) {
        throw new Error("Invalid or empty response structure from pm_supported_tokens");
      }
      console.debug("[PaymasterContext] fetchSupportedTokens: Parsed paymasterResponseData (accessing .result if exists):", JSON.stringify(paymasterResponseData, null, 2));


      let receivedRawTokens: any[] = [];
      if (paymasterResponseData.tokens && Array.isArray(paymasterResponseData.tokens)) {
          receivedRawTokens = paymasterResponseData.tokens;
      }
      
      if (paymasterResponseData.native) {
        setNativeTokenPaymasterInfo(paymasterResponseData.native as NativeTokenPaymasterInfo);
      }

      setIsFreeGasAvailableState(paymasterResponseData?.freeGas ?? !!(PAYMASTER_RPC_URL && PAYMASTER_API_KEY));


      const parsedTokens: SupportedToken[] = receivedRawTokens.map((token: any) => ({
          address: token.token || token.address,
          decimals: parseInt(token.decimals, 10) || 18,
          symbol: token.symbol || "Unknown",
          type: typeof token.type === 'number' ? token.type : parseInt(token.type, 10) || (token.type === "system" ? 2 : 1),
          price: token.price ? parseFloat(token.price) : undefined,
      }));

      setSupportedTokens(parsedTokens);

      if ((selectedPaymasterType === PaymasterType.TOKEN) && !selectedToken && parsedTokens.length > 0) {
          const usdc = parsedTokens.find((t: SupportedToken) => t.address.toLowerCase() === USDC_TOKEN_ADDRESS.toLowerCase() && (t.type === 1 || t.type === 2));
          if (usdc) setSelectedTokenInternal(usdc);
          else {
              const firstTokenPayable = parsedTokens.find((t: SupportedToken) => t.type === 1 || t.type === 2);
              if (firstTokenPayable) setSelectedTokenInternal(firstTokenPayable);
          }
      } else if (selectedPaymasterType === PaymasterType.NATIVE || selectedPaymasterType === PaymasterType.FREE_GAS) {
            setSelectedTokenInternal(null);
      }
    } catch (err: any) {
      console.error("[PaymasterContext] Failed to fetch supported tokens from paymaster:", err);
      setError(err.message || "Failed to fetch tokens. See console for full error object.");
      setSupportedTokens([
          { address: ethers.constants.AddressZero, symbol: NATIVE_CURRENCY_SYMBOL, decimals: NATIVE_CURRENCY_DECIMALS, type: -1 },
          { address: USDC_TOKEN_ADDRESS, symbol: "USDC", decimals: USDC_DECIMALS, price: 1, type: 2 }
      ]);
      setIsFreeGasAvailableState(false);
      setNativeTokenPaymasterInfo(null);
    } finally {
      setIsLoadingTokensState(false);
    }
  }, [simpleAccount, selectedPaymasterType, selectedToken, applyPaymasterToBuilder, isLoadingTokensState]);


  useEffect(() => {
    console.debug("[PaymasterContext] useEffect for initial token fetch. Conditions:", { isAAWalletInitialized, simpleAccountAvailable: !!simpleAccount, fetchedTokensOnce });
    if (isAAWalletInitialized && simpleAccount && !fetchedTokensOnce) {
      console.debug("[PaymasterContext] Conditions met, calling fetchSupportedTokens from useEffect.");
      const performFetch = async () => {
        try {
          await fetchSupportedTokens();
        } catch (error) {
           console.error("[PaymasterContext] fetchSupportedTokens promise rejected in initial useEffect:", error);
        } finally {
          console.debug("[PaymasterContext] Setting fetchedTokensOnce to true after initial fetch attempt.");
          setFetchedTokensOnce(true);
        }
      };
      performFetch();
    }
  }, [isAAWalletInitialized, simpleAccount, fetchedTokensOnce, fetchSupportedTokens]);


  const handleSetSelectedPaymasterType = (type: PaymasterType) => {
    setSelectedPaymasterTypeInternal(type);
    setError(null);
    setGasCost({});
    if (type === PaymasterType.NATIVE || type === PaymasterType.FREE_GAS) {
      setSelectedTokenInternal(null);
    } else if (type === PaymasterType.TOKEN) {
        if (!selectedToken && supportedTokens.length > 0) {
            const usdc = supportedTokens.find((t: SupportedToken) => t.address.toLowerCase() === USDC_TOKEN_ADDRESS.toLowerCase() && (t.type === 1 || t.type === 2));
            if (usdc) setSelectedTokenInternal(usdc);
            else {
                 const firstTokenPayable = supportedTokens.find((t: SupportedToken) => t.type === 1 || t.type === 2);
                 if (firstTokenPayable) setSelectedTokenInternal(firstTokenPayable);
                 else setSelectedTokenInternal(null);
            }
        } else if (selectedToken && !(selectedToken.type === 1 || selectedToken.type === 2)){
            setSelectedTokenInternal(null);
        }
    }
  };

  const handleSetSelectedToken = (token: SupportedToken | null) => {
    if (selectedPaymasterType === PaymasterType.TOKEN) {
        if (token && (token.type === 1 || token.type === 2)) {
            setSelectedTokenInternal(token);
        } else {
            setSelectedTokenInternal(null);
        }
    } else {
        setSelectedTokenInternal(null);
    }
    setError(null);
    setGasCost({});
  };

  const approveTokenForPaymaster = async (
    tokenAddress: string,
    amount: BigNumber,
    spenderAddress: string
  ): Promise<ISendUserOperationResponse | null> => {
    if (!simpleAccount || !aaSendUserOp ) {
      setError("AA Wallet not initialized for token approval for paymaster.");
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      const tokenContractInterface = new ethers.utils.Interface([
        "function approve(address spender, uint256 amount) returns (bool)",
      ]);
      const callData = tokenContractInterface.encodeFunctionData("approve", [
        spenderAddress,
        amount,
      ]);

      let approvalOpBuilder: UserOperationBuilder = simpleAccount.execute(
        tokenAddress,
        BigNumber.from(0),
        callData
      );

      approvalOpBuilder = await applyPaymasterToBuilder(approvalOpBuilder);

      const response = await aaSendUserOp(approvalOpBuilder);
      setLoading(false);
      return response;

    } catch (err: any) {
      console.error("[PaymasterContext] Failed to approve token for paymaster:", err);
      setError(err.message || "Failed to approve token for paymaster.");
      setLoading(false);
      return null;
    }
  };

  const estimateGasCost = useCallback(
    async (builderForGasEst: UserOperationBuilder) => {
      if (!simpleAccount || !simpleAccount.provider || typeof simpleAccount.getSenderNonce !== 'function' || typeof simpleAccount.getSenderInitCode !== 'function') {
        setError("Gas estimation environment not ready (SimpleAccount missing public methods for nonce/initCode).");
        setGasCost({});
        return;
      }
       if (!builderForGasEst) {
          setError("Missing UserOperationBuilder for gas estimation.");
          setGasCost({});
          return;
      }

      setLoading(true);
      setError(null);
      console.debug("[PaymasterContext] estimateGasCost: Starting estimation...");

      try {
        const builderWithOptions = await applyPaymasterToBuilder(builderForGasEst);
        let opForEstimation = builderWithOptions.getOp();

        console.debug("[PaymasterContext] estimateGasCost: Op from builder before manual nonce/initCode:", JSON.stringify(opForEstimation));

        const sender = opForEstimation.sender;
        if (sender && sender !== ethers.constants.AddressZero) {
            const currentChainNonce = await simpleAccount.getSenderNonce();
            opForEstimation.nonce = currentChainNonce;
            opForEstimation.initCode = await simpleAccount.getSenderInitCode();
            console.debug(`[PaymasterContext] estimateGasCost: Manually set nonce to ${currentChainNonce.toString()} and initCode to ${opForEstimation.initCode} for sender ${sender}`);
        } else {
            console.error("[PaymasterContext] estimateGasCost: Sender is not valid for manual nonce fetching:", sender);
            throw new Error("Invalid sender for gas estimation.");
        }

        const chainId = (await (simpleAccount.provider as ethers.providers.JsonRpcProvider).getNetwork()).chainId;
        const estimateGasLimitsMiddleware = Presets.Middleware.estimateUserOperationGas(simpleAccount.provider as ethers.providers.JsonRpcProvider);

        const middlewareCtx: IUserOperationMiddlewareCtx = {
          op: opForEstimation,
          entryPoint: ENTRYPOINT_ADDRESS,
          chainId: chainId,
          paymasterOptions: (builderWithOptions as any).getPaymasterOptions?.() || {},
          getUserOpHash: () => ethers.utils.keccak256("0xdeadbeef")
        };

        console.debug("[PaymasterContext] estimateGasCost: Calling estimateGasLimitsMiddleware with op:", JSON.stringify(opForEstimation, null, 2));
        await estimateGasLimitsMiddleware(middlewareCtx);

        let { callGasLimit, verificationGasLimit, preVerificationGas } = middlewareCtx.op;

        console.debug(`[PaymasterContext] estimateGasCost: Original estimated preVerificationGas: ${preVerificationGas?.toString()}`);
        let adjustedPreVerificationGas = preVerificationGas ? BigNumber.from(preVerificationGas) : BigNumber.from(0);
        if (adjustedPreVerificationGas.lt(MIN_BUNDLER_PRE_VERIFICATION_GAS)) {
            console.warn(`[PaymasterContext] estimateGasCost: preVerificationGas ${adjustedPreVerificationGas.toString()} is below minimum ${MIN_BUNDLER_PRE_VERIFICATION_GAS.toString()}. Adjusting to ${RECOMMENDED_PRE_VERIFICATION_GAS.toString()}.`);
            adjustedPreVerificationGas = RECOMMENDED_PRE_VERIFICATION_GAS;
        }
        preVerificationGas = adjustedPreVerificationGas; // Use the adjusted value


        if (!callGasLimit || !verificationGasLimit || !preVerificationGas || BigNumber.from(callGasLimit).isZero()) {
            console.warn("[PaymasterContext] estimateGasCost: Gas limits might be invalid after estimation/adjustment.", {callGasLimit: callGasLimit?.toString(), verificationGasLimit: verificationGasLimit?.toString(), preVerificationGas: preVerificationGas?.toString()});
        }

        builderForGasEst.setCallGasLimit(callGasLimit || ethers.constants.Zero);
        builderForGasEst.setVerificationGasLimit(verificationGasLimit || ethers.constants.Zero);
        builderForGasEst.setPreVerificationGas(preVerificationGas || ethers.constants.Zero); // Set the potentially adjusted preVerificationGas


        const displayProvider = new ethers.providers.JsonRpcProvider(RPC_URL);
        const gasPrice = await displayProvider.getGasPrice();
        
        const totalCalculatedNativeGasUnits = BigNumber.from(callGasLimit || 0)
          .add(BigNumber.from(verificationGasLimit || 0))
          .add(BigNumber.from(preVerificationGas || 0)); // Use adjusted preVerificationGas here too
        
        const totalCalculatedNativeGasCost = totalCalculatedNativeGasUnits.mul(gasPrice);

        let finalNativeGasCostRaw = totalCalculatedNativeGasCost;
        let nativeDecimalsToUse = NATIVE_CURRENCY_DECIMALS;

        if (nativeTokenPaymasterInfo && nativeTokenPaymasterInfo.gas && nativeTokenPaymasterInfo.gas !== "0x0" && nativeTokenPaymasterInfo.gas !== "") {
            const paymasterSuggestedGasUnits = BigNumber.from(nativeTokenPaymasterInfo.gas);
            const paymasterSuggestedPrice = nativeTokenPaymasterInfo.price ?? 1; 
             finalNativeGasCostRaw = paymasterSuggestedGasUnits.mul(paymasterSuggestedPrice); 
            if (nativeTokenPaymasterInfo.decimals) {
                nativeDecimalsToUse = nativeTokenPaymasterInfo.decimals;
            }
        }


        const newGasCost: GasCost = {
          native: {
            raw: finalNativeGasCostRaw,
            formatted: ethers.utils.formatUnits(
              finalNativeGasCostRaw,
              nativeDecimalsToUse
            ),
          },
        };

        setGasCost(newGasCost);
        console.debug("[PaymasterContext] estimateGasCost: Estimation successful, gasCost set.");

      } catch (err: any) {
        console.error("[PaymasterContext] estimateGasCost: Error during estimation process:", err);
        let detailedError = "An unknown error occurred during gas estimation.";
        if (err && typeof err === 'object' && 'message' in err) {
           detailedError = `Gas Estimation Failed: ${(err as Error).message}`;
        } else if (typeof err === 'string') {
           detailedError = `Gas Estimation Failed: ${err}`;
        }


        if (err && typeof err === 'object' && 'data' in err) {
            const errorData = (err as any).data;
            if (errorData && typeof errorData === 'object' && 'message' in errorData) {
                 detailedError += ` (Node Error: ${errorData.message})`;
            } else if (typeof errorData === 'string' && errorData.startsWith('0x08c379a0')) {
                 try {
                     const decodedError = new ethers.utils.Interface(["function Error(string)"]).decodeFunctionData("Error", errorData);
                     detailedError += ` (Revert: ${decodedError[0]})`;
                 } catch (decodeErr) { /* ignore */ }
            }
        } else if (err && typeof err === 'object' && 'body' in err) {
             try {
                 const bodyError = JSON.parse((err as any).body);
                 if (bodyError.error && bodyError.error.message) {
                     detailedError = `Gas Estimation Failed: ${bodyError.error.message}`;
                     if (bodyError.error.data && bodyError.error.data.Reason) {
                          detailedError += ` (Reason: ${bodyError.error.data.Reason})`;
                     }
                 }
             } catch (parseError) { /* ignore if body is not JSON */ }
        }
        setError(detailedError);
        setGasCost({});
      } finally {
        setLoading(false);
        console.debug("[PaymasterContext] estimateGasCost: Estimation process finished.");
      }
    },
    [simpleAccount, applyPaymasterToBuilder, selectedPaymasterType, selectedToken, nativeTokenPaymasterInfo]
  );


  return (
    <PaymasterContext.Provider
      value={{
        selectedPaymasterType,
        setSelectedPaymasterType: handleSetSelectedPaymasterType,
        supportedTokens,
        selectedToken,
        setSelectedToken: handleSetSelectedToken,
        applyPaymasterToBuilder,
        approveTokenForPaymaster,
        estimateGasCost,
        gasCost,
        loading: loading || isLoadingTokensState,
        error,
        clearError,
        fetchSupportedTokens,
        isFreeGasAvailable: isFreeGasAvailableState,
        isLoadingTokens: isLoadingTokensState,
        nativeTokenPaymasterInfo,
      }}
    >
      {children}
    </PaymasterContext.Provider>
  );
};

export const usePaymaster = (): PaymasterContextType => {
  const context = useContext(PaymasterContext);
  if (context === undefined) {
    throw new Error("usePaymaster must be used within a PaymasterProvider");
  }
  return context;
};