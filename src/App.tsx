import React, { useEffect, useState, useCallback } from "react";
import {
  Box,
  VStack,
  HStack,
  Heading,
  Text,
  Spinner,
  Code,
  Icon,
  Flex,
  Spacer,
  Tabs,
  Image,
  useDisclosure, 
} from "@chakra-ui/react";
import { Button as UIButton } from "@/components/ui/button";
import { CloseButton as UICloseButton } from "@/components/ui/close-button";
import { Alert as UIAlert } from "@/components/ui/alert";
import { useAccount, useDisconnect } from "wagmi";
import { useEthersSigner } from "./utils/ethersAdapters";
import { Layout } from "./components/layout";
import { ConnectWallet } from "./components/common";
import {
  PaymasterSettings,
  TicketGrid,
  OwnedTickets,
  LotteryInfo,
} from "./components/lottery";
import { Web2UserDashboardMockup } from "./components/web2_user/Web2UserDashboardMockup";
import { ReferralDialog } from "./components/referral/ReferralModal"; 
import { useAAWallet } from "./context/AAWalletContext";
import { usePaymaster } from "./context/PaymasterContext";
import { useLottery } from "./context/LotteryContext";
import { MdWarning, MdCopyAll, MdRefresh, MdExpandMore, MdExpandLess } from "react-icons/md";
import { ethers, BigNumber } from "ethers";
import { USDC_TOKEN_ADDRESS, USDC_DECIMALS, RPC_URL } from "./config";
import { toaster } from "@/components/ui/toaster";

const ERC20_ABI_MINIMAL = [
  "function balanceOf(address account) view returns (uint256)",
];

