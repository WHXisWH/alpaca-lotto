import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { BigNumber, ethers } from "ethers";
import { useAAWallet } from "./AAWalletContext";
import { usePaymaster } from "./PaymasterContext";
import LOTTO_ABI_JSON from "../abis/AlpacaLotto.json";
import {
  LOTTERY_CONTRACT_ADDRESS,
  USDC_TOKEN_ADDRESS,
  RPC_URL,
} from "../config";
import { UserOperationBuilder, ISendUserOperationResponse as UserOpSdkResponse } from "userop";
import { UserOperationEventEvent } from "@account-abstraction/contracts/dist/types/EntryPoint";

const ERC20_ABI_MINIMAL = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
];
const LOTTO_ABI = LOTTO_ABI_JSON as any;

const getReadProvider = () => new ethers.providers.JsonRpcProvider(RPC_URL);

export interface Lottery {
  id: number;
  name: string;
  ticketPrice: BigNumber;
  startTime: number;
  endTime: number;
  drawTime: number;
  supportedTokens: string[];
  totalTickets: number;
  prizePool: BigNumber;
  drawn: boolean;
  winners?: string[];
}

export interface OwnedTicketInfo {
  lotteryId: number;
  lotteryName?: string;
  ticketNumbers: number[];
}

interface TransactionState {
  loading: boolean;
  error: string | null;
  successMessage: string | null;
  hash: string | null;
  step: "idle" | "approving" | "purchasing" | "fetchingReceipt";
}

interface LotteryContextType {
  lotteries: Lottery[];
  ownedTicketsInfo: OwnedTicketInfo[];
  fetchLotteries: () => Promise<void>;
  fetchOwnedLotteryTickets: (lotteryId: number) => Promise<void>;
  purchaseTicketsForLottery: (
    lotteryId: number,
    quantity: number
  ) => Promise<string | null>;
  checkAndApproveUSDC: (
    lotteryId: number,
    quantity: number
  ) => Promise<{ approved: boolean; approvalTxHash?: string | null; error?: string }>;
  transaction: TransactionState;
  clearTransactionState: () => void;
  isLotteryOwner: boolean;
  fetchLotteryOwner: () => Promise<void>;
  getLotteryById: (lotteryId: number) => Lottery | undefined;
  selectedLotteryForInfo: Lottery | null;
  setSelectedLotteryForInfo: (lottery: Lottery | null) => void;
}

const LotteryContext = createContext<LotteryContextType | undefined>(undefined);

