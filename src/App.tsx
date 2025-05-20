import { useEffect } from "react";
import {
  Box,
  VStack,
  Heading,
  Text,
  Spinner,
  Code,
  Icon,
} from "@chakra-ui/react";
import { CloseButton } from "@/components/ui/close-button"; //
import { Alert } from "@/components/ui/alert"; //
import { useAccount } from "wagmi";
import { useEthersSigner } from "./utils/ethersAdapters";
import { Layout } from "./components/layout";
import { ConnectWallet } from "./components/common";
import {
  PaymasterSettings,
  TicketGrid,
  OwnedTickets,
  LotteryInfo,
} from "./components/lottery";
import { useAAWallet } from "./context/AAWalletContext";
import { usePaymaster } from "./context/PaymasterContext";
import { MdWarning } from "react-icons/md";

function App() {
  const { address: wagmiEoaAddress, isConnected, chain } = useAccount();
  const ethersSigner = useEthersSigner({ chainId: chain?.id });

  const {
    initializeAAWallet,
    isAAWalletInitialized,
    aaWalletAddress,
    loading: aaLoading,
    error: aaError,
    clearError: clearAAError,
    isSocialLoggedIn,
    eoaAddress,
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

  return (
    <Layout>
      <VStack gap={8} align="stretch" width="100%">
        <Box textAlign="center">
          <Heading as="h1" size="xl" mb={2}>
            Alpaca Lotto
          </Heading>
          <Text fontSize="lg" color="gray.400">
            Experience the future of lottery with Account Abstraction!
          </Text>
        </Box>

        <ConnectWallet />

        {aaError && (
          <Alert
            status="error"
            variant="solid"
            mt={4}
            icon={<Icon as={MdWarning} boxSize={5} color="red.400" />}
          >
            AA Wallet Error: {aaError}
            <CloseButton
              onClick={clearAAError}
              position="absolute"
              right="8px"
              top="8px"
            />
          </Alert>
        )}

        {paymasterError && (
          <Alert
            status="error"
            variant="solid"
            mt={4}
            icon={<Icon as={MdWarning} boxSize={5} color="red.400" />}
          >
            Paymaster Error: {paymasterError}
            <CloseButton
              onClick={clearPaymasterError}
              position="absolute"
              right="8px"
              top="8px"
            />
          </Alert>
        )}

        {isAAWalletInitialized && isSocialLoggedIn && aaWalletAddress && (
          <Box p={4} borderWidth="1px" borderRadius="md" bg="gray.700" mt={4}>
            <Text fontWeight="bold">Social Login EOA (derived):</Text>
            <Code colorScheme="purple" p={1} display="block" overflowX="auto">
              {eoaAddress} (Chain: {chain?.name || "Nero Testnet"})
            </Code>
             <Text fontWeight="bold" mt={2}>
              Smart Account (AA Wallet):
            </Text>
            <Code
              colorScheme="teal"
              p={1}
              display="block"
              overflowX="auto"
            >
              {aaWalletAddress}
            </Code>
          </Box>
        )}
        
        {isConnected && wagmiEoaAddress && !isSocialLoggedIn && (
          <Box p={4} borderWidth="1px" borderRadius="md" bg="gray.700" mt={4}>
            <Text fontWeight="bold">EOA Wallet (WAGMI):</Text>
            <Code colorScheme="purple" p={1} display="block" overflowX="auto">
              {wagmiEoaAddress} (Chain: {chain?.name || "N/A"})
            </Code>
            {aaLoading && !isAAWalletInitialized && <Spinner mt={2} />}
            {isAAWalletInitialized && aaWalletAddress && (
              <>
                <Text fontWeight="bold" mt={2}>
                  Smart Account (AA Wallet):
                </Text>
                <Code
                  colorScheme="teal"
                  p={1}
                  display="block"
                  overflowX="auto"
                >
                  {aaWalletAddress}
                </Code>
              </>
            )}
          </Box>
        )}


        {isAAWalletInitialized && (
          <>
            <PaymasterSettings />
            <LotteryInfo />
            <TicketGrid />
            <OwnedTickets />
          </>
        )}
        
        {!isAAWalletInitialized && !aaLoading && !isSocialLoggedIn && !isConnected &&(
           <Text textAlign="center" mt={8}>
             Please connect your wallet or login with email/social to begin.
           </Text>
        )}

        {((isConnected && !isSocialLoggedIn && !isAAWalletInitialized && !aaLoading && !aaError) ||
          (aaLoading && !isAAWalletInitialized && !isSocialLoggedIn))&& (
            <Text textAlign="center" mt={8}>
              Initializing your smart account...
            </Text>
          )}
         {isSocialLoggedIn && aaLoading && !isAAWalletInitialized && (
            <Text textAlign="center" mt={8}>
                Initializing your smart account via social login...
            </Text>
         )}
      </VStack>
    </Layout>
  );
}

export default App;