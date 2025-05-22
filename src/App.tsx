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
import { useAAWallet } from "./context/AAWalletContext";
import { usePaymaster } from "./context/PaymasterContext";
import { useLottery } from "./context/LotteryContext";
import { MdWarning, MdInfo, MdCopyAll, MdRefresh, MdExpandMore, MdExpandLess } from "react-icons/md";
import { ethers, BigNumber } from "ethers";
import { USDC_TOKEN_ADDRESS, USDC_DECIMALS, RPC_URL } from "./config";
import { toaster } from "@/components/ui/toaster";

const ERC20_ABI_MINIMAL = [
  "function balanceOf(address account) view returns (uint256)",
];

function App() {
  const { address: wagmiEoaAddress, isConnected, chain, connector: activeConnector } = useAccount();
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
    eoaAddress,
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

  const toggleGasPanel = () => setIsGasPanelOpen(!isGasPanelOpen);

  const alpacaAppBg = "gray.850";
  const globalInfoBg = "gray.750";
  const borderColor = "gray.600";
  const tabSelectedBg = "gray.700"; 
  const tabDefaultBg = "gray.800";

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
      console.error("Failed to fetch USDC balance:", e);
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
        const activeLottery = lotteries.find(l => l.endTime > now && l.startTime <= now);
        if (activeLottery) {
            contextSetSelectedLottery(activeLottery);
        } else {
            const sortedByEndTime = [...lotteries].sort((a,b) => b.endTime - a.endTime);
            contextSetSelectedLottery(sortedByEndTime[0] || lotteries[0]);
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
      toaster.create({ title: "Copy Failed", description: "Could not copy address.", type: "error" });
    });
  };

  const handleTabChange = (details: { value: string }) => {
    setCurrentTab(details.value);
  };

  return (
    <Layout>
      <Box bg={alpacaAppBg} p={{base:2, md:4}} borderRadius="xl" minH="80vh">
        <VStack gap={4} align="stretch" width="100%">
          {!isAAWalletInitialized && !aaLoading && <ConnectWallet />}
          
          {aaError && (
            <UIAlert
              status="error"
              variant="solid"
              mt={2}
              bg="red.800"
              borderColor="red.600"
              icon={<Icon as={MdWarning} boxSize={5} color="red.200" />}
            >
              <VStack align="start" gap={1}>
                  <Text fontWeight="bold" color="red.100">Account Error</Text>
                  <Text fontSize="sm" color="red.200">{aaError}</Text>
              </VStack>
              <UICloseButton
                onClick={clearAAError}
                position="absolute"
                right="8px"
                top="8px"
                size="sm"
                color="red.200"
                _hover={{bg: "red.700"}}
              />
            </UIAlert>
          )}

          {paymasterError && (
            <UIAlert
              status="error"
              variant="solid"
              mt={2}
              bg="red.800"
              borderColor="red.600"
              icon={<Icon as={MdWarning} boxSize={5} color="red.200" />}
            >
              <VStack align="start" gap={1}>
                  <Text fontWeight="bold" color="red.100">System Error</Text>
                  <Text fontSize="sm" color="red.200">{paymasterError}</Text>
              </VStack>
              <UICloseButton
                onClick={clearPaymasterError}
                position="absolute"
                right="8px"
                top="8px"
                size="sm"
                color="red.200"
                 _hover={{bg: "red.700"}}
              />
            </UIAlert>
          )}

          {loadingMessage && (
              <VStack bg="gray.750" p={4} borderRadius="lg" gap={3} alignItems="center" shadow="lg" borderColor="gray.600" borderWidth="1px" mt={2}>
                  <Spinner size="lg" color="green.300" borderWidth="4px" animationDuration="0.45s" />
                  <Text color="whiteAlpha.800" fontWeight="medium">{loadingMessage}</Text>
              </VStack>
          )}

          {isAAWalletInitialized && aaWalletAddress && (
            <Box 
              p={3} 
              borderWidth="1px" 
              borderRadius="lg" 
              bg={globalInfoBg} 
              borderColor={borderColor} 
              shadow="md"
            >
              <Flex direction={{base: "column", md: "row"}} alignItems={{base: "flex-start", md: "center"}} gap={{base: 2, md: 4}}>
                <Box>
                  <Text fontSize="xs" color="gray.400">Smart Account:</Text>
                  <HStack>
                    <Code 
                      color="green.300" 
                      variant="plain"
                      bg="transparent"
                      px={1} 
                      fontSize="sm"
                      fontWeight="medium"
                    >
                      {`${aaWalletAddress.substring(0, 6)}...${aaWalletAddress.substring(aaWalletAddress.length - 4)}`}
                    </Code>
                    <UIButton
                      size="xs"
                      variant="ghost"
                      onClick={() => copyToClipboard(aaWalletAddress)}
                      color="gray.400"
                      _hover={{ color: "teal.300", bg:"gray.600" }}
                      aria-label="Copy address"
                      px={1}
                      minW="auto"
                    >
                      <Icon as={MdCopyAll} boxSize={4}/>
                    </UIButton>
                  </HStack>
                </Box>
                <Box>
                  <Text fontSize="xs" color="gray.400">USDC Balance:</Text>
                  <HStack>
                    <Text fontSize="sm" color="whiteAlpha.800" fontWeight="medium">
                      {isBalanceLoading ? <Spinner size="xs" /> : `${usdcBalance} USDC`}
                    </Text>
                     <UIButton
                        size="xs"
                        variant="ghost"
                        onClick={fetchUSDCBalance}
                        color="gray.400"
                        _hover={{ color: "teal.300", bg:"gray.600" }}
                        aria-label="Refresh Balance"
                        loading={isBalanceLoading}
                        px={1}
                        minW="auto"
                    >
                       <Icon as={MdRefresh} boxSize={4} />
                     </UIButton>
                  </HStack>
                </Box>
                <Spacer display={{base:"none", md:"block"}}/>
                <UIButton 
                    variant="solid" 
                    colorScheme="red" 
                    bg="red.500"
                    color="white"
                    _hover={{bg: "red.600"}}
                    _active={{bg: "red.700"}}
                    size="sm" 
                    onClick={handleDisconnectApp} 
                    mt={{base: 2, md: 0}}
                >
                  Disconnect
                </UIButton>
              </Flex>
              
              <Box mt={3} borderWidth="1px" borderColor={borderColor} borderRadius="md">
                <Flex 
                  as="header" 
                  p={3} 
                  onClick={toggleGasPanel} 
                  cursor="pointer" 
                  alignItems="center" 
                  bg="gray.700"
                  _hover={{bg: "gray.650"}}
                  borderTopRadius="md"
                  borderBottomRadius={isGasPanelOpen ? "none" : "md"}
                  borderBottomWidth={isGasPanelOpen ? "1px" : "0px"}
                  borderColor={borderColor}
                >
                  <Heading size="sm" color="teal.300">Gas Payment Options</Heading>
                  <Spacer />
                  <Icon as={isGasPanelOpen ? MdExpandLess : MdExpandMore} boxSize={6} color="gray.400"/>
                </Flex>
                {isGasPanelOpen && (
                  <Box borderBottomRadius="md" borderTopWidth="1px" borderColor={borderColor}>
                     <PaymasterSettings />
                  </Box>
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
                borderColor={borderColor} 
            >
                <Tabs.List 
                    borderBottomWidth="2px" 
                    borderColor={borderColor}
                    bg={globalInfoBg} 
                    borderTopRadius="lg"
                >
                    <Tabs.Trigger 
                        value="buyTickets" 
                        flex={1} 
                        py={3}
                        fontSize="md"
                        fontWeight="semibold"
                        color="gray.400"
                        bg={currentTab === "buyTickets" ? tabSelectedBg : tabDefaultBg}
                        borderTopLeftRadius="lg"
                        borderBottomWidth={currentTab === "buyTickets" ? "2px" : "0px"}
                        borderBottomColor={currentTab === "buyTickets" ? "teal.300" : "transparent"}
                        _selected={{ color: "teal.300" }}
                        _hover={{bg: tabSelectedBg, color: "whiteAlpha.800"}}
                        transition="background-color 0.2s, color 0.2s, border-bottom-color 0.2s"
                    >
                        Buy Tickets
                    </Tabs.Trigger>
                    <Tabs.Trigger 
                        value="myTickets" 
                        flex={1} 
                        py={3} 
                        fontSize="md"
                        fontWeight="semibold"
                        color="gray.400"
                        bg={currentTab === "myTickets" ? tabSelectedBg : tabDefaultBg}
                        borderTopRightRadius="lg"
                        borderBottomWidth={currentTab === "myTickets" ? "2px" : "0px"}
                        borderBottomColor={currentTab === "myTickets" ? "teal.300" : "transparent"}
                        _selected={{ color: "teal.300" }}
                        _hover={{bg: tabSelectedBg, color: "whiteAlpha.800"}}
                        transition="background-color 0.2s, color 0.2s, border-bottom-color 0.2s"
                    >
                        My Tickets
                    </Tabs.Trigger>
                </Tabs.List>
                
                <Box 
                    borderWidth="0px 1px 1px 1px"
                    borderColor={borderColor}
                    borderBottomRadius="lg"
                    bg={tabSelectedBg}
                >
                    <Tabs.Content value="buyTickets" p={{base:3, md:4}}>
                        <VStack gap={6} width="100%">
                          {isSocialLoggedIn && currentTab === "buyTickets" && <Web2UserDashboardMockup />}
                          <LotteryInfo />
                          <TicketGrid />
                        </VStack>
                    </Tabs.Content>
                    <Tabs.Content value="myTickets" p={{base:3, md:4}}>
                        <OwnedTickets />
                    </Tabs.Content>
                </Box>
            </Tabs.Root>
          )}
          
          {!isAAWalletInitialized && !aaLoading && !loadingMessage && (
             <Text textAlign="center" mt={8} color="gray.400" pb={10}>
               Please choose a login method to start your Alpaca Lotto adventure!
             </Text>
          )}
        </VStack>
      </Box>
    </Layout>
  );
}

export default App;