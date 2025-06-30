// src/context/LotteryContext.tsx

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
import { toaster } from "@/components/ui/toaster";
import {
  LOTTERY_CONTRACT_ADDRESS,
  USDC_TOKEN_ADDRESS,
  RPC_URL,
} from "../config";
import { UserOperationBuilder, ISendUserOperationResponse as UserOpSdkResponse } from "userop";
import { UserOperationEventEvent } from "@account-abstraction/contracts/dist/types/EntryPoint";
import { achievementService, AchievementKey } from '@/services/achievementService';

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
  winningTickets?: BigNumber[];
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
  step: "idle" | "approving" | "purchasing" | "claiming" | "fetchingReceipt" | "dailyCheckIn";
}

interface LotteryContextType {
  lotteries: Lottery[];
  ownedTicketsInfo: OwnedTicketInfo[];
  fetchLotteries: () => Promise<void>;
  fetchLotteryDetails: (lotteryId: number) => Promise<Lottery | null>;
  fetchOwnedLotteryTickets: (lotteryId: number) => Promise<void>;
  purchaseTicketsForLottery: (
    lotteryId: number,
    quantity: number
  ) => Promise<string | null>;
  purchaseTicketsWithPLT: (
    lotteryId: number,
    quantity: number
  ) => Promise<string | null>;
  purchaseTicketsWithReferral: (
    lotteryId: number,
    quantity: number,
    referrer: string
  ) => Promise<string | null>;
  claimPrizeForLottery: (
    lotteryId: number
  ) => Promise<string | null>;
  dailyCheckIn: () => Promise<string | null>;
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
  const [ownedTicketsInfo, setOwnedTicketsInfo] = useState<OwnedTicketInfo[]>([]);
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
  
