import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { ethers, BigNumber } from "ethers";
import { UserOperationBuilder, Presets, IUserOperationMiddlewareCtx, ISendUserOperationResponse } from "userop";
import { OpToJSON } from "userop/dist/utils";
import { useAAWallet } from "./AAWalletContext";
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

export const PaymasterProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const {
    simpleAccount,
    isAAWalletInitialized,
    sendUserOp: aaSendUserOp,
  } = useAAWallet();

  const [selectedPaymasterType, setSelectedPaymasterTypeInternal] =
    useState<PaymasterType>(PaymasterType.FREE_GAS); // 默認設置為 FREE_GAS
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
        return userOpBuilder;
      }

      if (selectedPaymasterType === PaymasterType.NATIVE) {
        (userOpBuilder as any).setPaymasterOptions({ type: "none" });
        return userOpBuilder;
      }

      if (!PAYMASTER_RPC_URL || !PAYMASTER_API_KEY) {
        // This part implicitly handles fallback if FREE_GAS is selected but URL/Key are missing
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
            (userOpBuilder as any).setPaymasterOptions({ type: "none" });
            return userOpBuilder;
        }
      } else {
        // This case should ideally not be hit if selectedPaymasterType is FREE_GAS and URL/Key are present
        // but if selectedPaymasterType is somehow invalid or TOKEN without a selectedToken.
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
      return;
    }
    setIsLoadingTokensState(true);
    setError(null);
    setNativeTokenPaymasterInfo(null);
    let currentIsFreeGasAvailable = false;
    try {
      if (!PAYMASTER_RPC_URL || !PAYMASTER_API_KEY || !simpleAccount) {
        setSupportedTokens([
            { address: ethers.constants.AddressZero, symbol: NATIVE_CURRENCY_SYMBOL, decimals: NATIVE_CURRENCY_DECIMALS, type: -1 },
            { address: USDC_TOKEN_ADDRESS, symbol: "USDC", decimals: USDC_DECIMALS, price: 1, type: 2 }
        ]);
        currentIsFreeGasAvailable = !!(PAYMASTER_RPC_URL && PAYMASTER_API_KEY);
        setIsFreeGasAvailableState(currentIsFreeGasAvailable);
        return;
      }

      const baseBuilder = simpleAccount.execute(
        ethers.constants.AddressZero,
        BigNumber.from(0),
        "0x"
      );

      // Use a temporary builder for paymaster options to avoid altering selectedPaymasterType prematurely
      // For pm_supported_tokens, usually you'd want to know all options,
      // so using a neutral or common paymaster type for the call itself might be better,
      // or simply using the currently selected one if the paymaster service is robust.
      // The current applyPaymasterToBuilder depends on selectedPaymasterType.
      const builderWithPaymasterOptions = await applyPaymasterToBuilder(baseBuilder);
      const opForTokenFetch = builderWithPaymasterOptions.getOp();

      opForTokenFetch.nonce = await simpleAccount.getSenderNonce();
      opForTokenFetch.initCode = await simpleAccount.getSenderInitCode();

      if (BigNumber.from(opForTokenFetch.callGasLimit).isZero()) opForTokenFetch.callGasLimit = BigNumber.from(21000);
      if (BigNumber.from(opForTokenFetch.verificationGasLimit).isZero()) opForTokenFetch.verificationGasLimit = BigNumber.from(100000);
      if (BigNumber.from(opForTokenFetch.preVerificationGas).isZero()) opForTokenFetch.preVerificationGas = BigNumber.from(50000);


      const rpcFriendlyUserOp = OpToJSON(opForTokenFetch);

      const pmProvider = new ethers.providers.JsonRpcProvider(PAYMASTER_RPC_URL);
      const rawRpcResponse = await pmProvider.send("pm_supported_tokens", [
          rpcFriendlyUserOp,
          PAYMASTER_API_KEY,
          ENTRYPOINT_ADDRESS
      ]);

      const paymasterResponseData = (typeof rawRpcResponse === 'object' && rawRpcResponse !== null && 'result' in rawRpcResponse)
        ? rawRpcResponse.result
        : rawRpcResponse;

      if (!paymasterResponseData) {
        throw new Error("Invalid or empty response structure from pm_supported_tokens");
      }


      let receivedRawTokens: any[] = [];
      if (paymasterResponseData.tokens && Array.isArray(paymasterResponseData.tokens)) {
          receivedRawTokens = paymasterResponseData.tokens;
      }

      if (paymasterResponseData.native) {
        setNativeTokenPaymasterInfo(paymasterResponseData.native as NativeTokenPaymasterInfo);
      }
      currentIsFreeGasAvailable = paymasterResponseData?.freeGas ?? !!(PAYMASTER_RPC_URL && PAYMASTER_API_KEY);
      setIsFreeGasAvailableState(currentIsFreeGasAvailable);


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
            // If current default is FREE_GAS, we don't want to clear selectedToken unless it's explicitly NATIVE.
            // This part of logic might need review if FREE_GAS is the strict default.
            // For now, if FREE_GAS is selected, selectedToken should be null.
            if(selectedPaymasterType === PaymasterType.FREE_GAS || selectedPaymasterType === PaymasterType.NATIVE) {
                setSelectedTokenInternal(null);
            }
      }
    } catch (err: any) {
      let specificErrorMessage = "Failed to fetch tokens.";
        if (err) {
            const messagesToCheck = [];
            if (err.message && typeof err.message === 'string') messagesToCheck.push(err.message);
            if (err.error && err.error.message && typeof err.error.message === 'string') messagesToCheck.push(err.error.message);
            if (err.reason && typeof err.reason === 'string') messagesToCheck.push(err.reason);

            for (const msg of messagesToCheck) {
                if (msg.includes('AA') || msg.includes('execution reverted') || msg.includes('user operation') || msg.includes('EntryPoint') || msg.includes('paymaster')) {
                    specificErrorMessage = msg;
                    break;
                }
            }
            if (specificErrorMessage === "Failed to fetch tokens." && err.data && typeof err.data === 'string') {
                if (err.data.startsWith('0x08c379a0')) {
                    try {
                        const reason = ethers.utils.defaultAbiCoder.decode(['string'], ethers.utils.hexDataSlice(err.data, 4))[0];
                        specificErrorMessage = `Reverted: ${reason}`;
                    } catch (e) {
                        specificErrorMessage = `Reverted with data: ${err.data}`;
                    }
                } else if (err.data.startsWith('0x4e487b71')) {
                     try {
                        const code = ethers.utils.defaultAbiCoder.decode(['uint256'], ethers.utils.hexDataSlice(err.data, 4))[0];
                        specificErrorMessage = `Panic: ${code.toString()}`;
                    } catch (e) {
                        specificErrorMessage = `Panic with data: ${err.data}`;
                    }
                } else {
                    specificErrorMessage = `Transaction failed with data: ${err.data}`;
                }
            } else if (specificErrorMessage === "Failed to fetch tokens." && messagesToCheck.length > 0) {
                specificErrorMessage = messagesToCheck[0];
            } else if (specificErrorMessage === "Failed to fetch tokens." && typeof err === 'string') {
                specificErrorMessage = err;
            }
        }
      console.error("PaymasterContext FetchSupportedTokens Error:", specificErrorMessage, "Raw Error:", err);
      setError(specificErrorMessage);
      setSupportedTokens([
          { address: ethers.constants.AddressZero, symbol: NATIVE_CURRENCY_SYMBOL, decimals: NATIVE_CURRENCY_DECIMALS, type: -1 },
          { address: USDC_TOKEN_ADDRESS, symbol: "USDC", decimals: USDC_DECIMALS, price: 1, type: 2 }
      ]);
      currentIsFreeGasAvailable = false;
      setIsFreeGasAvailableState(currentIsFreeGasAvailable);
      setNativeTokenPaymasterInfo(null);
    } finally {
      setIsLoadingTokensState(false);
      setFetchedTokensOnce(true);
      // if (!currentIsFreeGasAvailable && selectedPaymasterType === PaymasterType.FREE_GAS) {
      //   setSelectedPaymasterTypeInternal(PaymasterType.NATIVE);
      // }
    }
  }, [simpleAccount, selectedPaymasterType, applyPaymasterToBuilder, isLoadingTokensState ]); // selectedPaymasterType is a dependency for applyPaymasterToBuilder


  useEffect(() => {
    if (isAAWalletInitialized && simpleAccount && !fetchedTokensOnce) {
      const performFetch = async () => {
        await fetchSupportedTokens();
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
        // When TOKEN is selected, automatically try to select USDC or the first available token.
        if (supportedTokens.length > 0) { // Check if supportedTokens is populated
            const usdc = supportedTokens.find((t: SupportedToken) => t.address.toLowerCase() === USDC_TOKEN_ADDRESS.toLowerCase() && (t.type === 1 || t.type === 2));
            if (usdc) {
                setSelectedTokenInternal(usdc);
            } else {
                 const firstTokenPayable = supportedTokens.find((t: SupportedToken) => t.type === 1 || t.type === 2);
                 if (firstTokenPayable) {
                    setSelectedTokenInternal(firstTokenPayable);
                 } else {
                    setSelectedTokenInternal(null); // No suitable token found
                 }
            }
        } else {
            setSelectedTokenInternal(null); // No tokens available yet
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
        setSelectedTokenInternal(null); // Should not happen if type is not TOKEN
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
      const errText = "AA Wallet not initialized for token approval for paymaster.";
      console.error("PaymasterContext ApproveToken Error:", errText);
      setError(errText);
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
      let specificErrorMessage = "Failed to approve token for paymaster.";
        if (err) {
            const messagesToCheck = [];
            if (err.message && typeof err.message === 'string') messagesToCheck.push(err.message);
            if (err.error && err.error.message && typeof err.error.message === 'string') messagesToCheck.push(err.error.message);
            if (err.reason && typeof err.reason === 'string') messagesToCheck.push(err.reason);

            for (const msg of messagesToCheck) {
                if (msg.includes('AA') || msg.includes('execution reverted') || msg.includes('user operation') || msg.includes('EntryPoint') || msg.includes('paymaster')) {
                    specificErrorMessage = msg;
                    break;
                }
            }
            if (specificErrorMessage === "Failed to approve token for paymaster." && err.data && typeof err.data === 'string') {
                if (err.data.startsWith('0x08c379a0')) {
                    try {
                        const reason = ethers.utils.defaultAbiCoder.decode(['string'], ethers.utils.hexDataSlice(err.data, 4))[0];
                        specificErrorMessage = `Reverted: ${reason}`;
                    } catch (e) {
                        specificErrorMessage = `Reverted with data: ${err.data}`;
                    }
                } else if (err.data.startsWith('0x4e487b71')) {
                     try {
                        const code = ethers.utils.defaultAbiCoder.decode(['uint256'], ethers.utils.hexDataSlice(err.data, 4))[0];
                        specificErrorMessage = `Panic: ${code.toString()}`;
                    } catch (e) {
                        specificErrorMessage = `Panic with data: ${err.data}`;
                    }
                } else {
                    specificErrorMessage = `Transaction failed with data: ${err.data}`;
                }
            } else if (specificErrorMessage === "Failed to approve token for paymaster." && messagesToCheck.length > 0) {
                specificErrorMessage = messagesToCheck[0];
            } else if (specificErrorMessage === "Failed to approve token for paymaster." && typeof err === 'string') {
                specificErrorMessage = err;
            }
        }
      console.error("PaymasterContext ApproveToken Error:", specificErrorMessage, "Raw Error:", err);
      setError(specificErrorMessage);
      setLoading(false);
      return null;
    }
  };

  const estimateGasCost = useCallback(
    async (builderForGasEst: UserOperationBuilder) => {
      if (!simpleAccount || !simpleAccount.provider || typeof simpleAccount.getSenderNonce !== 'function' || typeof simpleAccount.getSenderInitCode !== 'function') {
        const errText = "Gas estimation environment not ready (SimpleAccount missing public methods for nonce/initCode).";
        console.error("PaymasterContext EstimateGas Error:", errText);
        setError(errText);
        setGasCost({});
        return;
      }
       if (!builderForGasEst) {
          const errText = "Missing UserOperationBuilder for gas estimation.";
          console.error("PaymasterContext EstimateGas Error:", errText);
          setError(errText);
          setGasCost({});
          return;
      }

      setLoading(true);
      setError(null);

      try {
        const builderWithOptions = await applyPaymasterToBuilder(builderForGasEst);
        let opForEstimation = builderWithOptions.getOp();


        const sender = opForEstimation.sender;
        if (sender && sender !== ethers.constants.AddressZero) {
            const currentChainNonce = await simpleAccount.getSenderNonce();
            opForEstimation.nonce = currentChainNonce;
            opForEstimation.initCode = await simpleAccount.getSenderInitCode();
        } else {
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

        await estimateGasLimitsMiddleware(middlewareCtx);

        const { callGasLimit, verificationGasLimit, preVerificationGas } = middlewareCtx.op;


        builderForGasEst.setCallGasLimit(callGasLimit || ethers.constants.Zero);
        builderForGasEst.setVerificationGasLimit(verificationGasLimit || ethers.constants.Zero);
        builderForGasEst.setPreVerificationGas(preVerificationGas || ethers.constants.Zero);

        const displayProvider = new ethers.providers.JsonRpcProvider(RPC_URL);
        const gasPrice = await displayProvider.getGasPrice();

        const totalCalculatedNativeGasUnits = BigNumber.from(callGasLimit || 0)
          .add(BigNumber.from(verificationGasLimit || 0))
          .add(BigNumber.from(preVerificationGas || 0));

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

      } catch (err: any) {
        let detailedError = "An unknown error occurred during gas estimation.";
        if (err) {
            const messagesToCheck = [];
            if (err.message && typeof err.message === 'string') messagesToCheck.push(err.message);
            if (err.error && err.error.message && typeof err.error.message === 'string') messagesToCheck.push(err.error.message);
            if (err.reason && typeof err.reason === 'string') messagesToCheck.push(err.reason);
            if (err.body && typeof err.body === 'string') {
                try {
                    const bodyError = JSON.parse(err.body);
                    if (bodyError.error && bodyError.error.message) {
                        messagesToCheck.push(bodyError.error.message);
                        if (bodyError.error.data && typeof bodyError.error.data === 'string' && bodyError.error.data.startsWith('0x08c379a0')) {
                             messagesToCheck.push(bodyError.error.data);
                        } else if (bodyError.error.data && typeof bodyError.error.data === 'object' && bodyError.error.data.message) {
                            messagesToCheck.push(bodyError.error.data.message);
                        }
                    }
                } catch (parseError) {}
            }


            for (const msg of messagesToCheck) {
                if (msg.includes('AA') || msg.includes('execution reverted') || msg.includes('user operation') || msg.includes('EntryPoint') || msg.includes('paymaster') || msg.includes('gas estimation')) {
                    detailedError = msg;
                    break;
                }
            }

            if (detailedError === "An unknown error occurred during gas estimation." && err.data && typeof err.data === 'string') {
                if (err.data.startsWith('0x08c379a0')) {
                    try {
                        const reason = ethers.utils.defaultAbiCoder.decode(['string'], ethers.utils.hexDataSlice(err.data, 4))[0];
                        detailedError = `Reverted: ${reason}`;
                    } catch (e) {
                        detailedError = `Reverted with data: ${err.data}`;
                    }
                } else if (err.data.startsWith('0x4e487b71')) {
                     try {
                        const code = ethers.utils.defaultAbiCoder.decode(['uint256'], ethers.utils.hexDataSlice(err.data, 4))[0];
                        detailedError = `Panic: ${code.toString()}`;
                    } catch (e) {
                        detailedError = `Panic with data: ${err.data}`;
                    }
                } else {
                    detailedError = `Transaction failed with data: ${err.data}`;
                }
            } else if (detailedError === "An unknown error occurred during gas estimation." && messagesToCheck.length > 0) {
                detailedError = messagesToCheck[0];
            } else if (detailedError === "An unknown error occurred during gas estimation." && typeof err === 'string') {
                detailedError = err;
            }

            if (detailedError.includes("body: ") && detailedError.includes("reason=")) {
                try {
                    const jsonPart = detailedError.substring(detailedError.indexOf("{"), detailedError.lastIndexOf("}") + 1);
                    const parsedBody = JSON.parse(jsonPart);
                    if (parsedBody.error && parsedBody.error.message) {
                        detailedError = parsedBody.error.message;
                         if(parsedBody.error.data && typeof parsedBody.error.data === 'string' && parsedBody.error.data.startsWith('0x08c379a0')) {
                             try {
                                const reason = ethers.utils.defaultAbiCoder.decode(['string'], ethers.utils.hexDataSlice(parsedBody.error.data, 4))[0];
                                detailedError = `Reverted: ${reason}`;
                            } catch (e) {}
                         } else if (parsedBody.error.data && parsedBody.error.data.Reason) {
                            detailedError += ` (Reason: ${parsedBody.error.data.Reason})`;
                         }
                    }
                } catch (e) {}
            }
        }
        console.error("PaymasterContext EstimateGasCost Error:", detailedError, "Raw Error:", err);
        setError(detailedError);
        setGasCost({});
      } finally {
        setLoading(false);
      }
    },
    [simpleAccount, applyPaymasterToBuilder, nativeTokenPaymasterInfo]
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