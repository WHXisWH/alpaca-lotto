import React from "react";
import {
  Box,
  Text,
  SimpleGrid,
  Spinner,
  VStack,
  Flex,
  Spacer,
  Heading,
} from "@chakra-ui/react";
import { StatRoot, StatLabel, StatValueText, StatHelpText } from "@/components/ui/stat";
import { Tag } from "@/components/ui/tag";
import { useLottery, Lottery } from "@/context/LotteryContext";
import { ethers } from "ethers";
import { USDC_DECIMALS } from "@/config";

export const LotteryInfo: React.FC = () => {
  const { selectedLotteryForInfo, transaction } = useLottery();

  if (transaction.loading && !selectedLotteryForInfo) {
    return (
        <Box p={5} shadow="md" borderWidth="1px" borderRadius="lg" bg="gray.750" color="white" minH="200px" display="flex" alignItems="center" justifyContent="center">
            <Spinner color="teal.300" size="xl"/>
        </Box>
    );
  }
  
  if (!selectedLotteryForInfo) {
    return (
        <Box p={5} shadow="xl" borderWidth="1px" borderRadius="xl" bg="gray.750" borderColor="gray.600" color="whiteAlpha.900" minH="200px">
            <Heading size="lg" color="teal.300" mb={3}>Current Lottery</Heading>
            <Text color="gray.400">Please select a lottery from the list below to see details.</Text>
        </Box>
    );
  }
  
  const currentLottery = selectedLotteryForInfo;

  const now = new Date().getTime() / 1000;
  const isLotteryActive = now >= currentLottery.startTime && now < currentLottery.endTime;
  const isLotteryEndedAwaitingDraw = now >= currentLottery.endTime && !currentLottery.drawn;
  const isLotteryNotStarted = now < currentLottery.startTime;
  const isLotteryDrawn = currentLottery.drawn;

  let statusTag;
  let statusHelpText = "";

  if (isLotteryDrawn) {
    statusTag = <Tag colorScheme="red" variant="solid">Drawn</Tag>;
    statusHelpText = "Lottery has been drawn.";
  } else if (isLotteryActive) {
    statusTag = <Tag colorScheme="green" variant="solid">Active</Tag>;
    statusHelpText = "Lottery is currently active for ticket purchase.";
  } else if (isLotteryNotStarted) {
    statusTag = <Tag colorScheme="yellow" variant="solid">Not Started</Tag>;
    statusHelpText = `Starts at: ${new Date(currentLottery.startTime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } else if (isLotteryEndedAwaitingDraw) {
    statusTag = <Tag colorScheme="orange" variant="solid">Awaiting Draw</Tag>;
    statusHelpText = "Ticket sales ended. Waiting for draw.";
  }


  return (
    <Box
      p={5}
      shadow="xl"
      borderWidth="1px"
      borderRadius="xl"
      bg="gray.750"
      borderColor="gray.600"
      color="whiteAlpha.900"
    >
      <VStack align="stretch" gap={4}>
        <Flex alignItems="center" wrap="wrap">
        <Heading 
            size="lg" 
            color="teal.300" 
            mr={3}
            overflow="hidden"
            textOverflow="ellipsis"
            whiteSpace="nowrap"
            minWidth="0"
          >
            {currentLottery.name}
          </Heading>
          <Text fontSize="md" color="gray.400" mr={3}>
            (ID: {currentLottery.id})
          </Text>
          <Spacer display={{base: "none", md: "block"}} />
          {statusTag}
        </Flex>
        <SimpleGrid columns={{ base: 1, sm: 2, md:3 }} gap={{base:3, md:5}}>
          <StatRoot>
            <StatLabel color="gray.400">Ticket Price</StatLabel>
            <StatValueText color="whiteAlpha.900" fontSize="lg">
              {ethers.utils.formatUnits(
                currentLottery.ticketPrice,
                USDC_DECIMALS
              )}{" "}
              USDC
            </StatValueText>
          </StatRoot>
          <StatRoot>
            <StatLabel color="gray.400">Total Tickets Sold</StatLabel>
            <StatValueText color="whiteAlpha.900" fontSize="lg">{currentLottery.totalTickets.toString()}</StatValueText>
          </StatRoot>
          <StatRoot>
            <StatLabel color="gray.400">Current Prize Pool</StatLabel>
            <StatValueText color="whiteAlpha.900" fontSize="lg">
              {ethers.utils.formatUnits(
                currentLottery.prizePool,
                USDC_DECIMALS
              )}{" "}
              USDC
            </StatValueText>
          </StatRoot>
          <StatRoot>
            <StatLabel color="gray.400">Draw Date</StatLabel>
            <StatValueText color="whiteAlpha.900" fontSize="lg">
              {new Date(currentLottery.drawTime * 1000).toLocaleDateString()}
            </StatValueText>
            <StatHelpText color="gray.500">
                {new Date(currentLottery.drawTime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </StatHelpText>
          </StatRoot>
          <StatRoot>
            <StatLabel color="gray.400">Sale Ends</StatLabel>
            <StatValueText color="whiteAlpha.900" fontSize="lg">
              {new Date(currentLottery.endTime * 1000).toLocaleDateString()}
            </StatValueText>
             <StatHelpText color="gray.500">
                {new Date(currentLottery.endTime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </StatHelpText>
          </StatRoot>
           <StatRoot>
            <StatLabel color="gray.400">Status</StatLabel>
            <StatValueText color="whiteAlpha.900" fontSize="lg">
              {isLotteryDrawn ? "Drawn" : isLotteryActive ? "Active" : isLotteryNotStarted ? "Not Started" : "Awaiting Draw"}
            </StatValueText>
            <StatHelpText color="gray.500">{statusHelpText}</StatHelpText>
          </StatRoot>
        </SimpleGrid>
      </VStack>
    </Box>
  );
};

export default LotteryInfo;