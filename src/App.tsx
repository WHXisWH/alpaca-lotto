import React, { useEffect } from "react";
import {
  Box,
  VStack,
  HStack, 
  Heading,
  Text,
  Spinner,
  Code,
  Icon,
  Portal,
  Button as ChakraButton, 
} from "@chakra-ui/react";
import { CloseButton } from "@/components/ui/close-button";
import { Alert } from "@/components/ui/alert";
import { useAccount, useConnect, useDisconnect } from "wagmi";
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
import { MdWarning, MdInfo } from "react-icons/md";

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

  const alpacaAppBg = "gray.850";

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
  };


  return (
    <Layout>
      <Box bg={alpacaAppBg} p={{base:2, md:4}} borderRadius="xl" minH="80vh">
        <VStack gap={6} align="stretch" width="100%" pb={10}>
          <Box textAlign="center" mt={4} mb={2}>
            {/* Logo already in Layout header, this is main title */}
            <Heading as="h1" size="2xl" mb={2}
              bgGradient="linear(to-r, teal.300, green.400, orange.300)" // Alpaca-themed gradient
              bgClip="text"
            >
              Alpaca Lotto
            </Heading>
            <Text fontSize="lg" color="gray.300">
              Experience the future of lottery with Account Abstraction!
            </Text>
          </Box>

          {!isAAWalletInitialized && <ConnectWallet />}
          
          {aaError && (
            <Alert
              status="error"
              variant="solid"
              mt={4}
              bg="red.800"
              borderColor="red.600"
              icon={<Icon as={MdWarning} boxSize={5} color="red.200" />}
            >
              <VStack align="start" gap={1}>
                  <Text fontWeight="bold" color="red.100">Account Error</Text>
                  <Text fontSize="sm" color="red.200">{aaError}</Text>
              </VStack>
              <CloseButton
                onClick={clearAAError}
                position="absolute"
                right="8px"
                top="8px"
                size="sm"
                color="red.200"
                _hover={{bg: "red.700"}}
              />
            </Alert>
          )}

          {paymasterError && (
            <Alert
              status="error"
              variant="solid"
              mt={4}
              bg="red.800"
              borderColor="red.600"
              icon={<Icon as={MdWarning} boxSize={5} color="red.200" />}
            >
              <VStack align="start" gap={1}>
                  <Text fontWeight="bold" color="red.100">System Error</Text>
                  <Text fontSize="sm" color="red.200">{paymasterError}</Text>
              </VStack>
              <CloseButton
                onClick={clearPaymasterError}
                position="absolute"
                right="8px"
                top="8px"
                size="sm"
                color="red.200"
                 _hover={{bg: "red.700"}}
              />
            </Alert>
          )}

          {loadingMessage && (
              <VStack bg="gray.750" p={4} borderRadius="lg" gap={3} alignItems="center" shadow="lg" borderColor="gray.600" borderWidth="1px">
                  <Spinner size="lg" color="green.300" borderWidth="4px" animationDuration="0.45s" />
                  <Text color="whiteAlpha.800" fontWeight="medium">{loadingMessage}</Text>
              </VStack>
          )}


          {isAAWalletInitialized && aaWalletAddress && (
               <Box p={4} borderWidth="1px" borderRadius="lg" bg="gray.750" mt={isSocialLoggedIn ? 0 : 4} borderColor="gray.600" shadow="md">
                  {isSocialLoggedIn ? (
                      <VStack align="start" gap={1}>
                          <HStack gap={2}><Icon as={MdInfo} color="green.300" boxSize={5}/><Text fontWeight="bold" color="green.300">Your Alpaca Lotto Smart Account is Ready!</Text></HStack>
                          <Text fontSize="sm" color="gray.300">Smart Account Address:</Text>
                          <Code colorPalette="green" variant="outline" p={1} display="block" overflowX="auto" fontSize="xs" borderRadius="sm">{aaWalletAddress}</Code>
                          <Text fontSize="xs" color="gray.500" mt={1}>This is your unique address for playing Alpaca Lotto.</Text>
                      </VStack>
                  ) : (
                      <VStack align="start" gap={1}>
                          <HStack gap={2}><Icon as={MdInfo} color="green.300" boxSize={5}/><Text fontWeight="bold" color="green.300">Smart Account Initialized!</Text></HStack>
                          <Text fontSize="sm" color="gray.300">Connected EOA (External Wallet):</Text>
                          <Code colorPalette="purple" variant="outline" p={1} display="block" overflowX="auto" fontSize="xs" borderRadius="sm">{eoaAddress}</Code>
                          <Text fontSize="xs" color="gray.500">Chain: {chain?.name || "N/A"}, Connector: {activeConnector?.name || "N/A"}</Text>
                          
                          <Text fontSize="sm" color="gray.300" mt={2}>Smart Account Address:</Text>
                          <Code colorPalette="green" variant="outline" p={1} display="block" overflowX="auto" fontSize="xs" borderRadius="sm">{aaWalletAddress}</Code>
                       </VStack>
                  )}
                   <ChakraButton variant="plain" size="sm" onClick={handleDisconnectApp} mt={3} colorPalette="orange">
                      Disconnect
                  </ChakraButton>
              </Box>
          )}
          

          {isAAWalletInitialized && (
            <VStack gap={8} width="100%">
              {isSocialLoggedIn && <Web2UserDashboardMockup />}
              <PaymasterSettings />
              <LotteryInfo />
              <TicketGrid />
              <OwnedTickets />
            </VStack>
          )}
          
          {!isAAWalletInitialized && !aaLoading && !loadingMessage && (
             <Text textAlign="center" mt={8} color="gray.400">
               Please choose a login method to start your Alpaca Lotto adventure!
             </Text>
          )}

        </VStack>
      </Box>
    </Layout>
  );
}

export default App;