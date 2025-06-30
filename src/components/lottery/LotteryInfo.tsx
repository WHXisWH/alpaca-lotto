// src/components/lottery/LotteryInfo.tsx

import React, { useState, useEffect } from "react";
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

const calculateTimeLeft = (targetTime: number) => {
    const now = Math.floor(new Date().getTime() / 1000);
    const difference = targetTime - now;

    if (difference <= 0) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    }

    const days = Math.floor(difference / (60 * 60 * 24));
    const hours = Math.floor((difference % (60 * 60 * 24)) / (60 * 60));
    const minutes = Math.floor((difference % (60 * 60)) / 60);
    const seconds = Math.floor(difference % 60);

    return { days, hours, minutes, seconds };
};


export const LotteryInfo: React.FC = () => {
  const { selectedLotteryForInfo, transaction, fetchLotteryDetails } = useLottery();
  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft(0));

  const primaryTextColor = "yellow.900";
  const secondaryTextColor = "gray.700";
  const accentColor = "green.600";
  const cardBg = "yellow.50";
  const cardBorderColor = "gray.200";

  useEffect(() => {
    if (!selectedLotteryForInfo || selectedLotteryForInfo.drawn) {
      setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(selectedLotteryForInfo.drawTime));
    }, 1000);

    return () => clearInterval(timer);
  }, [selectedLotteryForInfo]);
  
  useEffect(() => {
    if (!selectedLotteryForInfo || selectedLotteryForInfo.drawn) return;
    
    const interval = setInterval(() => {
        fetchLotteryDetails(selectedLotteryForInfo.id);
    }, 15000);

    return () => clearInterval(interval);
  }, [selectedLotteryForInfo, fetchLotteryDetails]);

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
  
  const countdownText = `${timeLeft.days}d ${timeLeft.hours}h ${timeLeft.minutes}m ${timeLeft.seconds}s`;


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
            <StatLabel color={secondaryTextColor}>Draw Countdown</StatLabel>
            <StatValueText color={primaryTextColor} fontSize="lg">
              {isLotteryDrawn ? "Already Drawn" : countdownText}
            </StatValueText>
            <StatHelpText color={secondaryTextColor}>
                Draws at: {new Date(currentLottery.drawTime * 1000).toLocaleDateString()} {new Date(currentLottery.drawTime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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