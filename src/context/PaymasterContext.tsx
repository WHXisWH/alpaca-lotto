// src/context/PaymasterContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { ethers, BigNumber } from "ethers"; // BigNumberish is already covered by BigNumber
import { UserOperationBuilder, Client, Presets, IUserOperationMiddlewareCtx, IUserOperation, ISendUserOperationResponse } from "userop";
// Removed: import { ISendUserOperationResponse } from "userop/dist/types"; // Already imported from userop
import { useAAWallet } from "./AAWalletContext";
// Removed: import { SimpleAccount } from "@/lib/aa/SimpleAccount"; // Not directly used here, simpleAccount comes from useAAWallet
import {
  PAYMASTER_API_KEY,
  PAYMASTER_RPC_URL,
  USDC_TOKEN_ADDRESS,
  USDC_DECIMALS,
  NATIVE_CURRENCY_SYMBOL,
  NATIVE_CURRENCY_DECIMALS,
  // RPC_URL, // Not needed here, simpleAccount.provider should be used
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
}

const PaymasterContext = createContext<PaymasterContextType | undefined>(
  undefined
);

export const PaymasterProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const {
    simpleAccount,
    client: aaClient, // aaClient might not be needed directly in this context if simpleAccount.provider handles bundler calls
    isAAWalletInitialized,
    sendUserOp: aaSendUserOp,
    // buildUserOp: aaBuildUserOp, // Not directly used here
  } = useAAWallet();

  const [selectedPaymasterType, setSelectedPaymasterTypeInternal] =
    useState<PaymasterType>(PaymasterType.NATIVE);
  const [supportedTokens, setSupportedTokens] = useState<SupportedToken[]>([]);
  const [selectedToken, setSelectedTokenInternal] =
    useState<SupportedToken | null>(null);
  const [gasCost, setGasCost] = useState<GasCost>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [isLoadingTokensState, setIsLoadingTokensState] =
    useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isFreeGasAvailableState, setIsFreeGasAvailableState] =
    useState<boolean>(false);

  const clearError = useCallback(() => setError(null), []);

  const fetchSupportedTokens = useCallback(async () => {
    setIsLoadingTokensState(true);
    setError(null);
    if (!PAYMASTER_RPC_URL || !PAYMASTER_API_KEY || !simpleAccount) { // Removed aaClient check as it's not essential for this specific logic if simpleAccount is present
        setSupportedTokens([
            { address: ethers.constants.AddressZero, symbol: NATIVE_CURRENCY_SYMBOL, decimals: NATIVE_CURRENCY_DECIMALS, type: -1 },
            { address: USDC_TOKEN_ADDRESS, symbol: "USDC", decimals: USDC_DECIMALS, price: 1, type: 2 }
        ]);
        setIsFreeGasAvailableState(!!(PAYMASTER_RPC_URL && PAYMASTER_API_KEY));
        setIsLoadingTokensState(false);
        return;
    }

    try {
        const sender = await simpleAccount.getSender();
        const currentNonceBigNumber = ethers.BigNumber.from(await simpleAccount.getNonce());
        const initCode = currentNonceBigNumber.eq(0) ? await simpleAccount.getInitCode() : "0x";


        const minimalUserOp: IUserOperation = {
            sender,
            nonce: currentNonceBigNumber.toHexString(),
            initCode: initCode,
            callData: "0x",
            callGasLimit: "0x0",
            verificationGasLimit: "0x0",
            preVerificationGas: "0x0",
            maxFeePerGas: "0x0",
            maxPriorityFeePerGas: "0x0",
            paymasterAndData: "0x",
            signature: "0x"
        };
        
        const pmProvider = new ethers.providers.JsonRpcProvider(PAYMASTER_RPC_URL);
        const tokensResponse = await pmProvider.send("pm_supported_tokens", [
            minimalUserOp,
            PAYMASTER_API_KEY,
            ENTRYPOINT_ADDRESS
        ]);

        let rawTokens: any[] = [];
        if (tokensResponse && tokensResponse.tokens && Array.isArray(tokensResponse.tokens)) {
            rawTokens = tokensResponse.tokens;
        } else if (Array.isArray(tokensResponse)) {
            rawTokens = tokensResponse;
        } else if (typeof tokensResponse === 'object' && tokensResponse !== null) {
            const possibleTokensArray = Object.values(tokensResponse).find(val => Array.isArray(val));
            if (possibleTokensArray && Array.isArray(possibleTokensArray)) {
                rawTokens = possibleTokensArray as any[];
            }
        }
        
        const parsedTokens: SupportedToken[] = rawTokens.map((token: any) => ({
            address: token.token || token.address,
            decimals: parseInt(token.decimals, 10) || 18,
            symbol: token.symbol || "Unknown",
            type: typeof token.type === 'number' ? token.type : parseInt(token.type, 10),
            price: token.price ? parseFloat(token.price) : undefined,
        }));
        
        setSupportedTokens(parsedTokens);
        setIsFreeGasAvailableState(!!(PAYMASTER_RPC_URL && PAYMASTER_API_KEY));

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
      console.error("Failed to fetch supported tokens from paymaster:", err);
      setError(err.message || "Failed to fetch tokens from paymaster.");
      setSupportedTokens([
          { address: ethers.constants.AddressZero, symbol: NATIVE_CURRENCY_SYMBOL, decimals: NATIVE_CURRENCY_DECIMALS, type: -1 },
          { address: USDC_TOKEN_ADDRESS, symbol: "USDC", decimals: USDC_DECIMALS, price: 1, type: 2 }
      ]);
      setIsFreeGasAvailableState(false);
    } finally {
      setIsLoadingTokensState(false);
    }
  }, [simpleAccount, selectedPaymasterType, selectedToken]); // Removed aaClient from deps

  useEffect(() => {
    if (isAAWalletInitialized && simpleAccount) {
      fetchSupportedTokens();
    }
  }, [isAAWalletInitialized, simpleAccount, fetchSupportedTokens]);

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

  const applyPaymasterToBuilder = useCallback(
    async (
      userOpBuilder: UserOperationBuilder,
    ): Promise<UserOperationBuilder> => {
      
      if (typeof (userOpBuilder as any).setPaymasterOptions !== 'function') {
        console.error("UserOperationBuilder instance does not have setPaymasterOptions method. Paymaster integration will likely fail.");
        return userOpBuilder; 
      }

      if (selectedPaymasterType === PaymasterType.NATIVE) {
        (userOpBuilder as any).setPaymasterOptions({ type: "none" }); 
        return userOpBuilder;
      }

      if (!PAYMASTER_RPC_URL || !PAYMASTER_API_KEY) {
        console.warn("Paymaster RPC URL or API Key is missing. Falling back to native gas.");
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
            console.warn(`Selected token ${selectedToken.symbol} does not have a valid paymaster type (1 or 2). Falling back to native gas.`);
            (userOpBuilder as any).setPaymasterOptions({ type: "none" });
            return userOpBuilder;
        }
      } else {
        console.warn("Unsupported paymaster type or missing token for token paymaster. Falling back to native gas.");
        (userOpBuilder as any).setPaymasterOptions({ type: "none" });
        return userOpBuilder;
      }
      
      (userOpBuilder as any).setPaymasterOptions(paymasterOpts);
      return userOpBuilder;
    },
    [selectedPaymasterType, selectedToken]
  );

  const approveTokenForPaymaster = async (
    tokenAddress: string,
    amount: BigNumber,
    spenderAddress: string 
  ): Promise<ISendUserOperationResponse | null> => {
    if (!simpleAccount || !aaSendUserOp ) { // Removed aaBuildUserOp as it's not directly used; simpleAccount.execute creates builder
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
      console.error("Failed to approve token for paymaster:", err);
      setError(err.message || "Failed to approve token for paymaster.");
      setLoading(false);
      return null;
    }
  };

  const estimateGasCost = useCallback(
    async (builderForGasEst: UserOperationBuilder) => {
      if (!simpleAccount || !simpleAccount.provider) { 
        setGasCost({});
        setError("Gas estimation environment not ready (simpleAccount or its provider missing).");
        return;
      }
       if (!builderForGasEst) {
          setGasCost({});
          setError("Missing UserOperationBuilder for gas estimation.");
          return;
      }

      setLoading(true);
      setError(null);
      try {
        
        const builderWithPaymasterApplied = await applyPaymasterToBuilder(builderForGasEst);
        const opToEstimate = await builderWithPaymasterApplied.getOp(); // getOp() should be available on UserOperationBuilder

        // The provider for estimateUserOperationGas should be simpleAccount.provider,
        // as it's the BundlerJsonRpcProvider configured in SimpleAccount.
        const estimateGasLimitsMiddleware = Presets.Middleware.estimateUserOperationGas(simpleAccount.provider as ethers.providers.JsonRpcProvider);
        
        const chainId = (await (simpleAccount.provider as ethers.providers.JsonRpcProvider).getNetwork()).chainId;

        const middlewareCtx: IUserOperationMiddlewareCtx = {
          op: opToEstimate,
          entryPoint: ENTRYPOINT_ADDRESS,
          chainId: chainId,
          paymasterOptions: (builderWithPaymasterApplied as any).paymasterOptions || {}, 
          getUserOpHash: () => { 
            throw new Error("getUserOpHash not implemented in this estimation context"); 
          }
        };
        
        await estimateGasLimitsMiddleware(middlewareCtx); 

        const { callGasLimit, verificationGasLimit, preVerificationGas } = middlewareCtx.op;

        if (!callGasLimit || !verificationGasLimit || !preVerificationGas) {
            throw new Error("Gas limits were not properly estimated by Presets.Middleware.");
        }
        
        builderForGasEst.setCallGasLimit(callGasLimit);
        builderForGasEst.setVerificationGasLimit(verificationGasLimit);
        builderForGasEst.setPreVerificationGas(preVerificationGas);

        const gasPrice = await (simpleAccount.provider as ethers.providers.JsonRpcProvider).getGasPrice();

        const totalNativeGasUnits = BigNumber.from(callGasLimit)
          .add(BigNumber.from(verificationGasLimit))
          .add(BigNumber.from(preVerificationGas));
        
        const totalNativeGasCost = totalNativeGasUnits.mul(gasPrice);

        const newGasCost: GasCost = {
          native: {
            raw: totalNativeGasCost,
            formatted: ethers.utils.formatUnits(
              totalNativeGasCost,
              NATIVE_CURRENCY_DECIMALS
            ),
          },
        };

        if (
          selectedPaymasterType === PaymasterType.TOKEN &&
          selectedToken &&
          selectedToken.price &&
          newGasCost.native
        ) {
          const NATIVE_USD_PRICE = 0.1; 
          const nativeCostInUSD = parseFloat(newGasCost.native.formatted) * NATIVE_USD_PRICE;
          
          if (selectedToken.price > 0) {
            const erc20AmountNumber = nativeCostInUSD / selectedToken.price;
            if (isFinite(erc20AmountNumber)) {
              const erc20Raw = ethers.utils.parseUnits(
                erc20AmountNumber.toFixed(selectedToken.decimals),
                selectedToken.decimals
              );
              newGasCost.erc20 = {
                raw: erc20Raw,
                formatted: ethers.utils.formatUnits(
                  erc20Raw,
                  selectedToken.decimals
                ),
                token: selectedToken,
              };
            } else {
                 console.warn("Could not calculate ERC20 gas cost due to non-finite number.");
            }
          }
        }
        setGasCost(newGasCost);
      } catch (err: any) {
        console.error("Error estimating gas cost:", err);
        let detailedError = "An unknown error occurred during gas estimation.";
        if (err.error && err.error.message) {
            detailedError = `Gas Estimation Failed: ${err.error.message}`;
        } else if (err.message) {
            detailedError = `Gas Estimation Failed: ${err.message}`;
        }
        // Check if err.data exists and is an object before accessing err.data.message
        if (err.data && typeof err.data === 'object' && (err.data as any).message) {
            detailedError += ` (Node Error: ${(err.data as any).message})`;
        } else if (err.data && typeof err.data === 'string' && err.data.startsWith('0x08c379a0')) { // Revert reason
             try {
                 const decodedError = new ethers.utils.Interface(["function Error(string)"]).decodeFunctionData("Error", err.data);
                 detailedError += ` (Revert: ${decodedError[0]})`;
             } catch (decodeErr) { /* ignore */ }
        }
        setError(detailedError);
        setGasCost({});
      } finally {
        setLoading(false);
      }
    },
    [simpleAccount, selectedPaymasterType, selectedToken, applyPaymasterToBuilder] 
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