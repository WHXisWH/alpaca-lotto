import React, { useEffect } from "react";
import {
  Box,
  Text,
  VStack,
  Spinner,
  SimpleGrid,
  Heading,
} from "@chakra-ui/react";
import { Tag } from "@/components/ui/tag";
import { useLottery, OwnedTicketInfo } from "@/context/LotteryContext";
import { useAAWallet } from "@/context/AAWalletContext";

export const OwnedTickets: React.FC = () => {
  const { ownedTicketsInfo, fetchOwnedLotteryTickets, lotteries, transaction } =
    useLottery();
  const { isAAWalletInitialized, aaWalletAddress } = useAAWallet();

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

  if (!isAAWalletInitialized) {
    return (
      <Text>Connect and initialize your AA wallet to see your tickets.</Text>
    );
  }
  if (transaction.loading && ownedTicketsInfo.length === 0) {
    return <Spinner />;
  }
  const allOwnedTickets = ownedTicketsInfo.filter(
    (info) => info.ticketNumbers.length > 0
  );
  if (allOwnedTickets.length === 0) {
    return <Text mt={4}>You do not own any tickets currently.</Text>;
  }

  return (
    <Box mt={8}>
      <Heading size="lg" mb={4} color="teal.300">
        Your Tickets
      </Heading>
      <VStack gap={6} align="stretch">
        {allOwnedTickets.map((lotteryTickets: OwnedTicketInfo) => (
          <Box
            key={lotteryTickets.lotteryId}
            p={4}
            borderWidth="1px"
            borderRadius="md"
            bg="gray.700"
          >
            <Text fontSize="xl" fontWeight="bold" mb={2}>
              Lottery:{" "}
              {lotteryTickets.lotteryName || `ID ${lotteryTickets.lotteryId}`}
            </Text>
            <SimpleGrid
              columns={{ base: 3, sm: 4, md: 6, lg: 8 }}
              gap={2}
            >
              {lotteryTickets.ticketNumbers.map((ticketNumber: number) => (
                <Tag
                  key={ticketNumber}
                  size="lg"
                  variant="solid"
                  colorScheme="teal"
                  p={2}
                  justifyContent="center"
                >
                  #{ticketNumber}
                </Tag>
              ))}
            </SimpleGrid>
          </Box>
        ))}
      </VStack>
    </Box>
  );
};

export default OwnedTickets;