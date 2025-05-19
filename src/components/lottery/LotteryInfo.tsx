import React from "react";
import {
  Box,
  Text,
  SimpleGrid,
  Spinner,
  VStack,
} from "@chakra-ui/react";
import { StatRoot, StatLabel, StatValueText, StatHelpText } from "@/components/ui/stat";
import { useLottery } from "@/context/LotteryContext";
import { ethers } from "ethers";
import { USDC_DECIMALS } from "@/config";

export const LotteryInfo: React.FC = () => {
  const { lotteries, transaction } = useLottery();

  if (transaction.loading && lotteries.length === 0) {
    return <Spinner />;
  }
  if (lotteries.length === 0) {
    return <Text>No lottery information available.</Text>;
  }
  const currentLottery = lotteries[0];

  return (
    <Box
      p={5}
      shadow="md"
      borderWidth="1px"
      borderRadius="lg"
      bg="gray.700"
      color="white"
    >
      <VStack align="stretch" gap={4}>
        <Text fontSize="2xl" fontWeight="bold" mb={3} color="teal.300">
          Current Lottery: {currentLottery.name} (ID: {currentLottery.id})
        </Text>
        <SimpleGrid columns={{ base: 1, md: 2 }} gap={5}>
          <StatRoot>
            <StatLabel>Ticket Price</StatLabel>
            <StatValueText>
              {ethers.utils.formatUnits(
                currentLottery.ticketPrice,
                USDC_DECIMALS
              )}{" "}
              USDC
            </StatValueText>
          </StatRoot>
          <StatRoot>
            <StatLabel>Total Tickets Sold</StatLabel>
            <StatValueText>{currentLottery.totalTickets.toString()}</StatValueText>
          </StatRoot>
          <StatRoot>
            <StatLabel>Current Prize Pool</StatLabel>
            <StatValueText>
              {ethers.utils.formatUnits(
                currentLottery.prizePool,
                USDC_DECIMALS
              )}{" "}
              USDC
            </StatValueText>
          </StatRoot>
          <StatRoot>
            <StatLabel>Draw Date</StatLabel>
            <StatValueText>
              {new Date(currentLottery.drawTime * 1000).toLocaleString()}
            </StatValueText>
            <StatHelpText>
              {currentLottery.drawn
                ? "Lottery Drawn"
                : new Date().getTime() / 1000 > currentLottery.endTime
                ? "Lottery Ended - Awaiting Draw"
                : new Date().getTime() / 1000 < currentLottery.startTime
                ? "Not Started Yet"
                : "Ongoing"}
            </StatHelpText>
          </StatRoot>
          <StatRoot>
            <StatLabel>Lottery Start Time</StatLabel>
            <StatValueText>
              {new Date(currentLottery.startTime * 1000).toLocaleString()}
            </StatValueText>
          </StatRoot>
          <StatRoot>
            <StatLabel>Lottery End Time</StatLabel>
            <StatValueText>
              {new Date(currentLottery.endTime * 1000).toLocaleString()}
            </StatValueText>
          </StatRoot>
        </SimpleGrid>
      </VStack>
    </Box>
  );
};

export default LotteryInfo;