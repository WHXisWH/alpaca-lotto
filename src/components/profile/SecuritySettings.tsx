import React, { useState, useCallback } from 'react';
import { Box, VStack, HStack, Heading, Text, chakra, Code, Icon } from '@chakra-ui/react';
import { Button } from '@/components/ui/button';
import { toaster } from '@/components/ui/toaster';
import { useAAWallet } from '@/context/AAWalletContext';
import { useLottery } from '@/context/LotteryContext';
import { ethers } from 'ethers';
import { LOTTERY_CONTRACT_ADDRESS, SESSION_KEY_MANAGER_ADDRESS } from '@/config';
import { Alert } from '@/components/ui/alert';
import { FaKey, FaCopy, FaExclamationTriangle } from 'react-icons/fa';

const ChakraSelect = chakra("select");

export const SecuritySettings = () => {
    const { simpleAccount, aaWalletAddress, sendUserOp, isAAWalletInitialized } = useAAWallet();
    const { clearTransactionState } = useLottery();
    const [isGamingMode, setIsGamingMode] = useState(false);
    const [sessionWallet, setSessionWallet] = useState<ethers.Wallet | null>(null);
    const [validity, setValidity] = useState(3600);
    const [isLoading, setIsLoading] = useState(false);

    const cardBg = "white";
    const borderColor = "gray.200";
    const primaryTextColor = "yellow.900";
    const secondaryTextColor = "gray.700";
    const accentColor = "green.600";
    const warningBg = "orange.50";
    const warningBorderColor = "orange.200";
    const warningIconColor = "orange.500";
    
    const handleEnableMode = () => {
        const newSessionWallet = ethers.Wallet.createRandom();
        setSessionWallet(newSessionWallet);
        setIsGamingMode(true);
    };
    
    const handleDisableMode = () => {
        setSessionWallet(null);
        setIsGamingMode(false);
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
          toaster.create({ title: "Copied!", description: "Copied to clipboard.", type: "success" });
        });
    };

    const handleRegisterSessionKey = useCallback(async () => {
        if (!isAAWalletInitialized || !simpleAccount || !sessionWallet || !aaWalletAddress) {
            toaster.create({ title: "Error", description: "Wallet not initialized correctly.", type: "error" });
            return;
        }

        setIsLoading(true);
        clearTransactionState();

        try {
            // --- 核心改動在這裡 ---
            // 直接使用函数签名数组创建Interface，避免任何ABI解析问题
            const sessionKeyManagerInterface = new ethers.utils.Interface([
                "function registerSessionKey(address _sessionKey, uint256 _validUntil, address[] calldata _allowedTargets, bytes4[] calldata _allowedFunctions)"
            ]);
            
            const now = Math.floor(Date.now() / 1000);
            const validUntil = now + validity;

            // sighash for purchaseTicketsWithPLT(uint256,uint256)
            const purchaseWithPLTSighash = '0x01823815';

            const callData = sessionKeyManagerInterface.encodeFunctionData(
                "registerSessionKey", 
                [
                    sessionWallet.address,
                    validUntil,
                    [LOTTERY_CONTRACT_ADDRESS],
                    [purchaseWithPLTSighash] 
                ]
            );
            
            const builder = simpleAccount.execute(SESSION_KEY_MANAGER_ADDRESS, 0, callData);
            
            const response = await sendUserOp(builder);
            await response.wait();
            
            toaster.create({ title: "Success!", description: "Gaming Mode has been enabled. Your session key is now active.", type: "success", closable: true });
        } catch (error: any) {
            const errorMessage = error?.message || "Failed to enable Gaming Mode.";
            toaster.create({ title: "Operation Failed", description: errorMessage, type: "error", closable: true });
        } finally {
            setIsLoading(false);
        }

    }, [simpleAccount, sessionWallet, validity, isAAWalletInitialized, aaWalletAddress, sendUserOp, clearTransactionState]);


    return (
        <Box bg={cardBg} p={5} borderRadius="xl" borderWidth="1px" borderColor={borderColor} shadow="sm">
            <VStack gap={4} align="stretch">
                <HStack>
                    <Icon as={FaKey} color={accentColor} boxSize="24px" />
                    <Heading size="md" color={primaryTextColor}>Security & Automation</Heading>
                </HStack>
                
                <VStack p={4} bg="gray.50" borderRadius="lg" borderWidth="1px" borderColor="gray.200" align="stretch" gap={3}>
                    {!isGamingMode ? (
                        <>
                            <Text fontWeight="bold" color={primaryTextColor}>Gaming Mode is Disabled</Text>
                            <Text fontSize="sm" color={secondaryTextColor}>Enable automated ticket purchases using a temporary session key.</Text>
                            <Button colorPalette="green" onClick={handleEnableMode}>Enable Gaming Mode</Button>
                        </>
                    ) : (
                         <VStack align="stretch" gap={3}>
                             <Text fontWeight="bold" color={primaryTextColor}>Gaming Mode is Active</Text>
                             <Text fontSize="sm" fontWeight="medium">Set Validity:</Text>
                             <ChakraSelect bg="white" value={validity} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setValidity(Number(e.target.value))}>
                                 <option value={3600}>1 Hour</option>
                                 <option value={86400}>1 Day</option>
                                 <option value={604800}>7 Days</option>
                             </ChakraSelect>

                            {sessionWallet && (
                                <Box>
                                    <Alert status='warning' variant="subtle" borderRadius="lg" bg={warningBg} borderColor={warningBorderColor} borderWidth="1px" icon={<Icon as={FaExclamationTriangle} color={warningIconColor} />}>
                                       <VStack align="start" gap={1}>
                                            <Text fontWeight="bold" color={primaryTextColor}>Important: Save This Key!</Text>
                                            <Text fontSize="sm" color={secondaryTextColor}>
                                               For a real app, the backend would store this securely. For this demo, please save it if you wish to simulate backend actions.
                                            </Text>
                                        </VStack>
                                    </Alert>
                                    <HStack mt={2}>
                                      <Text fontSize="xs" flexShrink={0}>Session Pvt. Key:</Text>
                                      <Code fontSize="xs" p={1} borderRadius="md" title={sessionWallet.privateKey}>{sessionWallet.privateKey}</Code>
                                      <Button size="xs" onClick={() => copyToClipboard(sessionWallet.privateKey)}><FaCopy/></Button>
                                    </HStack>
                                </Box>
                            )}

                             <Button 
                                colorPalette="green" 
                                onClick={handleRegisterSessionKey}
                                loading={isLoading}
                                disabled={!sessionWallet || isLoading}
                             >
                                 Confirm and Register Key
                             </Button>
                             <Button variant="ghost" colorScheme="red" onClick={handleDisableMode} size="sm">
                                Disable Gaming Mode
                             </Button>
                         </VStack>
                    )}
                </VStack>
            </VStack>
        </Box>
    );
};