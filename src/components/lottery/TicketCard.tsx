import React, { useState, useEffect, useCallback, useRef } from "react";
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
} from "@/config";
import LOTTO_ABI_JSON from "@/abis/AlpacaLotto.json";

const LOTTO_ABI = LOTTO_ABI_JSON as any;
const ERC20_ABI_MINIMAL = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)"
];

interface LotteryCardProps {
  lottery: Lottery;
}

export const TicketCard: React.FC<LotteryCardProps> = ({ lottery }) => {
  const {
    purchaseTicketsForLottery,
    checkAndApproveUSDC,
    transaction,
    clearTransactionState,
    getLotteryById,
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
    provider: aaProvider, 
  } = useAAWallet();
  const [quantity, setQuantity] = useState<number>(1);
  const [isEstimating, setIsEstimating] = useState<boolean>(false);
  const [currentLotteryDetails, setCurrentLotteryDetails] = useState<Lottery | undefined>(lottery);
  const [usdcAllowance, setUsdcAllowance] = useState<BigNumber | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<BigNumber | null>(null);
  const [isAllowanceSufficient, setIsAllowanceSufficient] = useState<boolean>(false);
  const [isBalanceSufficient, setIsBalanceSufficient] = useState<boolean>(false);

  const prevTransactionErrorRef = useRef<string | null>(null);
  const prevPaymasterErrorRef = useRef<string | null>(null);


  const fetchUSDCData = useCallback(async () => {
    if (!aaWalletAddress || !currentLotteryDetails || quantity <= 0 || !aaProvider) {
      setUsdcAllowance(BigNumber.from(0));
      setUsdcBalance(BigNumber.from(0));
      setIsAllowanceSufficient(false);
      setIsBalanceSufficient(false);
      return;
    }
    try {
      const usdcContract = new ethers.Contract(
        USDC_TOKEN_ADDRESS,
        ERC20_ABI_MINIMAL,
        aaProvider 
      );

      const allowance: BigNumber = await usdcContract.allowance(
        aaWalletAddress,
        LOTTERY_CONTRACT_ADDRESS
      );
      const balance: BigNumber = await usdcContract.balanceOf(aaWalletAddress);

      setUsdcAllowance(allowance);
      setUsdcBalance(balance);

      const totalCost = currentLotteryDetails.ticketPrice.mul(quantity);
      setIsAllowanceSufficient(allowance.gte(totalCost));
      setIsBalanceSufficient(balance.gte(totalCost));

    } catch (e) {
      console.warn("Error fetching USDC data:", e);
      setUsdcAllowance(BigNumber.from(0));
      setUsdcBalance(BigNumber.from(0));
      setIsAllowanceSufficient(false);
      setIsBalanceSufficient(false);
    }
  }, [aaWalletAddress, currentLotteryDetails, quantity, aaProvider]);


  useEffect(() => {
    const updatedLottery = getLotteryById(lottery.id);
    if (updatedLottery) {
      setCurrentLotteryDetails(updatedLottery);
    }
  }, [lottery.id, getLotteryById]);


  useEffect(() => {
    if(isAAWalletInitialized && currentLotteryDetails && aaProvider){
        fetchUSDCData();
    }
  }, [isAAWalletInitialized, currentLotteryDetails, quantity, fetchUSDCData, transaction.successMessage, aaProvider]);


  const handleEstimate = useCallback(async () => {
    if (
      !simpleAccount ||
      !currentLotteryDetails ||
      currentLotteryDetails.id === 0 ||
      quantity <= 0 ||
      !estimateGasCost
    ) {
      return;
    }
    setIsEstimating(true);
    if (clearPaymasterError) clearPaymasterError();
    try {
      const lotteryContractInterface = new ethers.utils.Interface(LOTTO_ABI);
      const purchaseCallData = lotteryContractInterface.encodeFunctionData(
        "purchaseTickets",
        [currentLotteryDetails.id, USDC_TOKEN_ADDRESS, quantity]
      );
      
      const builderForEstimation = simpleAccount.execute(
        LOTTERY_CONTRACT_ADDRESS,
        BigNumber.from(0),
        purchaseCallData
      );
      
      await estimateGasCost(builderForEstimation);

    } catch (e: any) {
      console.error("Error in handleEstimate (TicketCard):", e);
      toaster.create({ title: "Gas Estimation Failed", description: e.message || "Unknown error during gas estimation preparation.", type: "error" });
    } finally {
      setIsEstimating(false);
    }
  }, [
      simpleAccount, currentLotteryDetails, quantity, estimateGasCost,
      USDC_TOKEN_ADDRESS, LOTTERY_CONTRACT_ADDRESS, clearPaymasterError
  ]);

  useEffect(() => {
    if (isAAWalletInitialized && currentLotteryDetails && currentLotteryDetails.id !== 0 && quantity > 0) {
      const timer = setTimeout(() => { 
         handleEstimate();
      }, 500); 
      return () => clearTimeout(timer);
    }
  }, [
    currentLotteryDetails, quantity, selectedPaymasterType, selectedToken, isAAWalletInitialized, handleEstimate
  ]);


  const handlePurchaseOrApprove = async () => {
    if (!currentLotteryDetails || quantity <= 0) {
      toaster.create({ title: "Invalid Input", description: "Please select a valid lottery and quantity.", type: "error" });
      return;
    }
    clearTransactionState();

    if (!isBalanceSufficient) {
        toaster.create({ title: "Insufficient USDC Balance", description: "You do not have enough USDC to purchase these tickets.", type: "error" });
        return;
    }

    if (!isAllowanceSufficient) {
      const approveResult = await checkAndApproveUSDC(currentLotteryDetails.id, quantity);
      if (!approveResult.approved) {
         if(approveResult.error && approveResult.error !== prevTransactionErrorRef.current){
            toaster.create({ title: "Approval Failed", description: approveResult.error, type: "error" });
            prevTransactionErrorRef.current = approveResult.error;
         } else if (!approveResult.error) {
            toaster.create({ title: "Approval Failed", description: "Failed to approve USDC. Please try again.", type: "error" });
         }
      } else {
         toaster.create({ title: "Approval Successful", description: `USDC approved. You can now purchase tickets. Tx: ${approveResult.approvalTxHash}`, type: "success" });
         fetchUSDCData(); 
      }
      return;
    }
    
    await purchaseTicketsForLottery(currentLotteryDetails.id, quantity);
  };


    useEffect(() => {
      if (transaction.error && transaction.error !== prevTransactionErrorRef.current) {
        toaster.create({
          title: "Transaction Failed",
          description: transaction.error,
          type: "error",
        });
        prevTransactionErrorRef.current = transaction.error;
        clearTransactionState(); 
      }
    }, [transaction.error, clearTransactionState]);
  

    useEffect(() => {
      if (
        transaction.successMessage &&
        transaction.hash &&
        !transaction.loading &&
        transaction.step === "idle"
      ) {
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
      toaster.create({
        title: "Paymaster Error",
        description: paymasterError,
        type: "error",
      });
      prevPaymasterErrorRef.current = paymasterError;
      if(clearPaymasterError) clearPaymasterError();
    }
  }, [paymasterError, clearPaymasterError]);


  if (!currentLotteryDetails || currentLotteryDetails.id === 0) {
    return (
      <Box borderWidth="1px" borderRadius="lg" p={4} shadow="md" bg="gray.800" color="whiteAlpha.700">
        <Text>Invalid lottery data or lottery not loaded.</Text>
      </Box>
    );
  }

  const totalUsdcCost = currentLotteryDetails.ticketPrice.mul(quantity);
  const formattedTicketPrice = ethers.utils.formatUnits(
    currentLotteryDetails.ticketPrice,
    USDC_DECIMALS
  );
  const formattedTotalCost = ethers.utils.formatUnits(
    totalUsdcCost,
    USDC_DECIMALS
  );
  const formattedUsdcBalance = usdcBalance ? ethers.utils.formatUnits(usdcBalance, USDC_DECIMALS) : "N/A";
  
  const formattedUsdcAllowance = usdcAllowance
    ? usdcAllowance.eq(ethers.constants.MaxUint256)
      ? "Unlimited"
      : ethers.utils.formatUnits(usdcAllowance, USDC_DECIMALS)
    : "N/A";


  const getGasPaymentDisplay = () => {
    if (isEstimating || paymasterLoading) return "Gas: Estimating...";
    if (paymasterError && !gasCost.native && !gasCost.erc20) return "Gas: Estimation Failed"; // Show only if no cost is available
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
    if (paymasterError) return "Gas: Estimation Failed"; // Fallback if other conditions not met but error exists
    return "Gas: Select payment option";
  };

  const now = new Date().getTime() / 1000;
  const isLotteryActive = now >= currentLotteryDetails.startTime && now < currentLotteryDetails.endTime;
  const isLotteryEndedAwaitingDraw = now >= currentLotteryDetails.endTime && !currentLotteryDetails.drawn;
  const isLotteryNotStarted = now < currentLotteryDetails.startTime;

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
          {currentLotteryDetails.name} (ID: {currentLotteryDetails.id})
        </Text>
        <Text>Ticket Price: {formattedTicketPrice} USDC</Text>
        <Text>Your USDC Balance: {formattedUsdcBalance}</Text>
        <Text>Your USDC Allowance: {formattedUsdcAllowance}</Text>
        <Text>
          Draw Time: {new Date(currentLotteryDetails.drawTime * 1000).toLocaleString()}
        </Text>
        {currentLotteryDetails.drawn && <Tag colorScheme="red">Drawn</Tag>}
        {!currentLotteryDetails.drawn && isLotteryActive && <Tag colorScheme="green">Active</Tag>}
        {isLotteryNotStarted && <Tag colorScheme="yellow">Not Started</Tag>}
        {isLotteryEndedAwaitingDraw && <Tag colorScheme="orange">Ended - Awaiting Draw</Tag>}

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
            disabled={transaction.loading || currentLotteryDetails.drawn || !isLotteryActive}
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
            currentLotteryDetails.drawn ||
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

export default TicketCard;