   const getLotteryContractWithSigner = useCallback(() => {
    if (!aaWalletContext.simpleAccount?.provider) return null;
    return new ethers.Contract(
      LOTTERY_CONTRACT_ADDRESS,
      LOTTO_ABI,
      aaWalletContext.simpleAccount.provider
    );
  }, [aaWalletContext.simpleAccount]);

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
            winningTickets: lotteryData.winningTickets,
          });
        }
      });

      const sortedLotteries = fetchedLotteries.sort((a, b) => a.id - b.id);
      setLotteries(sortedLotteries);

      if (sortedLotteries.length > 0) {
        const now = new Date().getTime() / 1000;
        initialSelectedLottery = sortedLotteries.find(l => l.endTime > now && l.startTime <= now && !l.drawn) ||
                                sortedLotteries.find(l => !l.drawn) ||
                                sortedLotteries.sort((a,b) => b.drawTime - a.drawTime)[0] ||
                                sortedLotteries[0];
        setSelectedLotteryForInfo(initialSelectedLottery);
      } else {
        setSelectedLotteryForInfo(null);
      }

    } catch (error: any) {
      setTransaction((prev) => ({ ...prev, error: error?.message || "Failed to fetch lotteries" }));
      setSelectedLotteryForInfo(null);
    } finally {
        setTransaction((prev) => ({ ...prev, loading: false }));
    }
  }, [getLotteryContractReader, setSelectedLotteryForInfo]);

  const fetchLotteryDetails = useCallback(async (lotteryId: number): Promise<Lottery | null> => {
    const contract = getLotteryContractReader();
    try {
        const lotteryData = await contract.getLottery(lotteryId);
        const formattedLottery = {
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
            winningTickets: lotteryData.winningTickets,
        };
        
        setLotteries(prev => {
            const index = prev.findIndex(l => l.id === lotteryId);
            if (index > -1) {
                const updated = [...prev];
                updated[index] = formattedLottery;
                return updated;
            }
            return [...prev, formattedLottery].sort((a,b) => a.id - b.id);
        });

        setSelectedLotteryForInfoState(current => current?.id === lotteryId ? formattedLottery : current);

        return formattedLottery;
    } catch (error) {
        return null;
    }
  }, [getLotteryContractReader]);

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

  const _purchaseTicketsInternal = async (
    lotteryId: number,
    quantity: number,
    paymentMethod: 'USDC' | 'PLT',
    referrer?: string
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

    setTransaction({
      loading: true,
      error: null,
      successMessage: `Preparing to purchase tickets with ${paymentMethod}...`,
      hash: null,
      step: "purchasing",
    });

    try {
      const lotteryContractInterface = new ethers.utils.Interface(LOTTO_ABI);
      let purchaseCallData: string;

      if (paymentMethod === 'PLT') {
        purchaseCallData = lotteryContractInterface.encodeFunctionData("purchaseTicketsWithPLT", [lotteryId, quantity]);
      } else {
        if (referrer && ethers.utils.isAddress(referrer)) {
          purchaseCallData = lotteryContractInterface.encodeFunctionData("purchaseTicketsWithReferral", [lotteryId, USDC_TOKEN_ADDRESS, quantity, referrer]);
        } else {
          purchaseCallData = lotteryContractInterface.encodeFunctionData("purchaseTickets", [lotteryId, USDC_TOKEN_ADDRESS, quantity]);
        }
      }

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

  const purchaseTicketsForLottery = async (
    lotteryId: number,
    quantity: number
  ): Promise<string | null> => {
    return _purchaseTicketsInternal(lotteryId, quantity, 'USDC');
  };

  const purchaseTicketsWithPLT = async (
    lotteryId: number,
    quantity: number
  ): Promise<string | null> => {
    return _purchaseTicketsInternal(lotteryId, quantity, 'PLT');
  };

  const purchaseTicketsWithReferral = async (
    lotteryId: number,
    quantity: number,
    referrer: string
  ): Promise<string | null> => {
    return _purchaseTicketsInternal(lotteryId, quantity, 'USDC', referrer);
  };

  const claimPrizeForLottery = async (
    lotteryId: number
  ): Promise<string | null> => {
     if (
      !aaWalletContext.aaWalletAddress ||
      !aaWalletContext.simpleAccount ||
      !aaWalletContext.sendUserOp ||
      !applyPaymasterToBuilder
    ) {
      setTransaction({
        loading: false,
        error: "AA Wallet or Paymaster context not initialized correctly for claiming prize.",
        successMessage: null,
        hash: null,
        step: "idle",
      });
      return null;
    }

    setTransaction({
      loading: true,
      error: null,
      successMessage: "Preparing to claim prize...",
      hash: null,
      step: "claiming",
    });

    try {
      const lotteryContractInterface = new ethers.utils.Interface(LOTTO_ABI);
      const claimCallData = lotteryContractInterface.encodeFunctionData(
        "claimPrize",
        [lotteryId]
      );

      let claimOpBuilder: UserOperationBuilder = aaWalletContext.simpleAccount.execute(
        LOTTERY_CONTRACT_ADDRESS,
        BigNumber.from(0),
        claimCallData
      );

      claimOpBuilder = await applyPaymasterToBuilder(claimOpBuilder);

      setTransaction((prev) => ({
        ...prev,
        successMessage: `Sending claim prize UserOp...`,
      }));

      const claimResponse: UserOpSdkResponse = await aaWalletContext.sendUserOp(claimOpBuilder);
      const claimUserOpHash = claimResponse.userOpHash;

      setTransaction((prev) => ({
        ...prev,
        successMessage: `Claim prize UserOp sent: ${claimUserOpHash}. Waiting for confirmation...`,
        hash: claimUserOpHash,
        step: "fetchingReceipt",
      }));

      const opReceipt: UserOperationEventEvent | null = await claimResponse.wait();

      if (opReceipt && opReceipt.args && opReceipt.args.success) {
         setTransaction({
          loading: false,
          error: null,
          successMessage: `Prize claimed successfully for Lottery ID ${lotteryId}! UserOpHash: ${claimUserOpHash}`,
          hash: claimUserOpHash,
          step: "idle",
        });
        fetchLotteries();
        return claimUserOpHash;
      } else {
        throw new Error(`Prize claim transaction failed. UserOpHash: ${claimUserOpHash}. Receipt: ${JSON.stringify(opReceipt)}`);
      }

    } catch (err: any) {
      const readableError =
        err.error?.message || err.message || "An unknown error occurred during prize claim.";
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
  
  const dailyCheckIn = async (): Promise<string | null> => {
    if (
     !aaWalletContext.aaWalletAddress ||
     !aaWalletContext.simpleAccount ||
     !aaWalletContext.sendUserOp ||
     !applyPaymasterToBuilder
   ) {
     setTransaction({ loading: false, error: "AA Wallet not initialized.", successMessage: null, hash: null, step: "idle" });
     return null;
   }

   setTransaction({ loading: true, error: null, successMessage: "Preparing for daily check-in...", hash: null, step: "dailyCheckIn" });

   try {
       const lotteryContractInterface = new ethers.utils.Interface(LOTTO_ABI);
       const callData = lotteryContractInterface.encodeFunctionData("dailyCheckIn");

       // 修正：明確 opBuilder 的類型為 UserOperationBuilder
       let opBuilder: UserOperationBuilder = aaWalletContext.simpleAccount.execute(LOTTERY_CONTRACT_ADDRESS, 0, callData);
       opBuilder = await applyPaymasterToBuilder(opBuilder);

       setTransaction(prev => ({ ...prev, successMessage: "Sending daily check-in transaction..." }));
       const response = await aaWalletContext.sendUserOp(opBuilder);
       setTransaction(prev => ({ ...prev, successMessage: `Transaction sent: ${response.userOpHash}. Waiting for confirmation...`, hash: response.userOpHash, step: 'fetchingReceipt' }));

       const receipt = await response.wait();
       
       // 修正：使用 receipt.args.success
       if (receipt && receipt.args.success) {
           setTransaction({ loading: false, error: null, successMessage: "Daily check-in successful! 10 PLT have been added to your account.", hash: response.userOpHash, step: "idle" });
           return response.userOpHash;
       } else {
           throw new Error("Daily check-in transaction failed.");
       }
   } catch (err: any) {
       const readableError = err?.error?.message || err.message || "An unknown error occurred during daily check-in.";
       setTransaction({ loading: false, error: readableError, successMessage: null, hash: transaction.hash, step: "idle" });
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
    }
  }, [getLotteryContractReader, aaWalletContext.eoaAddress]);
  
  const setupEventListeners = useCallback(() => {
    const contract = getLotteryContractWithSigner();
    const userAddress = aaWalletContext.aaWalletAddress;
    
    if (!contract || !userAddress) return;

    const onTicketPurchase = (lotteryId: BigNumber, user: string, ticketNumber: BigNumber, paymentToken: string) => {
        if (user.toLowerCase() === userAddress.toLowerCase()) {
            contract.cumulativeTicketsPurchased(userAddress).then((totalTickets: BigNumber) => {
                const unlocked = achievementService.checkAndUnlockTicketMilestones(userAddress, totalTickets.toNumber());
                unlocked.forEach(key => {
                    toaster.create({ title: "Achievement Unlocked!", description: `You earned the ${achievementService.getAchievements(userAddress).find(a=>a.key===key)?.title} badge!`, type: "success" });
                });
            });
        }
    };
    
    const onLotteryDrawn = (lotteryId: BigNumber, winners: string[]) => {
        if (winners.map(w => w.toLowerCase()).includes(userAddress.toLowerCase())) {
            if (achievementService.unlockAchievement(userAddress, AchievementKey.LUCKY_STAR)) {
                toaster.create({ title: "Achievement Unlocked!", description: `Congratulations! You earned the ${achievementService.getAchievements(userAddress).find(a=>a.key===AchievementKey.LUCKY_STAR)?.title} badge!`, type: "success" });
            }
        }
    };

    contract.on('TicketPurchased', onTicketPurchase);
    contract.on('LotteryDrawn', onLotteryDrawn);

    return () => {
        contract.off('TicketPurchased', onTicketPurchase);
        contract.off('LotteryDrawn', onLotteryDrawn);
    };
  }, [getLotteryContractWithSigner, aaWalletContext.aaWalletAddress]);
  
  useEffect(() => {
      if (aaWalletContext.isAAWalletInitialized) {
          const cleanup = setupEventListeners();
          return cleanup;
      }
  }, [aaWalletContext.isAAWalletInitialized, setupEventListeners]);

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
        fetchLotteryDetails,
        fetchOwnedLotteryTickets,
        purchaseTicketsForLottery,
        purchaseTicketsWithPLT,
        purchaseTicketsWithReferral,
        claimPrizeForLottery,
        dailyCheckIn,
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