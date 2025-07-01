import React, { useEffect, useState, useCallback } from "react";
import {
  Box,
  VStack,
  HStack,
  Heading,
  Text,
  Code,
  Icon,
  Flex,
  Spacer,
  Tabs,
  Image,
  useDisclosure,
  Link as ChakraLink,
} from "@chakra-ui/react";
import { Button as UIButton } from "@/components/ui/button";
import { CloseButton as UICloseButton } from "@/components/ui/close-button";
import { Alert as UIAlert } from "@/components/ui/alert";
import { useAccount, useDisconnect } from "wagmi";
import { Layout } from "./components/layout";
import { ConnectWallet, LoadingAlpaca } from "./components/common";
import {
  PaymasterSettings,
  TicketGrid,
  OwnedTickets,
  LotteryInfo,
} from "./components/lottery";
import { Web2UserDashboardMockup } from "./components/web2_user/Web2UserDashboardMockup";
import { ReferralDialog } from "./components/referral/ReferralDialog";
import { HowToPlayDialog } from "./components/play_guide/HowToPlayDialog";
import { TransactionStatusDialog } from "./components/lottery/TransactionStatusDialog";
import { ProfilePage } from './components/profile';
import { useAAWallet } from "./context/AAWalletContext";
import { usePaymaster, SupportedToken } from "./context/PaymasterContext";
import { useLottery } from "./context/LotteryContext";
import { MdWarning, MdCopyAll, MdRefresh, MdExpandMore, MdExpandLess, MdLeaderboard } from "react-icons/md";
import { ethers, BigNumber } from "ethers";
import { RPC_URL, TOKEN_LIST } from "./config";
import { toaster } from "@/components/ui/toaster";

