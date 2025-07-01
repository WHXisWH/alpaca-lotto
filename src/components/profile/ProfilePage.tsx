import React, { useState, useEffect, useCallback } from 'react';
import { Box, VStack, Heading, Text, Separator, Center, Tabs, Icon } from '@chakra-ui/react';
import { Button } from '@/components/ui/button';
import { toaster } from '@/components/ui/toaster';
import { useAAWallet } from '@/context/AAWalletContext';
import { useLottery } from '@/context/LotteryContext';
import { achievementService, Achievement } from '@/services/achievementService';
import { Achievements } from './Achievements';
import { Leaderboard } from './Leaderboard';
import { SecuritySettings } from './SecuritySettings';
import { LoadingAlpaca } from '../common';
import { FaMedal, FaTrophy, FaShieldAlt } from 'react-icons/fa';

export const ProfilePage = () => {
    const { aaWalletAddress, isAAWalletInitialized } = useAAWallet();
    const { dailyCheckIn, transaction: lotteryTransaction, clearTransactionState } = useLottery();
    const [achievements, setAchievements] = useState<Achievement[]>([]);
    const [isLoadingAchievements, setIsLoadingAchievements] = useState(true);
    const [currentTab, setCurrentTab] = useState('achievements');

    useEffect(() => {
        if (aaWalletAddress) {
            setIsLoadingAchievements(true);
            setAchievements(achievementService.getAchievements(aaWalletAddress));
            setIsLoadingAchievements(false);
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

    const accentColor = "green.600";
    const primaryTextColor = "yellow.900";
    const secondaryTextColor = "gray.700";
    const selectedTabBg = "yellow.50";
    const defaultTabBg = "white";
    const borderColor = "gray.200";

    const handleTabChange = (details: { value: string }) => {
        setCurrentTab(details.value);
    };

    return (
        <VStack gap={6} align="stretch">
            <Box textAlign="center">
                <Heading size="xl" color={primaryTextColor}>Hall of Fame & Settings</Heading>
                <Text color={secondaryTextColor}>Check your achievements, rankings, and manage account settings!</Text>
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

            <Tabs.Root
                defaultValue="achievements"
                value={currentTab}
                onValueChange={handleTabChange}
                width="100%"
                variant="outline"
                size="md"
            >
                <Tabs.List
                    borderBottomWidth="2px"
                    borderColor={borderColor}
                >
                    <Tabs.Trigger
                        value="achievements"
                        flex="1"
                        py={3}
                        fontSize="sm"
                        fontWeight="semibold"
                        color={currentTab === "achievements" ? accentColor : secondaryTextColor}
                        bg={currentTab === "achievements" ? selectedTabBg : defaultTabBg}
                        borderTopRadius="lg"
                        borderBottomColor={currentTab === "achievements" ? accentColor : "transparent"}
                        _hover={{bg: "yellow.100", color: primaryTextColor}}
                        transition="all 0.2s ease-in-out"
                        gap={2}
                    >
                        <Icon as={FaMedal} />
                        My Badge Wall
                    </Tabs.Trigger>
                     <Tabs.Trigger
                        value="leaderboards"
                        flex="1"
                        py={3}
                        fontSize="sm"
                        fontWeight="semibold"
                        color={currentTab === "leaderboards" ? accentColor : secondaryTextColor}
                        bg={currentTab === "leaderboards" ? selectedTabBg : defaultTabBg}
                        borderTopRadius="lg"
                        borderBottomColor={currentTab === "leaderboards" ? accentColor : "transparent"}
                        _hover={{bg: "yellow.100", color: primaryTextColor}}
                        transition="all 0.2s ease-in-out"
                        gap={2}
                    >
                        <Icon as={FaTrophy} />
                        Leaderboards
                    </Tabs.Trigger>
                    <Tabs.Trigger
                        value="settings"
                        flex="1"
                        py={3}
                        fontSize="sm"
                        fontWeight="semibold"
                        color={currentTab === "settings" ? accentColor : secondaryTextColor}
                        bg={currentTab === "settings" ? selectedTabBg : defaultTabBg}
                        borderTopRadius="lg"
                        borderBottomColor={currentTab === "settings" ? accentColor : "transparent"}
                        _hover={{bg: "yellow.100", color: primaryTextColor}}
                        transition="all 0.2s ease-in-out"
                        gap={2}
                    >
                         <Icon as={FaShieldAlt} />
                        Security
                    </Tabs.Trigger>
                </Tabs.List>
                <Box
                    borderWidth="0px 1px 1px 1px"
                    borderColor={borderColor}
                    borderBottomRadius="xl"
                    bg={defaultTabBg}
                    p={{base: 4, md: 6}}
                    mt="-2px"
                >
                    <Tabs.Content value="achievements">
                        {isLoadingAchievements ? (
                            <Center h="200px">
                                <LoadingAlpaca size="80px" />
                            </Center>
                        ) : (
                            <Achievements achievements={achievements} />
                        )}
                    </Tabs.Content>
                    <Tabs.Content value="leaderboards">
                        <Leaderboard />
                    </Tabs.Content>
                    <Tabs.Content value="settings">
                        <SecuritySettings />
                    </Tabs.Content>
                </Box>
            </Tabs.Root>
        </VStack>
    );
};