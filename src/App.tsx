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

  const [usdcBalance, setUsdcBalance] = useState<string>("0.00");
  const [isBalanceLoading, setIsBalanceLoading] = useState<boolean>(false);
  const [isGasPanelOpen, setIsGasPanelOpen] = useState<boolean>(true);

  const toggleGasPanel = () => setIsGasPanelOpen(!isGasPanelOpen);

  const alpacaAppBg = "gray.850";
  const globalInfoBg = "gray.750";
  const borderColor = "gray.600";

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
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toaster.create({ title: "Copied!", description: "Address copied to clipboard.", type: "success" });
    }).catch(err => {
      toaster.create({ title: "Copy Failed", description: "Could not copy address.", type: "error" });
    });
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
            <VStack gap={6} width="100%" pt={4}>
              {isSocialLoggedIn && <Web2UserDashboardMockup />}
              <LotteryInfo />
              <TicketGrid />
              <OwnedTickets />
            </VStack>
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