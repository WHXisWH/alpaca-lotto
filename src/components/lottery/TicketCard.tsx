import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Box,
  Text,
  VStack,
  HStack,
  Spinner,
  Link,
  Flex,
} from "@chakra-ui/react";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { NumberInputRoot, NumberInputField } from "@/components/ui/number-input";
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
    setSelectedLotteryForInfo,
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

  const cardBg = "yellow.50";
  const textColor = "yellow.900";
  const secondaryTextColor = "gray.700";
  const borderColor = "gray.200";
  const hoverBorderColor = "green.500";
  const headingAccentColor = "green.600";
  const inputBg = "white";
  const inputBorder = "gray.300";
  const inputHoverBorder = "yellow.400";
  const inputFocusBorder = "green.500";
  const gasTextColor = "gray.700";
  const statusWarningColor = "orange.600";
  const statusErrorColor = "red.600";
  const statusInfoColor = "blue.600";

  const [quantity, setQuantity] = useState<number>(1);
  const [usdcAllowance, setUsdcAllowance] = useState<BigNumber>(BigNumber.from(0));
  const [usdcBalance, setUsdcBalance] = useState<BigNumber>(BigNumber.from(0));
  const [isDataLoading, setIsDataLoading] = useState<boolean>(false);
  const [isAllowanceSufficient, setIsAllowanceSufficient] = useState<boolean>(false);
  const [isBalanceSufficient, setIsBalanceSufficient] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);


  const prevTransactionErrorRef = useRef<string | null>(null);
  const prevPaymasterErrorRef = useRef<string | null>(null);
  const prevSuccessMessageRef = useRef<string | null>(null);

  const handleCardClick = () => {
    if (setSelectedLotteryForInfo) {
      setSelectedLotteryForInfo(lottery);
    }
  };

  const fetchLotteryCardData = useCallback(async () => {
    setIsDataLoading(true);
    if (!aaWalletAddress || !lottery || quantity <= 0) {
      setUsdcAllowance(BigNumber.from(0));
      setUsdcBalance(BigNumber.from(0));
      setIsAllowanceSufficient(false);
      setIsBalanceSufficient(false);
      setIsDataLoading(false);
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
      setUsdcAllowance(BigNumber.from(0));
      setUsdcBalance(BigNumber.from(0));
      setIsAllowanceSufficient(false);
      setIsBalanceSufficient(false);
    } finally {
      setIsDataLoading(false);
    }
  }, [aaWalletAddress, lottery, quantity]);

  useEffect(() => {
    if (isAAWalletInitialized && lottery) {
        fetchLotteryCardData();
    }
  }, [isAAWalletInitialized, lottery, quantity, fetchLotteryCardData, transaction.successMessage]);

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
        setIsDataLoading(true);
        if (clearPaymasterError) clearPaymasterError();
        prevPaymasterErrorRef.current = null;
        try {
            const lotteryContractInterface = new ethers.utils.Interface(LOTTO_ABI);
            const purchaseCallData = lotteryContractInterface.encodeFunctionData( "purchaseTickets", [lottery.id, USDC_TOKEN_ADDRESS, quantity]);

            const builderForEstimation = simpleAccount.execute(
            LOTTERY_CONTRACT_ADDRESS,
            BigNumber.from(0),
            purchaseCallData
            );

            await estimateGasCost(builderForEstimation);
        } catch (e: any) {
        } finally {
            setIsDataLoading(false);
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
        console.error("TicketCard: Invalid Input - Please select a valid lottery and quantity.");
        setFeedback({ message: "Please select a valid lottery and quantity.", type: 'error' });
        setTimeout(() => setFeedback(null), 5000);
        return;
    }

    prevTransactionErrorRef.current = null;
    prevSuccessMessageRef.current = null;
    clearTransactionState();
    setFeedback(null);

    if (!isBalanceSufficient) {
      setFeedback({ message: "Insufficient USDC balance.", type: 'error' });
      setTimeout(() => setFeedback(null), 5000);
      return;
    }

    if (!isAllowanceSufficient) {
      const approveResult = await checkAndApproveUSDC(lottery.id, quantity);
      if (!approveResult.approved) {
        const errorMsg = approveResult.error || "Failed to approve USDC. Please try again.";
        if (errorMsg !== prevTransactionErrorRef.current) {
          console.error("TicketCard: Approval Failed -", errorMsg);
          setFeedback({ message: `Approval Failed: ${errorMsg}`, type: 'error' });
          prevTransactionErrorRef.current = errorMsg;
        }
      } else {
        const successMsg = `USDC approved. You can now purchase tickets. Tx: ${approveResult.approvalTxHash}`;
        console.log("TicketCard: Approval Successful -", successMsg);
        setFeedback({ message: "USDC Approved successfully!", type: 'success' });
        prevSuccessMessageRef.current = successMsg;
        fetchLotteryCardData();
      }
      setTimeout(() => setFeedback(null), 7000);
      return;
    }

    await purchaseTicketsForLottery(lottery.id, quantity);
  };

  useEffect(() => {
    if (transaction.error && transaction.error !== prevTransactionErrorRef.current) {
      console.error("TicketCard: Transaction Failed from useEffect -", transaction.error);
      setFeedback({ message: transaction.error, type: 'error' });
      prevTransactionErrorRef.current = transaction.error;
      const timer = setTimeout(() => {
          setFeedback(null);
          clearTransactionState();
      }, 7000);
      return () => clearTimeout(timer);
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
      console.log("TicketCard: Transaction Successful from useEffect -", transaction.successMessage, "Hash:", transaction.hash);
      setFeedback({ message: transaction.successMessage, type: 'success' });
      prevSuccessMessageRef.current = transaction.successMessage;
      prevTransactionErrorRef.current = null;
      const timer = setTimeout(() => {
          setFeedback(null);
          clearTransactionState();
      }, 5000);
      return () => clearTimeout(timer);
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
      console.error("TicketCard: Paymaster Error from useEffect -", paymasterError);
      setFeedback({ message: paymasterError, type: 'error' });
      prevPaymasterErrorRef.current = paymasterError;
      const timer = setTimeout(() => {
        setFeedback(null);
        if (clearPaymasterError) clearPaymasterError();
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [paymasterError, clearPaymasterError]);

  if (!lottery || lottery.id === 0 || !lottery.ticketPrice) {
    return (
      <Box borderWidth="1px" borderRadius="xl" p={4} shadow="sm" bg={"yellow.50"} color={"gray.700"} borderColor={borderColor}>
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
    if (gasEstimatingForPaymaster || (isDataLoading && !paymasterError)) return "Gas: Estimating...";
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
    if (paymasterError) return "Gas: Estimation Failed";
    return "Gas: Select payment option";
  };

  const now = new Date().getTime() / 1000;
  const isLotteryActive = now >= lottery.startTime && now < lottery.endTime && !lottery.drawn;
  const isLotteryEndedAwaitingDraw = now >= lottery.endTime && !lottery.drawn;
  const isLotteryNotStarted = now < lottery.startTime;
  const isLotteryDrawn = lottery.drawn;

  let statusTag;
  if (isLotteryDrawn) {
    statusTag = <Tag colorScheme="red" variant="solid" size="sm" borderRadius="lg">Drawn</Tag>;
  } else if (isLotteryActive) {
    statusTag = <Tag colorScheme="green" variant="solid" size="sm" borderRadius="lg">Active</Tag>;
  } else if (isLotteryNotStarted) {
    statusTag = <Tag colorScheme="yellow" variant="solid" size="sm" borderRadius="lg">Not Started</Tag>;
  } else if (isLotteryEndedAwaitingDraw) {
    statusTag = <Tag colorScheme="orange" variant="solid" size="sm" borderRadius="lg">Awaiting Draw</Tag>;
  }

  const buttonText = !isAllowanceSufficient ? "Approve USDC" : "Purchase Tickets";
  const isButtonDisabled = transaction.loading || isLotteryDrawn || !isLotteryActive || (!isBalanceSufficient && isAllowanceSufficient) || isDataLoading;


  return (
    <Box
      borderWidth="1px"
      borderRadius="xl"
      p={5}
      shadow="sm"
      bg={cardBg}
      color={textColor}
      borderColor={borderColor}
      onClick={handleCardClick}
      cursor="pointer"
      _hover={{ borderColor: hoverBorderColor, shadow: "lg", transform: 'translateY(-2px) scale(1.02)'}}
      _active={{transform: 'scale(0.98)'}}
      transition="all 0.2s ease-out"
    >
      <VStack align="stretch" gap={3}>
        <Flex alignItems="center" justifyContent="space-between">
        <Text
              fontSize="md"
              fontWeight="bold"
              color={headingAccentColor}
              mr={2}
              overflow="hidden"
              textOverflow="ellipsis"
              whiteSpace="nowrap"
              minWidth="0"
            >
              {lottery.name}
            </Text>
            {statusTag}
        </Flex>

        <Text fontSize="sm" color={secondaryTextColor}>Ticket Price: {formattedTicketPrice} USDC</Text>
        <Text fontSize="sm" color={secondaryTextColor}>
          Draw Time: {new Date(lottery.drawTime * 1000).toLocaleString()}
        </Text>
      </VStack>

      <VStack align="stretch" gap={4} mt={4}>
        <HStack>
          <Text fontSize="sm" color={secondaryTextColor}>Quantity:</Text>
          <NumberInputRoot
            size="md"
            maxW="100px"
            value={quantity.toString()}
            min={1}
            onValueChange={(details) => {
                const val = details.valueAsNumber;
                setQuantity(isNaN(val) || val < 1 ? 1 : val);
            }}
            disabled={transaction.loading || isLotteryDrawn || !isLotteryActive}
          >
            <NumberInputField
              bg={inputBg}
              borderColor={inputBorder}
              _hover={{borderColor: inputHoverBorder}}
              _focus={{borderColor: inputFocusBorder, boxShadow: `0 0 0 1px ${inputFocusBorder}`}}
              borderRadius="lg"
            />
          </NumberInputRoot>
        </HStack>

        <Text fontWeight="bold" fontSize="lg" color={textColor}>Total Cost: {formattedTotalCost} USDC</Text>
        <Text fontSize="xs" color={gasTextColor}>
          {getGasPaymentDisplay()}
        </Text>
        <Button
          colorPalette={!isAllowanceSufficient && isBalanceSufficient ? "orange" : "green"}
          onClick={(e) => {
            e.stopPropagation();
            handlePurchaseOrApprove();
          }}
          loading={transaction.loading && (transaction.step === "approving" || transaction.step === "purchasing" || transaction.step === "fetchingReceipt")}
          disabled={isButtonDisabled}
          size="lg"
          borderRadius="xl"
          bg={(!isAllowanceSufficient && isBalanceSufficient) ? "orange.500" : "green.600"}
          color="white"
          _hover={{ bg: (!isAllowanceSufficient && isBalanceSufficient) ? "orange.600" : "green.700", transform: 'scale(1.02)'}}
          _active={{ bg: (!isAllowanceSufficient && isBalanceSufficient) ? "orange.700" : "green.800", transform: 'scale(0.98)'}}
        >
          {transaction.loading || isDataLoading ? (
            <Spinner size="sm" color="white" />
          ) : (
            <Text
              fontSize="sm"
              fontWeight="medium"
              whiteSpace="wrap"
              overflow="hidden"
              textOverflow="ellipsis"
              maxW="100%"
            >
              {buttonText}
            </Text>
          )}
        </Button>
        {feedback && (
            <Text
            fontSize="xs"
            color={feedback.type === 'success' ? statusInfoColor : statusErrorColor}
            mt={1}
            textAlign="center"
            >
            {feedback.message}
            </Text>
        )}
        {!isLotteryActive && !isLotteryDrawn && (
            <Text color={isLotteryNotStarted ? statusWarningColor : statusInfoColor} fontSize="xs" textAlign="center">
                {isLotteryNotStarted ? "Lottery has not started yet." : "Lottery ended, awaiting draw."}
            </Text>
        )}
         {!isBalanceSufficient && isLotteryActive && (
             <Text color={statusErrorColor} fontSize="xs" textAlign="center">Please ensure you have enough USDC.</Text>
         )}
         {isBalanceSufficient && !isAllowanceSufficient && isLotteryActive && (
             <Text color={statusInfoColor} fontSize="xs" textAlign="center">USDC spending needs to be approved.</Text>
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