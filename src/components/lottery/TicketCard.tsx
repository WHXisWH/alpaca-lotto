import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Box,
  Text,
  VStack,
  HStack,
  Spinner,
  Link,
} from "@chakra-ui/react";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { NumberInputRoot, NumberInputField } from "@/components/ui/number-input";
import { toaster } from "@/components/ui/toaster";
import { ethers, BigNumber } from "ethers";
import { useLottery, Lottery } from "@/context/LotteryContext";
import { PaymasterType, usePaymaster } from "@/context/PaymasterContext";
import { useAAWallet } from "@/context/AAWalletContext";
import {
  USDC_DECIMALS,
  LOTTERY_CONTRACT_ADDRESS,
  USDC_TOKEN_ADDRESS,
  RPC_URL,
} from "@/config";
import LOTTO_ABI_JSON from "@/abis/AlpacaLotto.json";

const LOTTO_ABI = LOTTO_ABI_JSON as any;
const ERC20_ABI_MINIMAL = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)"
];

const getReadProvider = () => new ethers.providers.JsonRpcProvider(RPC_URL);

interface LotteryCardProps {
  lottery: Lottery;
}

const TicketCardComponent: React.FC<LotteryCardProps> = ({ lottery }) => {
  const {
    purchaseTicketsForLottery,
    checkAndApproveUSDC,
    transaction,
    clearTransactionState,
  } = useLottery();
  const {
    selectedPaymasterType,
    selectedToken,
    gasCost,
    estimateGasCost,
    loading: paymasterLoading,
    error: paymasterError,
    clearError: clearPaymasterError
  } = usePaymaster();
  const {
    simpleAccount,
    aaWalletAddress,
    isAAWalletInitialized,
  } = useAAWallet();

  const [quantity, setQuantity] = useState<number>(1);
  const [isEstimating, setIsEstimating] = useState<boolean>(false); // For fetchUSDCData loading
  const [usdcAllowance, setUsdcAllowance] = useState<BigNumber>(BigNumber.from(0));
  const [usdcBalance, setUsdcBalance] = useState<BigNumber>(BigNumber.from(0));
  const [isAllowanceSufficient, setIsAllowanceSufficient] = useState<boolean>(false);
  const [isBalanceSufficient, setIsBalanceSufficient] = useState<boolean>(false);

  const prevTransactionErrorRef = useRef<string | null>(null);
  const prevPaymasterErrorRef = useRef<string | null>(null);
  const prevSuccessMessageRef = useRef<string | null>(null);

  const formattedUsdcBalance = useMemo(
    () => ethers.utils.formatUnits(usdcBalance, USDC_DECIMALS),
    [usdcBalance]
  );

  const formattedUsdcAllowance = useMemo(() => {
    if (usdcAllowance.eq(ethers.constants.MaxUint256)) {
      return "Unlimited";
    }
    return ethers.utils.formatUnits(usdcAllowance, USDC_DECIMALS);
  }, [usdcAllowance]);


  const fetchUSDCData = useCallback(async () => {
    setIsEstimating(true);
    if (!aaWalletAddress || !lottery || quantity <= 0) {
      setUsdcAllowance(BigNumber.from(0));
      setUsdcBalance(BigNumber.from(0));
      setIsAllowanceSufficient(false);
      setIsBalanceSufficient(false);
      setIsEstimating(false);
      return;
    }
    try {
      const readerProvider = getReadProvider();
      const usdcContract = new ethers.Contract(
        USDC_TOKEN_ADDRESS,
        ERC20_ABI_MINIMAL,
        readerProvider
      );

      const allowance: BigNumber = await usdcContract.allowance(
        aaWalletAddress,
        LOTTERY_CONTRACT_ADDRESS
      );
      const balance: BigNumber = await usdcContract.balanceOf(aaWalletAddress);

      setUsdcAllowance(allowance);
      setUsdcBalance(balance);

      if (lottery.ticketPrice) {
        const totalCost = lottery.ticketPrice.mul(quantity);
        setIsAllowanceSufficient(allowance.gte(totalCost));
        setIsBalanceSufficient(balance.gte(totalCost));
      } else {
        setIsAllowanceSufficient(false);
        setIsBalanceSufficient(false);
      }

    } catch (e) {
      console.warn("Error fetching USDC data:", e);
      setUsdcAllowance(BigNumber.from(0));
      setUsdcBalance(BigNumber.from(0));
      setIsAllowanceSufficient(false);
      setIsBalanceSufficient(false);
    } finally {
      setIsEstimating(false);
    }
  }, [aaWalletAddress, lottery, quantity]);

  useEffect(() => {
    if (isAAWalletInitialized && lottery) {
      fetchUSDCData();
    }
  }, [isAAWalletInitialized, lottery, quantity, fetchUSDCData, transaction.successMessage]);

  useEffect(() => {
    if (
      !isAAWalletInitialized ||
      !simpleAccount ||
      !estimateGasCost ||
      !lottery ||
      lottery.id === 0 ||
      quantity <= 0
    ) {
      return;
    }

    let gasEstimateDebounceTimer: NodeJS.Timeout;
    const doEstimate = async () => {
        setIsEstimating(true); // This is for fetchUSDCData, maybe rename for gas estimation or use a separate state
        if (clearPaymasterError) clearPaymasterError();
        prevPaymasterErrorRef.current = null;
        try {
            const lotteryContractInterface = new ethers.utils.Interface(LOTTO_ABI);
            const purchaseCallData = lotteryContractInterface.encodeFunctionData(
            "purchaseTickets",
            [lottery.id, USDC_TOKEN_ADDRESS, quantity]
            );

            const builderForEstimation = simpleAccount.execute(
            LOTTERY_CONTRACT_ADDRESS,
            BigNumber.from(0),
            purchaseCallData
            );

            await estimateGasCost(builderForEstimation);
        } catch (e: any) {
            console.error("Error directly in doEstimate (TicketCard):", e);
        } finally {
            setIsEstimating(false); // This is for fetchUSDCData, maybe rename for gas estimation or use a separate state
        }
    };

    gasEstimateDebounceTimer = setTimeout(doEstimate, 800);

    return () => {
        clearTimeout(gasEstimateDebounceTimer);
    };
  }, [
    isAAWalletInitialized,
    simpleAccount,
    estimateGasCost,
    lottery?.id,
    lottery?.ticketPrice?.toString(),
    quantity,
    selectedPaymasterType,
    selectedToken?.address,
    clearPaymasterError
  ]);


  const handlePurchaseOrApprove = async () => {
    if (!lottery || quantity <= 0) {
      setTimeout(() => toaster.create({ title: "Invalid Input", description: "Please select a valid lottery and quantity.", type: "error" }), 0);
      return;
    }
    prevTransactionErrorRef.current = null;
    prevSuccessMessageRef.current = null;
    clearTransactionState();

    if (!isBalanceSufficient) {
      setTimeout(() => toaster.create({ title: "Insufficient USDC Balance", description: "You do not have enough USDC to purchase these tickets.", type: "error" }), 0);
      return;
    }

    if (!isAllowanceSufficient) {
      const approveResult = await checkAndApproveUSDC(lottery.id, quantity);
      if (!approveResult.approved) {
        if (approveResult.error && approveResult.error !== prevTransactionErrorRef.current) {
          setTimeout(() => toaster.create({ title: "Approval Failed", description: approveResult.error || "Failed to approve USDC.", type: "error" }), 0);
          prevTransactionErrorRef.current = approveResult.error;
        } else if (!approveResult.error) {
          setTimeout(() => toaster.create({ title: "Approval Failed", description: "Failed to approve USDC. Please try again.", type: "error" }), 0);
        }
      } else {
        setTimeout(() => toaster.create({ title: "Approval Successful", description: `USDC approved. You can now purchase tickets. Tx: ${approveResult.approvalTxHash}`, type: "success" }), 0);
        prevSuccessMessageRef.current = `USDC approved. You can now purchase tickets. Tx: ${approveResult.approvalTxHash}`;
        fetchUSDCData();
      }
      return;
    }

    await purchaseTicketsForLottery(lottery.id, quantity);
  };

  useEffect(() => {
    if (transaction.error && transaction.error !== prevTransactionErrorRef.current) {
      setTimeout(() => {
        toaster.create({
          title: "Transaction Failed",
          description: transaction.error,
          type: "error",
        });
      }, 0);
      prevTransactionErrorRef.current = transaction.error;
      clearTransactionState();
    }
  }, [transaction.error, clearTransactionState]);

  useEffect(() => {
    if (
      transaction.successMessage &&
      transaction.hash &&
      !transaction.loading &&
      transaction.step === "idle" &&
      transaction.successMessage !== prevSuccessMessageRef.current
    ) {
      setTimeout(() => {
        toaster.create({
          title: "Transaction Successful",
          description: (
            <Box>
              {transaction.successMessage}
              <Link
                href={`https://testnet.neroscan.io/tx/${transaction.hash}`}
                target="_blank"
                rel="noopener noreferrer"
                color="teal.500"
                ml={1}
              >
                View on Explorer
              </Link>
            </Box>
          ),
          type: "success",
        });
      }, 0);
      prevSuccessMessageRef.current = transaction.successMessage;
      prevTransactionErrorRef.current = null;
      clearTransactionState();
    }
  }, [
    transaction.successMessage,
    transaction.hash,
    transaction.loading,
    transaction.step,
    clearTransactionState,
  ]);

  useEffect(() => {
    if (paymasterError && paymasterError !== prevPaymasterErrorRef.current) {
      setTimeout(() => {
        toaster.create({
          title: "Paymaster Error",
          description: paymasterError,
          type: "error",
        });
      }, 0);
      prevPaymasterErrorRef.current = paymasterError;
      if (clearPaymasterError) clearPaymasterError();
    }
  }, [paymasterError, clearPaymasterError]);

  if (!lottery || lottery.id === 0 || !lottery.ticketPrice) {
    return (
      <Box borderWidth="1px" borderRadius="lg" p={4} shadow="md" bg="gray.800" color="whiteAlpha.700">
        <Text>Lottery data not fully loaded or invalid.</Text>
      </Box>
    );
  }

  const totalUsdcCost = lottery.ticketPrice.mul(quantity);
  const formattedTicketPrice = ethers.utils.formatUnits(
    lottery.ticketPrice,
    USDC_DECIMALS
  );
  const formattedTotalCost = ethers.utils.formatUnits(
    totalUsdcCost,
    USDC_DECIMALS
  );

  const getGasPaymentDisplay = () => {
    const gasEstimatingForPaymaster = paymasterLoading && !gasCost.native && !gasCost.erc20 && !paymasterError;
    if (gasEstimatingForPaymaster) return "Gas: Estimating...";
    if (paymasterError && !gasCost.native && !gasCost.erc20) return "Gas: Estimation Failed";

    if (selectedPaymasterType === PaymasterType.NATIVE)
      return `Gas: ${gasCost.native?.formatted || "N/A"} NERO`;
    if (selectedPaymasterType === PaymasterType.FREE_GAS)
      return "Gas: Sponsored (Free)";
    if (
      selectedToken &&
      gasCost.erc20 &&
      gasCost.erc20.token?.symbol === selectedToken.symbol
    )
      return `Gas: ${
        gasCost.erc20.formatted || "N/A"
      } ${selectedToken.symbol}`;
    if (paymasterError) return "Gas: Estimation Failed"; // Catch all for other paymaster errors after options
    return "Gas: Select payment option";
  };

  const now = new Date().getTime() / 1000;
  const isLotteryActive = now >= lottery.startTime && now < lottery.endTime;
  const isLotteryEndedAwaitingDraw = now >= lottery.endTime && !lottery.drawn;
  const isLotteryNotStarted = now < lottery.startTime;

  const buttonText = !isBalanceSufficient ? "Insufficient USDC Balance" : !isAllowanceSufficient ? "Approve USDC" : "Purchase Tickets";

  return (
    <Box
      borderWidth="1px"
      borderRadius="lg"
      p={4}
      shadow="md"
      bg="gray.700"
      color="white"
    >
      <VStack align="stretch" gap={3}>
        <Text fontSize="xl" fontWeight="bold" color="teal.300">
          {lottery.name} (ID: {lottery.id})
        </Text>
        <Text>Ticket Price: {formattedTicketPrice} USDC</Text>
        <Text>
          Your USDC Balance: {formattedUsdcBalance}
          {isEstimating && ' (loading…)'}
        </Text>
        <Text>Your USDC Allowance: {formattedUsdcAllowance}</Text>
        <Text>
          Draw Time: {new Date(lottery.drawTime * 1000).toLocaleString()}
        </Text>
        {lottery.drawn && <Tag colorScheme="red">Drawn</Tag>}
        {!lottery.drawn && isLotteryActive && <Tag colorScheme="green">Active</Tag>}
        {isLotteryNotStarted && <Tag colorScheme="yellow">Not Started</Tag>}
        {isLotteryEndedAwaitingDraw && <Tag colorScheme="orange">Ended - Awaiting Draw</Tag>}
      </VStack>

      <VStack align="stretch" gap={3} mt={4}>
        <HStack>
          <Text>Quantity:</Text>
          <NumberInputRoot
            size="sm"
            maxW="80px"
            value={quantity.toString()}
            min={1}
            onValueChange={(details) => {
                const val = details.valueAsNumber;
                setQuantity(isNaN(val) || val < 1 ? 1 : val);
            }}
            disabled={transaction.loading || lottery.drawn || !isLotteryActive}
          >
            <NumberInputField />
          </NumberInputRoot>
        </HStack>
        <Text fontWeight="bold">Total Cost: {formattedTotalCost} USDC</Text>
        <Text fontSize="sm" color="gray.400">
          {getGasPaymentDisplay()}
        </Text>
        <Button
          colorScheme={!isAllowanceSufficient && isBalanceSufficient ? "orange" : "teal"}
          onClick={handlePurchaseOrApprove}
          loading={transaction.loading && (transaction.step === "approving" || transaction.step === "purchasing" || transaction.step === "fetchingReceipt")}
          disabled={
            transaction.loading ||
            lottery.drawn ||
            !isLotteryActive ||
            (!isBalanceSufficient)
          }
        >
          {transaction.loading ? (
            <Spinner size="sm" />
          ) : (
            buttonText
          )}
        </Button>
        {isLotteryEndedAwaitingDraw && (
          <Text color="yellow.400" fontSize="sm">
            Lottery ended, awaiting draw.
          </Text>
        )}
        {isLotteryNotStarted && (
          <Text color="yellow.400" fontSize="sm">
            Lottery has not started yet.
          </Text>
        )}
         {!isBalanceSufficient && isLotteryActive && (
             <Text color="red.400" fontSize="sm">Please ensure you have enough USDC in your smart account.</Text>
         )}
         {isBalanceSufficient && !isAllowanceSufficient && isLotteryActive && (
             <Text color="orange.300" fontSize="sm">USDC spending needs to be approved for the lottery contract.</Text>
         )}
      </VStack>
    </Box>
  );
};

