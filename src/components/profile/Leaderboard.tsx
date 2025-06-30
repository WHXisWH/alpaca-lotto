// src/components/profile/Leaderboard.tsx
import React from 'react';
import { Box, Heading, VStack, HStack, Text, Icon, Image } from '@chakra-ui/react';
import { FaTrophy, FaUserFriends, FaMedal } from 'react-icons/fa';

const MOCK_REFERRAL_DATA = [
  { rank: 1, address: '0x123...abc', referrals: 52, avatar: '/images/alpaca-avatar-1.png' },
  { rank: 2, address: '0x456...def', referrals: 45, avatar: '/images/alpaca-avatar-2.png' },
  { rank: 3, address: '0x789...ghi', referrals: 38, avatar: '/images/alpaca-avatar-3.png' },
];

const MOCK_WINNINGS_DATA = [
  { rank: 1, address: '0xabc...123', amount: '1,500 USDC', avatar: '/images/alpaca-avatar-4.png' },
  { rank: 2, address: '0xdef...456', amount: '980 USDC', avatar: '/images/alpaca-avatar-5.png' },
  { rank: 3, address: '0xghi...789', amount: '750 USDC', avatar: '/images/alpaca-avatar-6.png' },
];

const getRankColor = (rank: number) => {
  if (rank === 1) return 'gold';
  if (rank === 2) return 'silver';
  if (rank === 3) return '#cd7f32'; // Bronze
  return 'gray.500';
};

export const Leaderboard = () => {
    const cardBg = "white";
    const borderColor = "gray.200";
    const headingColor = "green.600";
    const textColor = "yellow.900";
    const secondaryTextColor = "gray.600";
    
  return (
    <Box>
      <Heading size="lg" color={headingColor} mb={4}>Hall of Fame</Heading>
      <VStack gap={8} align="stretch">
        <Box bg={cardBg} p={5} borderRadius="xl" borderWidth="1px" borderColor={borderColor} shadow="sm">
            <HStack mb={4}>
                <Icon as={FaUserFriends} color={headingColor} boxSize="24px" />
                <Heading size="md" color={textColor}>Referral Masters</Heading>
            </HStack>
            <VStack gap={3} align="stretch">
                {MOCK_REFERRAL_DATA.map(user => (
                    <HStack key={user.rank} justifyContent="space-between" p={2} borderRadius="md" _hover={{bg: "yellow.50"}}>
                        <HStack>
                            <Icon as={FaMedal} color={getRankColor(user.rank)} />
                            <Image src={user.avatar} boxSize="24px" borderRadius="full" alt="User Avatar" />
                            <Text color={secondaryTextColor}>{user.address}</Text>
                        </HStack>
                        <Text fontWeight="bold" color={textColor}>{user.referrals} referrals</Text>
                    </HStack>
                ))}
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
                            <Image src={user.avatar} boxSize="24px" borderRadius="full" alt="User Avatar" />
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