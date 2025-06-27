import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Text,
  VStack,
  Spinner,
  SimpleGrid,
  Heading,
  Image,
  Separator,
  Flex,
} from "@chakra-ui/react";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { toaster } from "@/components/ui/toaster";
import { useLottery, OwnedTicketInfo, Lottery } from "@/context/LotteryContext";
import { useAAWallet } from "@/context/AAWalletContext";
import { ethers, BigNumber } from "ethers";
import { USDC_DECIMALS } from "@/config";


export const OwnedTickets: React.FC = () => {
  const { ownedTicketsInfo, fetchOwnedLotteryTickets, lotteries, transaction, claimPrizeForLottery, getLotteryById, clearTransactionState } =
    useLottery();
  const { isAAWalletInitialized, aaWalletAddress } = useAAWallet();
  const primaryTextColor = "yellow.900";
  const secondaryTextColor = "gray.700";
  const accentColor = "green.600";
  const cardBg = "white";
  const emptyStateBg = "yellow.50";
  const borderColor = "gray.200";

  const [claimingLotteryId, setClaimingLotteryId] = useState<number | null>(null);

  useEffect(() => {
    if (isAAWalletInitialized && aaWalletAddress && lotteries.length > 0) {
      lotteries.forEach((lottery) => {
        if (fetchOwnedLotteryTickets) {
          fetchOwnedLotteryTickets(lottery.id);
        }
      });
    }
  }, [
    isAAWalletInitialized,
    aaWalletAddress,
    lotteries,
    fetchOwnedLotteryTickets,
  ]);

  const { drawnTickets, undrawnTickets } = useMemo(() => {
    const allOwnedTickets = ownedTicketsInfo.filter(
      (info) => info.ticketNumbers.length > 0
    );

    const drawn: OwnedTicketInfo[] = [];
    const undrawn: OwnedTicketInfo[] = [];

    allOwnedTickets.forEach((ticketInfo) => {
      const lottery = lotteries.find((l) => l.id === ticketInfo.lotteryId);
      if (lottery?.drawn) {
        drawn.push(ticketInfo);
      } else if (lottery) {
        undrawn.push(ticketInfo);
      }
    });

    return { drawnTickets: drawn, undrawnTickets: undrawn };
  }, [ownedTicketsInfo, lotteries]);

  const handleClaimPrize = async (lotteryId: number) => {
    setClaimingLotteryId(lotteryId);
    clearTransactionState();
    const claimResult = await claimPrizeForLottery(lotteryId);

    setTimeout(() => {
        if (transaction.successMessage && claimResult) {
           toaster.create({ title: "Claim Submitted", description: transaction.successMessage, type: "success", closable: true });
        } else if (transaction.error) {
           toaster.create({ title: "Claim Failed", description: transaction.error, type: "error", closable: true });
        }
         clearTransactionState();
    }, 0);
    setClaimingLotteryId(null);
  };


  if (!isAAWalletInitialized) {
    return (
      <Text color={secondaryTextColor}>Connect and initialize your AA wallet to see your tickets.</Text>
    );
  }

  if (transaction.loading && transaction.step !== "claiming" && ownedTicketsInfo.length === 0) {
    return <Spinner color={accentColor} />;
  }

  if (drawnTickets.length === 0 && undrawnTickets.length === 0) {
    return (
        <VStack bg={emptyStateBg} p={10} borderRadius="2xl" gap={4} borderWidth="1px" borderColor={borderColor} shadow="sm">
            <Image src="/images/alpaca-empty-pockets.png" alt="An alpaca with empty pockets" height={{ base: "120px", md: "220px" }} width="auto" objectFit="contain" mx="auto" />
            <Heading size="md" color={primaryTextColor}>No Tickets Yet</Heading>
            <Text color={secondaryTextColor}>You do not own any tickets currently. Go buy some lucky ones!</Text>
        </VStack>
    );
  }

  const renderLotteryTicketGroup = (title: string, ticketsGroup: OwnedTicketInfo[], isDrawnGroup: boolean) => {
    return (
      <Box>
        <Heading size="lg" mb={4} color={isDrawnGroup ? primaryTextColor : accentColor}>
          {title}
        </Heading>
        {ticketsGroup.length > 0 ? (
          <VStack gap={4} align="stretch">
            {ticketsGroup.map((lotteryTickets: OwnedTicketInfo) => {
              const lotteryDetails = getLotteryById(lotteryTickets.lotteryId);
              const isUserWinner = lotteryDetails?.winners?.includes(aaWalletAddress || "") && lotteryDetails?.winners?.find(winnerAddr => winnerAddr === aaWalletAddress && winnerAddr !== ethers.constants.AddressZero) !== undefined;

              return (
                <Box
                  key={lotteryTickets.lotteryId}
                  p={5}
                  borderWidth="1px"
                  borderRadius="xl"
                  bg={isDrawnGroup ? "gray.50" : cardBg}
                  borderColor={borderColor}
                  shadow="sm"
                  opacity={isDrawnGroup && !isUserWinner ? 0.7 : 1}
                >
                  <Flex justifyContent="space-between" alignItems="center" mb={3}>
                    <Text fontSize="xl" fontWeight="bold" color={isDrawnGroup && !isUserWinner ? secondaryTextColor : primaryTextColor}>
                      {lotteryTickets.lotteryName || `Lottery ID ${lotteryTickets.lotteryId}`}
                      {isDrawnGroup && <Text as="span" fontSize="sm" color={secondaryTextColor}> (Drawn)</Text>}
                    </Text>
                    {isDrawnGroup && isUserWinner && (
                       <Button
                        colorPalette="green"
                        onClick={() => handleClaimPrize(lotteryTickets.lotteryId)}
                        loading={transaction.loading && transaction.step === "claiming" && claimingLotteryId === lotteryTickets.lotteryId}
                        disabled={(transaction.loading && transaction.step === "claiming")}
                        size="sm"
                      >
                        Claim Prize
                      </Button>
                    )}
                  </Flex>
                  <SimpleGrid
                    columns={{ base: 4, sm: 6, md: 8, lg: 10 }}
                    gap={3}
                  >
                    {lotteryTickets.ticketNumbers.map((ticketNumber: number) => (
                      <Tag
                        key={ticketNumber}
                        size="lg"
                        variant="solid"
                        colorScheme={isDrawnGroup && !isUserWinner ? "gray" : "green"}
                        p={2}
                        borderRadius="lg"
                        justifyContent="center"
                      >
                        #{ticketNumber}
                      </Tag>
                    ))}
                  </SimpleGrid>
                   {isDrawnGroup && isUserWinner && lotteryDetails && lotteryDetails.winners && lotteryDetails.prizePool && lotteryDetails.winners.filter(w => w !== ethers.constants.AddressZero).length > 0 && (
                    <Text mt={2} fontSize="sm" color="green.600" fontWeight="bold">
                      Congratulations! You won in this lottery! Prize per winner: {ethers.utils.formatUnits(lotteryDetails.prizePool.div(BigNumber.from(lotteryDetails.winners.filter(w => w !== ethers.constants.AddressZero).length)), USDC_DECIMALS)} USDC.
                    </Text>
                  )}
                  {isDrawnGroup && !isUserWinner && (
                     <Text mt={2} fontSize="sm" color={secondaryTextColor}>Better luck next time!</Text>
                  )}
                </Box>
              );
            })}
          </VStack>
        ) : (
          <Text color={secondaryTextColor}>
            {isDrawnGroup ? "You have no tickets from past lotteries." : "You don't have any tickets for upcoming draws."}
          </Text>
        )}
      </Box>
    );
  };


  return (
    <Box mt={4}>
      <VStack gap={8} align="stretch">
        {renderLotteryTicketGroup("Awaiting Draw", undrawnTickets, false)}
        {(undrawnTickets.length > 0 && drawnTickets.length > 0) && <Separator orientation="horizontal" />}
        {renderLotteryTicketGroup("Past Lotteries", drawnTickets, true)}
      </VStack>
    </Box>
  );
};

export default OwnedTickets;