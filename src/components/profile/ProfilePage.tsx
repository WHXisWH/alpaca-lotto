import React, { useState, useEffect, useCallback } from 'react';
import { Box, VStack, Heading, Text, Separator } from '@chakra-ui/react';
import { Button } from '@/components/ui/button';
import { toaster } from '@/components/ui/toaster';
import { useAAWallet } from '@/context/AAWalletContext';
import { useLottery } from '@/context/LotteryContext';
import { achievementService, Achievement } from '@/services/achievementService';
import { Achievements } from './Achievements';
import { Leaderboard } from './Leaderboard';

export const ProfilePage = () => {
    const { aaWalletAddress, isAAWalletInitialized } = useAAWallet();
    const { dailyCheckIn, transaction: lotteryTransaction, clearTransactionState } = useLottery();
    const [achievements, setAchievements] = useState<Achievement[]>([]);

    useEffect(() => {
        if (aaWalletAddress) {
            setAchievements(achievementService.getAchievements(aaWalletAddress));
        }
    }, [aaWalletAddress, lotteryTransaction.successMessage]);

    const handleDailyCheckIn = useCallback(async () => {
        const checkinResult = await dailyCheckIn();

        setTimeout(() => {
            if (lotteryTransaction.error) {
                toaster.create({ title: "Check-in Failed", description: lotteryTransaction.error, type: 'error', closable: true });
            } else if (lotteryTransaction.successMessage && checkinResult) {
                toaster.create({ title: "Check-in Successful!", description: lotteryTransaction.successMessage, type: 'success', closable: true });
            }
            clearTransactionState();
        }, 0);
    }, [dailyCheckIn, lotteryTransaction, clearTransactionState]);

    if (!isAAWalletInitialized || !aaWalletAddress) {
        return <Text>Please connect and initialize your wallet.</Text>
    }

    return (
        <VStack gap={8} align="stretch">
            <Box textAlign="center">
                <Heading size="xl" color="yellow.900">Hall of Fame</Heading>
                <Text color="gray.600">Check your achievements and leaderboard rankings!</Text>
                 <Button 
                    mt={4}
                    colorPalette="green"
                    onClick={handleDailyCheckIn}
                    loading={lotteryTransaction.loading && lotteryTransaction.step === 'dailyCheckIn'}
                 >
                    Daily Check-in for 10 PLT
                </Button>
            </Box>

            <Separator />
            
            <Achievements achievements={achievements} />
            
            <Separator />

            <Leaderboard />
        </VStack>
    );
};