function App() {
  const { address: wagmiEoaAddress, isConnected, chain } = useAccount();
  const ethersSigner = useEthersSigner({ chainId: chain?.id });
  const { disconnect: wagmiDisconnect } = useDisconnect();

  const {
    initializeAAWallet,
    isAAWalletInitialized,
    aaWalletAddress,
    loading: aaLoading,
    error: aaError,
    clearError: clearAAError,
    isSocialLoggedIn,
    disconnectSocialLogin,
  } = useAAWallet();

  const {
    error: paymasterError,
    clearError: clearPaymasterError,
  } = usePaymaster();

  const { lotteries, setSelectedLotteryForInfo: contextSetSelectedLottery } = useLottery();

  const [usdcBalance, setUsdcBalance] = useState<string>("0.00");
  const [isBalanceLoading, setIsBalanceLoading] = useState<boolean>(false);
  const [isGasPanelOpen, setIsGasPanelOpen] = useState<boolean>(true);
  const [currentTab, setCurrentTab] = useState<string>("buyTickets");

  const { open: isReferralModalOpen, onOpen: onReferralModalOpen, onClose: onReferralModalClose } = useDisclosure();

  const toggleGasPanel = () => setIsGasPanelOpen(!isGasPanelOpen);

  const appContainerBg = "white"; 
  const globalInfoBg = "yellow.50"; 
  const borderColor = "gray.200"; 
  const selectedTabBg = "yellow.50"; 
  const defaultTabBg = "white"; 
  const primaryTextColor = "yellow.900";
  const secondaryTextColor = "gray.700";
  const accentColor = "green.600";

  const fetchUSDCBalance = useCallback(async () => {
    if (!aaWalletAddress || !isAAWalletInitialized) {
      setUsdcBalance("0.00");
      return;
    }
    setIsBalanceLoading(true);
    try {
      const readerProvider = new ethers.providers.JsonRpcProvider(RPC_URL);
      const usdcContract = new ethers.Contract(
        USDC_TOKEN_ADDRESS,
        ERC20_ABI_MINIMAL,
        readerProvider
      );
      const balanceBN: BigNumber = await usdcContract.balanceOf(aaWalletAddress);
      const formattedBalance = ethers.utils.formatUnits(balanceBN, USDC_DECIMALS);
      const numberBalance = parseFloat(formattedBalance);
      if (isNaN(numberBalance)) {
        setUsdcBalance("Error");
      } else {
        setUsdcBalance(numberBalance.toFixed(2));
      }
    } catch (e) {
      setUsdcBalance("Error");
      toaster.create({ title: "Balance Error", description: "Could not fetch USDC balance.", type: "error" });
    } finally {
      setIsBalanceLoading(false);
    }
  }, [aaWalletAddress, isAAWalletInitialized]);

  useEffect(() => {
    if (isAAWalletInitialized) {
      fetchUSDCBalance();
    }
  }, [isAAWalletInitialized, fetchUSDCBalance]);
  
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
    if (
      isConnected &&
      wagmiEoaAddress &&
      ethersSigner &&
      !isAAWalletInitialized &&
      !aaLoading &&
      !isSocialLoggedIn
    ) {
      initializeAAWallet(wagmiEoaAddress, ethersSigner);
    }
  }, [
    isConnected,
    wagmiEoaAddress,
    ethersSigner,
    initializeAAWallet,
    isAAWalletInitialized,
    aaLoading,
    isSocialLoggedIn,
  ]);

  const displayLoadingMessage = () => {
    if (aaLoading && !isAAWalletInitialized && isSocialLoggedIn) {
        return "Finalizing your secure social login & smart account...";
    }
    if (aaLoading && !isAAWalletInitialized && isConnected && !isSocialLoggedIn) {
        return "Initializing your smart account with your connected wallet...";
    }
    if (aaLoading && !isAAWalletInitialized) {
        return "Setting up your Alpaca Lotto account...";
    }
    return null;
  }

  const loadingMessage = displayLoadingMessage();

  const handleDisconnectApp = async () => {
    if (isSocialLoggedIn) {
      await disconnectSocialLogin();
    }
    if (isConnected) {
      wagmiDisconnect();
    }
    setUsdcBalance("0.00");
    if(contextSetSelectedLottery) contextSetSelectedLottery(null);
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
    <Layout onOpenReferralModal={isAAWalletInitialized ? onReferralModalOpen : undefined}>
      <Box bg={appContainerBg} p={{base:3, md:5}} borderRadius="2xl" minH="80vh" shadow="sm" borderWidth="1px" borderColor={borderColor}>
        <VStack gap={4} align="stretch" width="100%">
          {!isAAWalletInitialized && !aaLoading && <ConnectWallet />}
          
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

          {loadingMessage && (
              <VStack bg="white" p={6} borderRadius="xl" gap={4} alignItems="center" shadow="md" borderColor={borderColor} borderWidth="1px" mt={2}>
                  <Spinner size="xl" color={accentColor} borderWidth="4px" />
                  <Text color={primaryTextColor} fontWeight="medium" fontSize="lg">{loadingMessage}</Text>
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
                <Box>
                  <Text fontSize="xs" color={secondaryTextColor}>USDC Balance:</Text>
                  <HStack>
                    <Text fontSize="sm" color={primaryTextColor} fontWeight="bold">
                      {isBalanceLoading ? <Spinner size="sm" color={accentColor} /> : `${usdcBalance} USDC`}
                    </Text>
                     <UIButton
                        size="sm"
                        variant="ghost"
                        onClick={fetchUSDCBalance}
                        color={secondaryTextColor}
                        _hover={{ color: accentColor, bg: "yellow.100" }}
                        aria-label="Refresh Balance"
                        loading={isBalanceLoading}
                        px={1}
                        minW="auto"
                        borderRadius="md"
                    >
                       <Icon as={MdRefresh} boxSize={5} />
                     </UIButton>
                  </HStack>
                </Box>
                <Spacer display={{base:"none", md:"block"}}/>
                <UIButton 
                  variant="outline"
                  size="sm" 
                  onClick={handleDisconnectApp} 
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
                        borderTopRightRadius="xl"
                        borderBottomWidth={"2px"}
                        borderBottomColor={currentTab === "myTickets" ? accentColor : "transparent"}
                        _hover={{bg: "yellow.100", color: primaryTextColor}}
                        transition="all 0.2s ease-in-out"
                    >
                        My Tickets
                    </Tabs.Trigger>
                </Tabs.List>
                
                <Box 
                    borderWidth="0px 1px 1px 1px"
                    borderColor={borderColor}
                    borderBottomRadius="xl"
                    bg={currentTab === "buyTickets" ? selectedTabBg : defaultTabBg}
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
                </Box>
            </Tabs.Root>
          )}
          
          {!isAAWalletInitialized && !aaLoading && !loadingMessage && (
            <VStack gap={4} textAlign="center" mt={8} pb={10}>
                <Image src="/images/alpaca-welcoming-friends.png" alt="Friendly alpacas welcoming you" maxW="300px" mb={4} />
                <Heading size={{base:"lg", md:"xl"}} color={primaryTextColor}>Welcome to Alpaca Lotto!</Heading>
                <Text color={secondaryTextColor} fontSize={{base:"md", md:"lg"}}>
                    Connect your wallet or use social login to start your lucky adventure!
                </Text>
            </VStack>
          )}
        </VStack>
      </Box>
      {isAAWalletInitialized && <ReferralDialog isOpen={isReferralModalOpen} onClose={onReferralModalClose} />}
    </Layout>
  );
}

export default App;