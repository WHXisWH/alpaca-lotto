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
import { CloseButton } from "@/components/ui/close-button";
import { Alert } from "@/components/ui/alert";
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
  const { address: eoaAddress, isConnected, chain } = useAccount();
  const ethersSigner = useEthersSigner({ chainId: chain?.id });

  const {
    initializeAAWallet,
    isAAWalletInitialized,
    aaWalletAddress,
    loading: aaLoading,
    error: aaError,
    clearError: clearAAError,
  } = useAAWallet();

  const {
    fetchSupportedTokens,
    loading: paymasterLoading,
    error: paymasterError,
    clearError: clearPaymasterError,
  } = usePaymaster();

  useEffect(() => {
    if (
      isConnected &&
      eoaAddress &&
      ethersSigner &&
      !isAAWalletInitialized &&
      !aaLoading
    ) {
      initializeAAWallet(eoaAddress, ethersSigner);
    }
  }, [
    isConnected,
    eoaAddress,
    ethersSigner,
    initializeAAWallet,
    isAAWalletInitialized,
    aaLoading,
  ]);

  useEffect(() => {
    if (
      isAAWalletInitialized &&
      typeof fetchSupportedTokens === "function" &&
      !paymasterLoading
    ) {
      fetchSupportedTokens();
    }
  }, [isAAWalletInitialized, fetchSupportedTokens, paymasterLoading]);

  return (
    <Layout>
      <VStack gap={8} align="stretch" width="100%">
        <Box textAlign="center">
          <Heading as="h1" size="xl" mb={2}>
            Alpaca Lotto AA
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

        {isConnected && eoaAddress && (
          <Box p={4} borderWidth="1px" borderRadius="md" bg="gray.700" mt={4}>
            <Text fontWeight="bold">EOA Wallet:</Text>
            <Code colorScheme="purple" p={1} display="block" overflowX="auto">
              {eoaAddress} (Chain: {chain?.name || "N/A"})
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

        {!isConnected && (
          <Text textAlign="center" mt={8}>
            Please connect your wallet to begin.
          </Text>
        )}

        {isConnected &&
          !isAAWalletInitialized &&
          !aaLoading &&
          !aaError && (
            <Text textAlign="center" mt={8}>
              Initializing your smart account...
            </Text>
          )}
      </VStack>
    </Layout>
  );
}

export default App;
