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
  const primaryTextColor = "yellow.900";
  const secondaryTextColor = "gray.700";
  const accentColor = "green.600";
  const cardBg = "yellow.50";
  const cardBorderColor = "gray.200";

  if (transaction.loading && !selectedLotteryForInfo) {
    return (
        <Box p={5} shadow="sm" borderWidth="1px" borderRadius="xl" bg="white" color={primaryTextColor} minH="200px" display="flex" alignItems="center" justifyContent="center" borderColor={cardBorderColor}>
            <Spinner color={accentColor} size="xl"/>
        </Box>
    );
  }
  
  if (!selectedLotteryForInfo) {
    return (
        <Box p={6} shadow="sm" borderWidth="1px" borderRadius="2xl" bg={cardBg} borderColor={cardBorderColor} color={primaryTextColor} minH="200px">
            <Heading size="lg" color={accentColor} mb={3}>Current Lottery</Heading>
            <Text color={secondaryTextColor}>Please select a lottery from the list below to see details.</Text>
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
    statusTag = <Tag colorScheme="red" variant="solid" borderRadius="lg">Drawn</Tag>;
    statusHelpText = "Lottery has been drawn.";
  } else if (isLotteryActive) {
    statusTag = <Tag colorScheme="green" variant="solid" borderRadius="lg">Active</Tag>;
    statusHelpText = "Lottery is currently active for ticket purchase.";
  } else if (isLotteryNotStarted) {
    statusTag = <Tag colorScheme="yellow" variant="solid" borderRadius="lg">Not Started</Tag>;
    statusHelpText = `Starts at: ${new Date(currentLottery.startTime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } else if (isLotteryEndedAwaitingDraw) {
    statusTag = <Tag colorScheme="orange" variant="solid" borderRadius="lg">Awaiting Draw</Tag>;
    statusHelpText = "Ticket sales ended. Waiting for draw.";
  }

  return (
    <Box
      p={6}
      shadow="sm"
      borderWidth="1px"
      borderRadius="2xl"
      bg={cardBg}
      borderColor={cardBorderColor}
      color={primaryTextColor}
    >
      <VStack align="stretch" gap={4}>
        <Flex alignItems="center" wrap="wrap">
        <Heading 
            size="lg" 
            color={accentColor} 
            mr={3}
            overflow="hidden"
            textOverflow="ellipsis"
            whiteSpace="nowrap"
            minWidth="0"
          >
            {currentLottery.name}
          </Heading>
          <Text fontSize="md" color={secondaryTextColor} mr={3}>
            (ID: {currentLottery.id})
          </Text>
          <Spacer display={{base: "none", md: "block"}} />
          {statusTag}
        </Flex>
        <SimpleGrid columns={{ base: 1, sm: 2, md:3 }} gap={{base:4, md:6}}>
          <StatRoot>
            <StatLabel color={secondaryTextColor}>Ticket Price</StatLabel>
            <StatValueText color={primaryTextColor} fontSize="xl" fontWeight="bold">
              {ethers.utils.formatUnits(
                currentLottery.ticketPrice,
                USDC_DECIMALS
              )}{" "}
              USDC
            </StatValueText>
          </StatRoot>
          <StatRoot>
            <StatLabel color={secondaryTextColor}>Total Tickets Sold</StatLabel>
            <StatValueText color={primaryTextColor} fontSize="xl" fontWeight="bold">{currentLottery.totalTickets.toString()}</StatValueText>
          </StatRoot>
          <StatRoot>
            <StatLabel color={secondaryTextColor}>Current Prize Pool</StatLabel>
            <StatValueText color={primaryTextColor} fontSize="xl" fontWeight="bold">
              {ethers.utils.formatUnits(
                currentLottery.prizePool,
                USDC_DECIMALS
              )}{" "}
              USDC
            </StatValueText>
          </StatRoot>
          <StatRoot>
            <StatLabel color={secondaryTextColor}>Draw Date</StatLabel>
            <StatValueText color={primaryTextColor} fontSize="lg">
              {new Date(currentLottery.drawTime * 1000).toLocaleDateString()}
            </StatValueText>
            <StatHelpText color={secondaryTextColor}>
                {new Date(currentLottery.drawTime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </StatHelpText>
          </StatRoot>
          <StatRoot>
            <StatLabel color={secondaryTextColor}>Sale Ends</StatLabel>
            <StatValueText color={primaryTextColor} fontSize="lg">
              {new Date(currentLottery.endTime * 1000).toLocaleDateString()}
            </StatValueText>
             <StatHelpText color={secondaryTextColor}>
                {new Date(currentLottery.endTime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </StatHelpText>
          </StatRoot>
           <StatRoot>
            <StatLabel color={secondaryTextColor}>Status</StatLabel>
            <StatValueText color={primaryTextColor} fontSize="lg">
              {isLotteryDrawn ? "Drawn" : isLotteryActive ? "Active" : isLotteryNotStarted ? "Not Started" : "Awaiting Draw"}
            </StatValueText>
            <StatHelpText color={secondaryTextColor}>{statusHelpText}</StatHelpText>
          </StatRoot>
        </SimpleGrid>
      </VStack>
    </Box>
  );
};

export default LotteryInfo;