const ERC20_ABI_MINIMAL = [
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

function App() {
  const { isConnected } = useAccount();
  const { disconnect: wagmiDisconnect } = useDisconnect();

  const {
    isAAWalletInitialized,
    aaWalletAddress,
    loading: aaLoading,
    error: aaError,
    clearError: clearAAError,
    isSocialLoggedIn,
    disconnectSocialLogin,
    clearAAState,
  } = useAAWallet();

  const {
    error: paymasterError,
    clearError: clearPaymasterError,
    supportedTokens
  } = usePaymaster();

  const { lotteries, setSelectedLotteryForInfo: contextSetSelectedLottery, transaction, clearTransactionState } = useLottery();

  const [tokenBalances, setTokenBalances] = useState<Record<string, { balance: string; isLoading: boolean }>>({});
  const [isGasPanelOpen, setIsGasPanelOpen] = useState<boolean>(true);
  const [currentTab, setCurrentTab] = useState<string>("buyTickets");

  const { open: isReferralDialogOpen, onOpen: onReferralDialogOpen, onClose: onReferralDialogClose } = useDisclosure();
  const { open: isHowToPlayDialogOpen, onOpen: onHowToPlayDialogOpen, onClose: onHowToPlayDialogClose } = useDisclosure();
  const { open: isTxModalOpen, onOpen: onTxModalOpen, onClose: onTxModalClose } = useDisclosure();


  const toggleGasPanel = () => setIsGasPanelOpen(!isGasPanelOpen);

  const appContainerBg = "white";
  const globalInfoBg = "yellow.50";
  const borderColor = "gray.200";
  const selectedTabBg = "yellow.50";
  const defaultTabBg = "white";
  const primaryTextColor = "yellow.900";
  const secondaryTextColor = "gray.700";
  const accentColor = "green.600";

  const fetchTokenBalance = useCallback(async (token: SupportedToken) => {
    if (!aaWalletAddress || !isAAWalletInitialized || token.address.startsWith('0x0000')) {
      if (token.symbol) {
        setTokenBalances(prev => ({ ...prev, [token.symbol]: { balance: "0.00", isLoading: false } }));
      }
      return;
    }
    setTokenBalances(prev => ({ ...prev, [token.symbol]: { balance: "0.00", isLoading: true } }));
    try {
      const readerProvider = new ethers.providers.JsonRpcProvider(RPC_URL);
      const tokenContract = new ethers.Contract(token.address, ERC20_ABI_MINIMAL, readerProvider);
      const balanceBN: BigNumber = await tokenContract.balanceOf(aaWalletAddress);
      const formattedBalance = ethers.utils.formatUnits(balanceBN, token.decimals);
      const numberBalance = parseFloat(formattedBalance);
      const displayBalance = isNaN(numberBalance) ? "Error" : numberBalance.toFixed(2);
      setTokenBalances(prev => ({ ...prev, [token.symbol]: { balance: displayBalance, isLoading: false } }));
    } catch (e) {
      setTokenBalances(prev => ({ ...prev, [token.symbol]: { balance: "Error", isLoading: false } }));
    }
  }, [aaWalletAddress, isAAWalletInitialized]);

  const fetchAllBalances = useCallback(() => {
    const tokensToFetch = TOKEN_LIST.filter(t => t.address);
    if(supportedTokens && supportedTokens.length > 0) {
        supportedTokens.forEach(st => {
            if(!tokensToFetch.some(t => t.address.toLowerCase() === st.address.toLowerCase())) {
                tokensToFetch.push(st);
            }
        });
    }
    tokensToFetch.forEach(fetchTokenBalance);
  }, [fetchTokenBalance, supportedTokens]);

  useEffect(() => {
    if (isAAWalletInitialized) {
      fetchAllBalances();
    } else {
      setTokenBalances({});
    }
  }, [isAAWalletInitialized, fetchAllBalances, transaction.successMessage]);

  useEffect(() => {
    if (lotteries.length > 0 && contextSetSelectedLottery) {
        const now = new Date().getTime() / 1000;
        const activeLottery = lotteries.find(l => l.endTime > now && l.startTime <= now && !l.drawn);
        if (activeLottery) {
            contextSetSelectedLottery(activeLottery);
        } else {
            const notDrawnLotteries = lotteries.filter(l => !l.drawn);
            if (notDrawnLotteries.length > 0) {
                 contextSetSelectedLottery(notDrawnLotteries.sort((a,b) => b.drawTime - a.drawTime)[0] || notDrawnLotteries[0]);
            } else {
                 contextSetSelectedLottery(lotteries.sort((a,b) => b.drawTime - a.drawTime)[0] || lotteries[0]);
            }
        }
    } else if (lotteries.length === 0 && contextSetSelectedLottery) {
        contextSetSelectedLottery(null);
    }
  }, [lotteries, contextSetSelectedLottery]);

  useEffect(() => {
    if(transaction.loading || transaction.error || transaction.successMessage) {
        onTxModalOpen();
    } else {
        onTxModalClose();
    }
  }, [transaction.loading, transaction.error, transaction.successMessage, onTxModalOpen, onTxModalClose]);

  const handleFullDisconnect = async () => {
    if (isSocialLoggedIn) {
      await disconnectSocialLogin();
    }

    if (isConnected) {
      wagmiDisconnect();
    }
    
    if (!isSocialLoggedIn) {
      clearAAState();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toaster.create({ title: "Copied!", description: "Address copied to clipboard.", type: "success" });
    }).catch(err => {
    });
  };

  const handleTabChange = (details: { value: string }) => {
    setCurrentTab(details.value);
  };

  return (
    <Layout
        onOpenReferralModal={isAAWalletInitialized ? onReferralDialogOpen : undefined}
        onOpenHowToPlayDialog={onHowToPlayDialogOpen}
    >
      <Box bg={appContainerBg} p={{base:3, md:5}} borderRadius="2xl" minH="80vh" shadow="sm" borderWidth="1px" borderColor={borderColor}>
        <VStack gap={4} align="stretch" width="100%">
          {!isAAWalletInitialized && !aaLoading && (
            <>
              <ConnectWallet />
              <Text textAlign="center" mt={2}>
                New to Alpaca Lotto?{' '}
                <ChakraLink color={accentColor} fontWeight="semibold" onClick={onHowToPlayDialogOpen} cursor="pointer">
                  Check out how to play!
                </ChakraLink>
              </Text>
            </>
          )}

          {aaError && (
            <UIAlert
              status="error"
              variant="solid"
              mt={2}
              bg="red.500"
              borderColor="red.300"
              icon={<Icon as={MdWarning} boxSize={5} color="white" />}
              borderRadius="xl"
            >
              <VStack align="start" gap={1}>
                  <Text fontWeight="bold" color="white">Account Error</Text>
                  <Text fontSize="sm" color="red.100">{aaError}</Text>
              </VStack>
              <UICloseButton
                onClick={clearAAError}
                position="absolute"
                right="8px"
                top="8px"
                size="sm"
                color="white"
                _hover={{bg: "red.600"}}
                borderRadius="md"
              />
            </UIAlert>
          )}

          {paymasterError && (
            <UIAlert
              status="error"
              variant="solid"
              mt={2}
              bg="red.500"
              borderColor="red.300"
              icon={<Icon as={MdWarning} boxSize={5} color="white" />}
              borderRadius="xl"
            >
               <VStack align="start" gap={1}>
                  <Text fontWeight="bold" color="white">System Error</Text>

                  <Text fontSize="sm" color="red.100">{paymasterError}</Text>
              </VStack>
              <UICloseButton
                onClick={clearPaymasterError}
                position="absolute"
                right="8px"
                top="8px"
                size="sm"
                color="white"
                 _hover={{bg: "red.600"}}
                 borderRadius="md"
              />
            </UIAlert>
          )}

          {aaLoading && !isAAWalletInitialized && (
              <VStack bg="white" p={6} borderRadius="xl" gap={4} alignItems="center" shadow="md" borderColor={borderColor} borderWidth="1px" mt={2}>
                  <LoadingAlpaca />
                  <Text color={primaryTextColor} fontWeight="medium" fontSize="lg">Initializing Your Smart Account...</Text>
              </VStack>
          )}

          {isAAWalletInitialized && aaWalletAddress && (
            <Box
              p={4}
              borderWidth="1px"
              borderRadius="xl"
              bg={globalInfoBg}
              borderColor={borderColor}
              shadow="sm"
            >
              <Flex direction={{base: "column", md: "row"}} alignItems={{base: "flex-start", md: "center"}} gap={{base: 3, md: 4}}>
                <Box>
                  <Text fontSize="xs" color={secondaryTextColor}>Smart Account:</Text>
                  <HStack>
                    <Code
                      color="green.700"
                      variant="subtle"
                      bg="green.100"
                      px={2}
                      py={1}
                      borderRadius="lg"
                      fontSize="sm"
                      fontWeight="medium"
                    >
                      {`${aaWalletAddress.substring(0, 6)}...${aaWalletAddress.substring(aaWalletAddress.length - 4)}`}
                    </Code>
                    <UIButton
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(aaWalletAddress)}
                      color={secondaryTextColor}
                      _hover={{ color: accentColor, bg: "yellow.100" }}
                      aria-label="Copy address"
                      px={1}
                      minW="auto"
                      borderRadius="md"
                    >
                      <Icon as={MdCopyAll} boxSize={5}/>
                    </UIButton>
                  </HStack>
                </Box>
                <HStack>
                    <Text fontSize="xs" color={secondaryTextColor}>
                        Token Balances
                    </Text>
                    <UIButton
                        size="sm"
                        variant="ghost"
                        onClick={(e) => { e.stopPropagation(); fetchAllBalances(); }}
                        color={secondaryTextColor}
                        _hover={{ color: accentColor, bg: "yellow.100" }}
                        aria-label="Refresh Balances"
                        loading={Object.values(tokenBalances).some(b => b.isLoading)}
                        px={1}
                        minW="auto"
                        borderRadius="md"
                    >
                        <Icon as={MdRefresh} boxSize={5} />
                    </UIButton>
                </HStack>
                <Spacer display={{base:"none", md:"block"}}/>
                <UIButton
                  variant="outline"
                  size="sm"
                  onClick={handleFullDisconnect}
                  mt={{base: 2, md: 0}}
                  borderRadius="lg"
                  color="red.600"
                  borderColor="red.300"
                  _hover={{transform: 'scale(1.02)', bg: 'red.50'}}
                  _active={{transform: 'scale(0.98)', bg: 'red.100'}}
                >
                  Disconnect
                </UIButton>
              </Flex>

              <HStack wrap="wrap" gap={4} mt={3} p={2} bg="whiteAlpha.500" borderRadius="md">
                  {Object.entries(tokenBalances).map(([symbol, { balance, isLoading }]) => (
                      <Box key={symbol}>
                          <Text fontSize="xs" color={secondaryTextColor}>{symbol}:</Text>
                          <Text fontSize="sm" fontWeight="bold" color={primaryTextColor}>
                              {isLoading ? <LoadingAlpaca size="20px" /> : balance}
                          </Text>
                      </Box>
                  ))}
              </HStack>

              <Box mt={4} borderWidth="1px" borderColor={borderColor} borderRadius="xl" overflow="hidden" bg="white">
                <Flex
                  as="header"
                  p={3}
                  onClick={toggleGasPanel}
                  cursor="pointer"
                  alignItems="center"
                  _hover={{bg: "gray.50"}}
                  borderBottomWidth={isGasPanelOpen ? "1px" : "0px"}
                  borderColor={borderColor}
                  transition="all 0.2s ease-in-out"
                >
                  <Heading size="sm" color={primaryTextColor}>Gas Payment Options</Heading>
                  <Spacer />
                  <Icon as={isGasPanelOpen ? MdExpandLess : MdExpandMore} boxSize={6} color={secondaryTextColor}/>
                </Flex>
                {isGasPanelOpen && (
                  <PaymasterSettings />
                )}
              </Box>
            </Box>
          )}

          {isAAWalletInitialized && (
             <Tabs.Root
                defaultValue="buyTickets"
                value={currentTab}
                onValueChange={handleTabChange}
                mt={4}
                width="100%"
            >
                <Tabs.List
                    borderBottomWidth="1px"
                    borderColor={borderColor}
                    borderTopRadius="xl"
                >
                    <Tabs.Trigger
                        value="buyTickets"
                        flex={1}
                        py={3}
                        fontSize="md"
                        fontWeight="semibold"
                        color={currentTab === "buyTickets" ? accentColor : secondaryTextColor}
                        bg={currentTab === "buyTickets" ? selectedTabBg : defaultTabBg}
                        borderTopLeftRadius="xl"
                        borderBottomWidth={"2px"}
                        borderBottomColor={currentTab === "buyTickets" ? accentColor : "transparent"}
                        _hover={{bg: "yellow.100", color: primaryTextColor}}
                        transition="all 0.2s ease-in-out"
                    >
                        Buy Tickets
                    </Tabs.Trigger>
                    <Tabs.Trigger
                        value="myTickets"
                        flex={1}
                        py={3}
                        fontSize="md"
                        fontWeight="semibold"
                        color={currentTab === "myTickets" ? accentColor : secondaryTextColor}
                        bg={currentTab === "myTickets" ? selectedTabBg : defaultTabBg}
                        borderBottomWidth={"2px"}
                        borderBottomColor={currentTab === "myTickets" ? accentColor : "transparent"}
                        _hover={{bg: "yellow.100", color: primaryTextColor}}
                        transition="all 0.2s ease-in-out"
                    >
                        My Tickets
                    </Tabs.Trigger>
                    <Tabs.Trigger
                        value="hallOfFame"
                        flex={1}
                        py={3}
                        fontSize="md"
                        fontWeight="semibold"
                        color={currentTab === "hallOfFame" ? accentColor : secondaryTextColor}
                        bg={currentTab === "hallOfFame" ? selectedTabBg : defaultTabBg}
                        borderTopRightRadius="xl"
                        borderBottomWidth={"2px"}
                        borderBottomColor={currentTab === "hallOfFame" ? accentColor : "transparent"}
                        _hover={{bg: "yellow.100", color: primaryTextColor}}
                        transition="all 0.2s ease-in-out"
                        gap={2}
                    >
                        <Icon as={MdLeaderboard}/>
                        Hall of Fame
                    </Tabs.Trigger>
                </Tabs.List>

                <Box
                    borderWidth="0px 1px 1px 1px"
                    borderColor={borderColor}
                    borderBottomRadius="xl"
                    bg={currentTab !== "buyTickets" ? defaultTabBg : selectedTabBg}
                    shadow="sm"
                >
                    <Tabs.Content value="buyTickets" p={{base:4, md:6}}>
                        <VStack gap={6} width="100%">
                          {isSocialLoggedIn && currentTab === "buyTickets" && <Web2UserDashboardMockup />}
                          <LotteryInfo />
                          <TicketGrid />
                        </VStack>
                    </Tabs.Content>
                    <Tabs.Content value="myTickets" p={{base:4, md:6}}>
                        <OwnedTickets />
                    </Tabs.Content>
                    <Tabs.Content value="hallOfFame" p={{base:4, md:6}}>
                        <ProfilePage />
                    </Tabs.Content>
                </Box>
            </Tabs.Root>
          )}

          {!isAAWalletInitialized && !aaLoading && (
            <VStack gap={4} textAlign="center" mt={8} pb={10}>
                <Heading size={{base:"lg", md:"xl"}} color={primaryTextColor}>Welcome to Alpaca Lotto!</Heading>
                <Text color={secondaryTextColor} fontSize={{base:"md", md:"lg"}}>
                    Connect your wallet or use social login to start your lucky adventure!
                </Text>
            </VStack>
          )}
        </VStack>
      </Box>
      <ReferralDialog isOpen={isReferralDialogOpen} onClose={onReferralDialogClose} />
      <HowToPlayDialog isOpen={isHowToPlayDialogOpen} onClose={onHowToPlayDialogClose} />
      <TransactionStatusDialog
        isOpen={isTxModalOpen}
        onClose={() => { onTxModalClose(); clearTransactionState(); }}
        transactionState={transaction}
      />
    </Layout>
  );
}

export default App;