const lotteryPropsAreEqual = (prevProps: LotteryCardProps, nextProps: LotteryCardProps): boolean => {
  if (prevProps.lottery === nextProps.lottery) {
    return true;
  }
  if (!prevProps.lottery || !nextProps.lottery) {
    return false;
  }

  return (
    prevProps.lottery.id === nextProps.lottery.id &&
    prevProps.lottery.name === nextProps.lottery.name &&
    prevProps.lottery.ticketPrice.eq(nextProps.lottery.ticketPrice) &&
    prevProps.lottery.startTime === nextProps.lottery.startTime &&
    prevProps.lottery.endTime === nextProps.lottery.endTime &&
    prevProps.lottery.drawTime === nextProps.lottery.drawTime &&
    prevProps.lottery.totalTickets === nextProps.lottery.totalTickets &&
    prevProps.lottery.prizePool.eq(nextProps.lottery.prizePool) &&
    prevProps.lottery.drawn === nextProps.lottery.drawn &&
    JSON.stringify(prevProps.lottery.supportedTokens) === JSON.stringify(nextProps.lottery.supportedTokens) &&
    JSON.stringify(prevProps.lottery.winners) === JSON.stringify(nextProps.lottery.winners)
  );
};

export const TicketCard = React.memo(TicketCardComponent, lotteryPropsAreEqual);

export default TicketCard;