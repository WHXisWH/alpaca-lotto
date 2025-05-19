import React from "react";
import { SimpleGrid, Box, Text, Spinner } from "@chakra-ui/react";
import { useLottery } from "@/context/LotteryContext";
import { TicketCard } from "./TicketCard";
import { useAAWallet } from "@/context/AAWalletContext";

export const TicketGrid: React.FC = () => {
  const { lotteries, transaction } = useLottery();
  const { isAAWalletInitialized, loading: aaLoading } = useAAWallet();

  if (aaLoading) {
    return <Spinner />;
  }
  if (!isAAWalletInitialized) {
    return (
      <Text>
        Please connect your wallet and initialize AA Wallet to see lotteries.
      </Text>
    );
  }
  if (transaction.loading && lotteries.length === 0) {
    return <Spinner />;
  }
  if (lotteries.length === 0 && !transaction.loading) {
    return <Text>No lotteries available at the moment.</Text>;
  }

  return (
    <Box>
      <Text fontSize="2xl" mb={4} fontWeight="bold">
        Available Lotteries
      </Text>
      <SimpleGrid columns={{ sm: 1, md: 2, lg: 3 }} gap={6}>
        {lotteries.map((lottery) => (
          <TicketCard key={lottery.id} lottery={lottery} />
        ))}
      </SimpleGrid>
    </Box>
  );
};

export default TicketGrid;