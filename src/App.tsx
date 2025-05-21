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
  const { address: wagmiEoaAddress, isConnected, chain, connector: activeConnector } = useAccount(); // Added activeConnector
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
      <VStack gap={6} align="stretch" width="100%" pb={10}>
        <Box textAlign="center" mt={4} mb={2}>
          <Heading as="h1" size="2xl" mb={2}
            bgGradient="linear(to-r, teal.300, blue.500)"
            bgClip="text"
          >
            Alpaca Lotto
          </Heading>
          <Text fontSize="lg" color="gray.400">
            Experience the future of lottery with Account Abstraction!
          </Text>
        </Box>

        {!isAAWalletInitialized && <ConnectWallet />}
        
        {aaError && (
          <Alert
            status="error"
            variant="solid"
            mt={4}
            icon={<Icon as={MdWarning} boxSize={5} color="currentColor" />}
          >
            <VStack align="start" gap={1}>
                <Text fontWeight="bold">Account Error</Text>
                <Text fontSize="sm">{aaError}</Text>
            </VStack>
            <CloseButton
              onClick={clearAAError}
              position="absolute"
              right="8px"
              top="8px"
              size="sm"
            />
          </Alert>
        )}

        {paymasterError && (
          <Alert
            status="error"
            variant="solid"
            mt={4}
            icon={<Icon as={MdWarning} boxSize={5} color="currentColor" />}
          >
            <VStack align="start" gap={1}>
                <Text fontWeight="bold">System Error</Text>
                <Text fontSize="sm">{paymasterError}</Text>
            </VStack>
            <CloseButton
              onClick={clearPaymasterError}
              position="absolute"
              right="8px"
              top="8px"
              size="sm"
            />
          </Alert>
        )}

        {loadingMessage && (
            <VStack bg="gray.700" p={4} borderRadius="md" gap={3} alignItems="center" shadow="md">
                <Spinner size="lg" color="teal.300" borderWidth="4px" animationDuration="0.45s" />
                <Text color="whiteAlpha.900" fontWeight="medium">{loadingMessage}</Text>
            </VStack>
        )}


        {isAAWalletInitialized && aaWalletAddress && (
             <Box p={4} borderWidth="1px" borderRadius="md" bg="gray.700" mt={isSocialLoggedIn ? 0 : 4} borderColor="gray.600" shadow="md">
                {isSocialLoggedIn ? (
                    <VStack align="start" gap={1}>
                        <HStack gap={2}><Icon as={MdInfo} color="teal.300" boxSize={5}/><Text fontWeight="bold" color="teal.300">Your Alpaca Lotto Smart Account is Ready!</Text></HStack>
                        <Text fontSize="sm" color="gray.300">Smart Account Address:</Text>
                        <Code colorScheme="teal" p={1} display="block" overflowX="auto" fontSize="sm" borderRadius="sm">{aaWalletAddress}</Code>
                        <Text fontSize="xs" color="gray.500" mt={1}>This is your unique address for playing Alpaca Lotto.</Text>
                    </VStack>
                ) : (
                    <VStack align="start" gap={1}>
                        <HStack gap={2}><Icon as={MdInfo} color="teal.300" boxSize={5}/><Text fontWeight="bold" color="teal.300">Smart Account Initialized!</Text></HStack>
                        <Text fontSize="sm" color="gray.300">Connected EOA (External Wallet):</Text>
                        <Code colorScheme="purple" p={1} display="block" overflowX="auto" fontSize="sm" borderRadius="sm">{eoaAddress}</Code>
                        <Text fontSize="xs" color="gray.500">Chain: {chain?.name || "N/A"}, Connector: {activeConnector?.name || "N/A"}</Text>
                        
                        <Text fontSize="sm" color="gray.300" mt={2}>Smart Account Address:</Text>
                        <Code colorScheme="teal" p={1} display="block" overflowX="auto" fontSize="sm" borderRadius="sm">{aaWalletAddress}</Code>
                     </VStack>
                )}
                 <ChakraButton variant="plain" size="sm" onClick={handleDisconnectApp} mt={3} colorPalette="red">
                    Disconnect
                </ChakraButton>
            </Box>
        )}
        

        {isAAWalletInitialized && (
          <>
            {isSocialLoggedIn && <Web2UserDashboardMockup />}
            <PaymasterSettings />
            <LotteryInfo />
            <TicketGrid />
            <OwnedTickets />
          </>
        )}
        
        {!isAAWalletInitialized && !aaLoading && !loadingMessage && (
           <Text textAlign="center" mt={8} color="gray.400">
             Please choose a login method to start your Alpaca Lotto adventure!
           </Text>
        )}

      </VStack>
    </Layout>
  );
}

export default App;