export const LotteryProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const aaWalletContext = useAAWallet();
  const { applyPaymasterToBuilder } = usePaymaster(); 

  const [lotteries, setLotteries] = useState<Lottery[]>([]);
  const [ownedTicketsInfo, setOwnedTicketsInfo] = useState<OwnedTicketInfo[]>(
    []
  );
  const [isLotteryOwner, setIsLotteryOwner] = useState<boolean>(false);
  const [transaction, setTransaction] = useState<TransactionState>({
    loading: false,
    error: null,
    successMessage: null,
    hash: null,
    step: "idle",
  });
  const [selectedLotteryForInfo, setSelectedLotteryForInfoState] = useState<Lottery | null>(null);

  const getLotteryContractReader = useCallback(() => {
    const readerProvider = getReadProvider();
    return new ethers.Contract(
      LOTTERY_CONTRACT_ADDRESS,
      LOTTO_ABI,
      readerProvider
    );
  }, []);

  const setSelectedLotteryForInfo = useCallback((lottery: Lottery | null) => {
    setSelectedLotteryForInfoState(lottery);
  }, []);

  const clearTransactionState = useCallback(() => {
    setTransaction({
      loading: false,
      error: null,
      successMessage: null,
      hash: null,
      step: "idle",
    });
  }, []);

  const fetchLotteries = useCallback(async () => {
    const contract = getLotteryContractReader();
    if (!contract) return;
    let initialSelectedLottery: Lottery | null = null;
    try {
      setTransaction((prev) => ({ ...prev, loading: true, error: null, successMessage: null, step: "idle" }));
      const fetchedLotteries: Lottery[] = [];
      const lotteryCountBN = await contract.lotteryCounter();
      const lotteryCount = lotteryCountBN.toNumber();

      const lotteryPromises: Promise<any>[] = [];
      for (let i = 1; i <= lotteryCount; i++) {
        lotteryPromises.push(contract.getLottery(i));
      }
      const results = await Promise.allSettled(lotteryPromises);

      results.forEach((result, index) => {
        const lotteryId = index + 1;
        if (result.status === "fulfilled" && result.value && result.value.id !== undefined && result.value.id.toNumber() === lotteryId) {
          const lotteryData = result.value;
          fetchedLotteries.push({
            id: lotteryData.id.toNumber(),
            name: lotteryData.name,
            ticketPrice: lotteryData.ticketPrice,
            startTime: lotteryData.startTime.toNumber(),
            endTime: lotteryData.endTime.toNumber(),
            drawTime: lotteryData.drawTime.toNumber(),
            supportedTokens: lotteryData.supportedTokens,
            totalTickets: lotteryData.totalTickets.toNumber(),
            prizePool: lotteryData.prizePool,
            drawn: lotteryData.drawn,
            winners: lotteryData.winners,
          });
        } else {
          console.warn(`Failed to fetch or validate lottery with ID ${lotteryId}:`, result.status === "rejected" ? result.reason : "Invalid data");
        }
      });
      
      const sortedLotteries = fetchedLotteries.sort((a, b) => a.id - b.id);
      setLotteries(sortedLotteries);

      if (sortedLotteries.length > 0) {
        const now = new Date().getTime() / 1000;
        initialSelectedLottery = sortedLotteries.find(l => l.endTime > now && l.startTime <= now) || 
                                sortedLotteries.sort((a,b) => b.endTime - a.endTime)[0] || // Fallback to latest end time
                                sortedLotteries[0]; // Fallback to first
        setSelectedLotteryForInfo(initialSelectedLottery);
      } else {
        setSelectedLotteryForInfo(null);
      }

    } catch (error: any) {
      console.error("Failed to fetch lotteries:", error);
      setTransaction((prev) => ({ ...prev, error: error?.message || "Failed to fetch lotteries" }));
      setSelectedLotteryForInfo(null);
    } finally {
        setTransaction((prev) => ({ ...prev, loading: false }));
    }
  }, [getLotteryContractReader, setSelectedLotteryForInfo]);

  const getLotteryById = useCallback((lotteryId: number) => {
    return lotteries.find(l => l.id === lotteryId);
  }, [lotteries]);


  const fetchOwnedLotteryTickets = useCallback(
    async (lotteryId: number) => {
      const contract = getLotteryContractReader();
      if (!contract || !aaWalletContext.aaWalletAddress) return;
      if (lotteryId === 0) return;
      try {
        const ticketNumbersRaw: BigNumber[] = await contract.getUserTickets(
          aaWalletContext.aaWalletAddress,
          lotteryId
        );
        const ticketNumbers = ticketNumbersRaw.map((bn: BigNumber) =>
          bn.toNumber()
        );
        setOwnedTicketsInfo((prev) => {
          const existingEntryIndex = prev.findIndex(
            (entry) => entry.lotteryId === lotteryId
          );
          const lotteryDetails = lotteries.find((l) => l.id === lotteryId);

          const newEntry = { lotteryId, ticketNumbers, lotteryName: lotteryDetails?.name || `ID ${lotteryId}` };

          if (existingEntryIndex > -1) {
            if (JSON.stringify(prev[existingEntryIndex].ticketNumbers.sort()) === JSON.stringify(ticketNumbers.sort())) {
                return prev;
            }
            const updatedPrev = [...prev];
            updatedPrev[existingEntryIndex] = newEntry;
            return updatedPrev;
          } else if (ticketNumbers.length > 0) {
            return [...prev, newEntry];
          }
          return prev;
        });
      } catch (error) {
        console.error(
          `Failed to fetch owned tickets for lottery ${lotteryId}:`,
          error
        );
      }
    },
    [getLotteryContractReader, aaWalletContext.aaWalletAddress, lotteries]
  );

  const checkAndApproveUSDC = async (lotteryId: number, quantity: number) => {
    if (
      !aaWalletContext.aaWalletAddress ||
      !aaWalletContext.simpleAccount ||
      !aaWalletContext.sendUserOp || 
      !applyPaymasterToBuilder 
    ) {
      return { approved: false, error: "AA Wallet or Paymaster context not initialized correctly for approval." };
    }

    const selectedLottery = lotteries.find((l) => l.id === lotteryId);
    if (!selectedLottery) {
      return { approved: false, error: "Lottery details not found for approval." };
    }

    const usdcReader = new ethers.Contract(USDC_TOKEN_ADDRESS, ERC20_ABI_MINIMAL, getReadProvider());
    if (!usdcReader) return { approved: false, error: "USDC contract reader not available." };

    const totalCostUSDC = selectedLottery.ticketPrice.mul(quantity);
    const currentAllowance = await usdcReader.allowance(
      aaWalletContext.aaWalletAddress,
      LOTTERY_CONTRACT_ADDRESS
    );

    if (currentAllowance.gte(totalCostUSDC)) {
      return { approved: true };
    }

    setTransaction({
      loading: true,
      error: null,
      successMessage: "Approving USDC spending...",
      hash: null,
      step: "approving",
    });

    try {
      const usdcContractInterface = new ethers.utils.Interface(ERC20_ABI_MINIMAL);
      const approveAmount = ethers.constants.MaxUint256;
      const approveCallData = usdcContractInterface.encodeFunctionData(
        "approve",
        [LOTTERY_CONTRACT_ADDRESS, approveAmount]
      );

      let approveOpBuilder: UserOperationBuilder = aaWalletContext.simpleAccount.execute(
        USDC_TOKEN_ADDRESS,
        BigNumber.from(0),
        approveCallData
      );

      approveOpBuilder = await applyPaymasterToBuilder(approveOpBuilder); 

      const approveResponse: UserOpSdkResponse = await aaWalletContext.sendUserOp(approveOpBuilder); 
      const approveUserOpHash = approveResponse.userOpHash;


      setTransaction((prev) => ({
        ...prev,
        successMessage: `Approval UserOp sent: ${approveUserOpHash}. Waiting for confirmation...`,
        hash: approveUserOpHash,
        step: "fetchingReceipt",
      }));
      
      const opReceipt: UserOperationEventEvent | null = await approveResponse.wait(); 

      if (opReceipt && opReceipt.args && opReceipt.args.success) {
        setTransaction((prev) => ({
          ...prev,
          loading: false,
          successMessage: `USDC Approved successfully. UserOp: ${approveUserOpHash}`,
          step: "idle",
        }));
        return { approved: true, approvalTxHash: approveUserOpHash };
      } else {
        throw new Error(`Approval transaction failed. UserOpHash: ${approveUserOpHash}. Receipt: ${JSON.stringify(opReceipt)}`);
      }

    } catch (err: any) {
      const readableError = err.error?.message || err.message || "An unknown error occurred during approval.";
      console.error("Approval Error:", err);
      setTransaction({
        loading: false,
        error: readableError,
        successMessage: null,
        hash: transaction.hash, 
        step: "idle",
      });
      return { approved: false, error: readableError };
    }
  };


  const purchaseTicketsForLottery = async (
    lotteryId: number,
    quantity: number
  ): Promise<string | null> => {
    if (
      !aaWalletContext.aaWalletAddress ||
      !aaWalletContext.simpleAccount ||
      !aaWalletContext.sendUserOp || 
      !applyPaymasterToBuilder 
    ) {
      setTransaction({
        loading: false,
        error: "AA Wallet or Paymaster context not initialized correctly.",
        successMessage: null,
        hash: null,
        step: "idle",
      });
      return null;
    }

    const selectedLottery = lotteries.find((l) => l.id === lotteryId);
    if (!selectedLottery) {
      setTransaction({
        loading: false,
        error: "Lottery details not found.",
        successMessage: null,
        hash: null,
        step: "idle",
      });
      return null;
    }
    if (
      !selectedLottery.supportedTokens
        .map((t) => t.toLowerCase())
        .includes(USDC_TOKEN_ADDRESS.toLowerCase())
    ) {
      setTransaction({
        loading: false,
        error: `USDC is not a supported payment token for this lottery.`,
        successMessage: null,
        hash: null,
        step: "idle",
      });
      return null;
    }

    setTransaction({
      loading: true,
      error: null,
      successMessage: "Preparing to purchase tickets...",
      hash: null,
      step: "purchasing",
    });

    try {
      const lotteryContractInterface = new ethers.utils.Interface(LOTTO_ABI);
      const purchaseCallData = lotteryContractInterface.encodeFunctionData(
        "purchaseTickets",
        [lotteryId, USDC_TOKEN_ADDRESS, quantity]
      );

      let purchaseOpBuilder: UserOperationBuilder = aaWalletContext.simpleAccount.execute(
        LOTTERY_CONTRACT_ADDRESS,
        BigNumber.from(0),
        purchaseCallData
      );

      purchaseOpBuilder = await applyPaymasterToBuilder(purchaseOpBuilder); 

      setTransaction((prev) => ({
        ...prev,
        successMessage: `Sending purchase UserOp...`,
      }));
      
      const purchaseResponse: UserOpSdkResponse = await aaWalletContext.sendUserOp(purchaseOpBuilder); 
      const purchaseUserOpHash = purchaseResponse.userOpHash;

      setTransaction((prev) => ({
        ...prev,
        successMessage: `Purchase UserOp sent: ${purchaseUserOpHash}. Waiting for confirmation...`,
        hash: purchaseUserOpHash,
        step: "fetchingReceipt",
      }));
      
      const opReceipt: UserOperationEventEvent | null = await purchaseResponse.wait();

      if (opReceipt && opReceipt.args && opReceipt.args.success) {
        setTransaction({
          loading: false,
          error: null,
          successMessage: `${quantity} ticket(s) for ${selectedLottery.name} purchased! UserOpHash: ${purchaseUserOpHash}`,
          hash: purchaseUserOpHash,
          step: "idle",
        });
        fetchLotteries(); 
        fetchOwnedLotteryTickets(lotteryId); 
        return purchaseUserOpHash;
      } else {
         throw new Error(`Purchase transaction failed. UserOpHash: ${purchaseUserOpHash}. Receipt: ${JSON.stringify(opReceipt)}`);
      }

    } catch (err: any) {
      console.error("Purchase Error:", err);
      const readableError =
        err.error?.message || err.message || "An unknown error occurred during purchase.";
      setTransaction({
        loading: false,
        error: readableError,
        successMessage: null,
        hash: transaction.hash, 
        step: "idle",
      });
      return null;
    }
  };

  const fetchLotteryOwner = useCallback(async () => {
    const contract = getLotteryContractReader();
    if (!contract || !aaWalletContext.eoaAddress) return;
    try {
      const owner = await contract.owner();
      setIsLotteryOwner(
        owner?.toLowerCase() === aaWalletContext.eoaAddress?.toLowerCase()
      );
    } catch (error) {
      console.error("Failed to fetch lottery owner:", error);
    }
  }, [getLotteryContractReader, aaWalletContext.eoaAddress]);

  useEffect(() => {
    if (aaWalletContext.isAAWalletInitialized) {
      fetchLotteries();
      fetchLotteryOwner();
    }
  }, [aaWalletContext.isAAWalletInitialized, fetchLotteryOwner, fetchLotteries]);

  useEffect(() => {
    if (aaWalletContext.isAAWalletInitialized && lotteries.length > 0 && aaWalletContext.aaWalletAddress) {
      lotteries.forEach((lottery) => {
        if (lottery.id > 0) { 
          fetchOwnedLotteryTickets(lottery.id);
        }
      });
    }
  }, [
    aaWalletContext.isAAWalletInitialized,
    aaWalletContext.aaWalletAddress,
    lotteries, 
    fetchOwnedLotteryTickets,
  ]);

  return (
    <LotteryContext.Provider
      value={{
        lotteries,
        ownedTicketsInfo,
        fetchLotteries,
        fetchOwnedLotteryTickets,
        purchaseTicketsForLottery,
        checkAndApproveUSDC,
        transaction,
        clearTransactionState,
        isLotteryOwner,
        fetchLotteryOwner,
        getLotteryById,
        selectedLotteryForInfo,
        setSelectedLotteryForInfo,
      }}
    >
      {children}
    </LotteryContext.Provider>
  );
};

export const useLottery = (): LotteryContextType => {
  const context = useContext(LotteryContext);
  if (context === undefined) {
    throw new Error("useLottery must be used within a LotteryProvider");
  }
  return context;
};