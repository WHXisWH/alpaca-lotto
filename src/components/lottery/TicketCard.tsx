import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Box,
  Text,
  VStack,
  HStack,
  Spinner,
  Link,
  Flex,
  Spacer
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
import { useColorModeValue } from "@/components/ui/color-mode";

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


  const cardBg = useColorModeValue("gray.700", "gray.700");
  const textColor = useColorModeValue("whiteAlpha.900", "whiteAlpha.900");
  const secondaryTextColor = useColorModeValue("gray.300", "gray.300");
  const borderColor = useColorModeValue("gray.700", "gray.700");
  const hoverBorderColor = useColorModeValue("teal.300", "teal.300");
  const headingAccentColor = useColorModeValue("teal.300", "teal.300");
  const inputBg = useColorModeValue("gray.600", "gray.600");
  const inputBorder = useColorModeValue("gray.500", "gray.500");
  const inputHoverBorder = useColorModeValue("gray.400", "gray.400");
  const inputFocusBorder = useColorModeValue("teal.300", "teal.300");
  const gasTextColor = useColorModeValue("gray.400", "gray.400");
  const statusWarningColor = useColorModeValue("yellow.400", "yellow.400");
  const statusErrorColor = useColorModeValue("red.400", "red.400");
  const statusInfoColor = useColorModeValue("orange.300", "orange.300");

  const [quantity, setQuantity] = useState<number>(1);
  const [usdcAllowance, setUsdcAllowance] = useState<BigNumber>(BigNumber.from(0));
  const [usdcBalance, setUsdcBalance] = useState<BigNumber>(BigNumber.from(0));
  const [isDataLoading, setIsDataLoading] = useState<boolean>(false);
  const [isAllowanceSufficient, setIsAllowanceSufficient] = useState<boolean>(false);
  const [isBalanceSufficient, setIsBalanceSufficient] = useState<boolean>(false);

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
      console.warn("Error fetching USDC data for card:", e);
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
        fetchLotteryCardData();
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
      <Box borderWidth="1px" borderRadius="lg" p={4} shadow="md" bg={"gray.800"} color={"whiteAlpha.700"}>
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
  const isLotteryActive = now >= lottery.startTime && now < lottery.endTime;
  const isLotteryEndedAwaitingDraw = now >= lottery.endTime && !lottery.drawn;
  const isLotteryNotStarted = now < lottery.startTime;
  const isLotteryDrawn = lottery.drawn;

  let statusTag;
  if (isLotteryDrawn) {
    statusTag = <Tag colorScheme="red" variant="solid" size="sm">Drawn</Tag>;
  } else if (isLotteryActive) {
    statusTag = <Tag colorScheme="green" variant="solid" size="sm">Active</Tag>;
  } else if (isLotteryNotStarted) {
    statusTag = <Tag colorScheme="yellow" variant="solid" size="sm">Not Started</Tag>;
  } else if (isLotteryEndedAwaitingDraw) {
    statusTag = <Tag colorScheme="orange" variant="solid" size="sm">Awaiting Draw</Tag>;
  }


  const buttonText = !isBalanceSufficient ? "Insufficient USDC Balance" : !isAllowanceSufficient ? "Approve USDC" : "Purchase Tickets";

  return (
    <Box
      borderWidth="1px"
      borderRadius="lg"
      p={4}
      shadow="md"
      bg={cardBg}
      color={textColor}
      borderColor={borderColor}
      onClick={handleCardClick}
      cursor="pointer"
      _hover={{ borderColor: hoverBorderColor, shadow: "lg" }}
      transition="border-color 0.2s, box-shadow 0.2s"
    >
      <VStack align="stretch" gap={3}>
        <Flex alignItems="center" justifyContent="space-between">
        <Text 
              fontSize="xl" 
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

      <VStack align="stretch" gap={3} mt={4}>
        <HStack>
          <Text fontSize="sm" color={secondaryTextColor}>Quantity:</Text>
          <NumberInputRoot
            size="sm"
            maxW="80px"
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
            />
          </NumberInputRoot>
        </HStack>
        <Text fontWeight="bold" fontSize="md" color={textColor}>Total Cost: {formattedTotalCost} USDC</Text>
        <Text fontSize="xs" color={gasTextColor}>
          {getGasPaymentDisplay()}
        </Text>
        <Button
          colorScheme={!isAllowanceSufficient && isBalanceSufficient ? "orange" : "teal"}
          onClick={(e) => {
            e.stopPropagation(); 
            handlePurchaseOrApprove();
          }}
          loading={transaction.loading && (transaction.step === "approving" || transaction.step === "purchasing" || transaction.step === "fetchingReceipt")}
          disabled={
            transaction.loading ||
            isLotteryDrawn ||
            !isLotteryActive ||
            (!isBalanceSufficient) ||
            isDataLoading 
          }
        >
          {transaction.loading || isDataLoading ? (
            <Spinner size="sm" />
          ) : (
            buttonText
          )}
        </Button>
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