import React from "react";
import { SimpleGrid, Box, Text, Spinner, VStack, Image, Heading } from "@chakra-ui/react";
import { useLottery } from "@/context/LotteryContext";
import { TicketCard } from "./TicketCard";
import { useAAWallet } from "@/context/AAWalletContext";

export const TicketGrid: React.FC = () => {
  const { lotteries, transaction } = useLottery();
  const { isAAWalletInitialized, loading: aaLoading } = useAAWallet();
  const primaryTextColor = "yellow.900";
  const secondaryTextColor = "gray.700";
  const accentColor = "green.600";
  const cardBg = "yellow.50";
  const borderColor = "gray.200";

  if (aaLoading) {
    return <Spinner color={accentColor} />;
  }
  if (!isAAWalletInitialized) {
    return (
      <Text color={secondaryTextColor}>
        Please connect your wallet and initialize AA Wallet to see lotteries.
      </Text>
    );
  }
  if (transaction.loading && lotteries.length === 0) {
    return <Spinner color={accentColor} />;
  }

  const now = new Date().getTime() / 1000;
  const availableLotteries = lotteries.filter(lottery => !lottery.drawn && lottery.drawTime > now);

  if (availableLotteries.length === 0) {
    return (
        <VStack bg={cardBg} p={10} borderRadius="2xl" gap={4} borderWidth="1px" borderColor={borderColor} shadow="sm">
            <Image src="/images/alpaca-searching.png" alt="An alpaca searching with binoculars" height={{ base: "100px", md: "120px" }} width="auto" objectFit="contain" mx="auto" />
            <Heading size="md" color={primaryTextColor}>No Available Lotteries</Heading>
            <Text color={secondaryTextColor}>There are no lotteries available for purchase at the moment. Please check back soon!</Text>
        </VStack>
    );
  }

  return (
    <Box mt={6}>
      <Heading fontSize={{base:"xl", md:"2xl"}} mb={4} fontWeight="bold" color={primaryTextColor}>
        Available Lotteries
      </Heading>
      <SimpleGrid columns={{ sm: 1, md: 2, lg: 3 }} gap={{base:4, md:6}}>
        {availableLotteries.map((lottery) => (
          <TicketCard key={lottery.id} lottery={lottery} />
        ))}
      </SimpleGrid>
    </Box>
  );
};

export default TicketGrid;