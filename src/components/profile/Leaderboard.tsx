import React, { useState, useEffect } from 'react';
import { Box, Heading, VStack, HStack, Text, Icon, Center } from '@chakra-ui/react';
import { FaTrophy, FaUserFriends, FaMedal } from 'react-icons/fa';
import { LoadingAlpaca } from '../common';

interface ReferralData {
  rank: number;
  referrer_address: string;
  referral_count: string;
}

const MOCK_WINNINGS_DATA = [
  { rank: 1, address: '0xabc...123', amount: '1,500 USDC' },
  { rank: 2, address: '0xdef...456', amount: '980 USDC' },
  { rank: 3, address: '0xghi...789', amount: '750 USDC' },
];

const getRankColor = (rank: number) => {
  if (rank === 1) return 'gold';
  if (rank === 2) return 'silver';
  if (rank === 3) return '#cd7f32';
  return 'gray.500';
};

export const Leaderboard = () => {
    const cardBg = "white";
    const borderColor = "gray.200";
    const headingColor = "green.600";
    const textColor = "yellow.900";
    const secondaryTextColor = "gray.600";
    
    const [referralData, setReferralData] = useState<ReferralData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      const fetchReferralData = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const backendApiUrl = import.meta.env.VITE_BACKEND_API_URL;
          if (!backendApiUrl) {
            throw new Error("Backend API URL is not configured.");
          }
          const response = await fetch(`${backendApiUrl}/api/leaderboard/referrals`);
          
          if (!response.ok) {
            throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
          }

          const result = await response.json();

          if (result.success && Array.isArray(result.data)) {
            const rankedData = result.data.map((item: any, index: number) => ({
              ...item,
              rank: index + 1,
            }));
            setReferralData(rankedData);
          } else {
            throw new Error(result.message || 'Failed to fetch referral data.');
          }
        } catch (err: any) {
          setError(err.message || "An unknown error occurred.");
        } finally {
          setIsLoading(false);
        }
      };

      fetchReferralData();
    }, []);
    
  return (
    <Box>
      <VStack gap={8} align="stretch">
        <Box bg={cardBg} p={5} borderRadius="xl" borderWidth="1px" borderColor={borderColor} shadow="sm">
            <HStack mb={4}>
                <Icon as={FaUserFriends} color={headingColor} boxSize="24px" />
                <Heading size="md" color={textColor}>Referral Masters</Heading>
            </HStack>
            <VStack gap={3} align="stretch">
                {isLoading ? (
                  <Center h="100px">
                    <LoadingAlpaca size="60px" />
                  </Center>
                ) : error ? (
                  <Center h="100px">
                    <Text color="red.500">{error}</Text>
                  </Center>
                ) : referralData.length === 0 ? (
                  <Center h="100px">
                    <Text color={secondaryTextColor}>No referral data yet. Be the first!</Text>
                  </Center>
                ) : (
                  referralData.map(user => (
                      <HStack key={user.rank} justifyContent="space-between" p={2} borderRadius="md" _hover={{bg: "yellow.50"}}>
                          <HStack>
                              <Icon as={FaMedal} color={getRankColor(user.rank)} />
                              <Text color={secondaryTextColor}>{`${user.referrer_address.substring(0, 6)}...${user.referrer_address.substring(user.referrer_address.length - 4)}`}</Text>
                          </HStack>
                          <Text fontWeight="bold" color={textColor}>{user.referral_count} referrals</Text>
                      </HStack>
                  ))
                )}
            </VStack>
        </Box>
        <Box bg={cardBg} p={5} borderRadius="xl" borderWidth="1px" borderColor={borderColor} shadow="sm">
            <HStack mb={4}>
                <Icon as={FaTrophy} color={headingColor} boxSize="24px" />
                <Heading size="md" color={textColor}>Top Winners</Heading>
            </HStack>
            <VStack gap={3} align="stretch">
                 {MOCK_WINNINGS_DATA.map(user => (
                     <HStack key={user.rank} justifyContent="space-between" p={2} borderRadius="md" _hover={{bg: "yellow.50"}}>
                        <HStack>
                            <Icon as={FaMedal} color={getRankColor(user.rank)} />
                            <Text color={secondaryTextColor}>{user.address}</Text>
                        </HStack>
                        <Text fontWeight="bold" color={textColor}>{user.amount}</Text>
                    </HStack>
                ))}
            </VStack>
        </Box>
      </VStack>
    </Box>
  );
};