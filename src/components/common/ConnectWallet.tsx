import React from "react";
import { Box, Text, VStack, Spinner, Code } from "@chakra-ui/react";
import { Button } from "@/components/ui/button";
import { useAccount, useConnect, useDisconnect, Connector } from "wagmi";
import { useEthersSigner } from "@/utils/ethersAdapters";
import { useAAWallet } from "@/context/AAWalletContext";

export const ConnectWallet: React.FC = () => {
  const { connect, connectors, error: wagmiConnectError, status } = useConnect();
  const { address: eoaAddress, isConnected, connector: activeConnector, chain } = useAccount();
  const { disconnect } = useDisconnect();
  const ethersSigner = useEthersSigner({ chainId: chain?.id });

  const {
    initializeAAWallet,
    isAAWalletInitialized,
    aaWalletAddress,
    loading: aaLoading,
    error: aaError,
  } = useAAWallet();

  const handleConnect = (connectorId?: string) => {
    let targetConnector: Connector | undefined;
    if (connectorId) {
        targetConnector = connectors.find((c) => c.id === connectorId);
    } else {
        targetConnector = connectors.find((c) => c.id === 'injected' || c.type === 'injected');
    }

    if (targetConnector) {
      connect({ connector: targetConnector });
    } else if (connectors.length > 0) {
      connect({ connector: connectors[0] });
    } else {
      console.error("No suitable connector found.");
    }
  };

  const handleInitializeAA = () => {
    if (eoaAddress && ethersSigner) {
      initializeAAWallet(eoaAddress, ethersSigner);
    } else {
      console.error(
        "EOA address or ethers signer not available for AA initialization."
      );
    }
  };

  return (
    <Box
      p={4}
      borderWidth="1px"
      borderRadius="lg"
      shadow="md"
      bg="gray.800"
      color="white"
    >
      <VStack gap={4}>
        {isConnected && eoaAddress ? (
          <>
            <Text>
              Connected EOA: <Code colorScheme="purple">{eoaAddress}</Code>
            </Text>
            <Text fontSize="sm">
              Chain: {chain?.name} (ID: {chain?.id}) Connector:{" "}
              {activeConnector?.name}
            </Text>
            {isAAWalletInitialized && aaWalletAddress ? (
              <Text>
                AA Wallet: <Code colorScheme="teal">{aaWalletAddress}</Code>
              </Text>
            ) : aaLoading ? (
              <Spinner aria-label="Initializing AA Wallet..." />
            ) : (
              <Button
                colorScheme="orange"
                onClick={handleInitializeAA}
                loading={aaLoading}
                disabled={!ethersSigner || aaLoading}
              >
                Initialize Smart Account
              </Button>
            )}
            {aaError && (
              <Text color="red.400">AA Init Error: {aaError}</Text>
            )}
            <Button
              colorScheme="red"
              variant="outline"
              onClick={() => disconnect()}
            >
              Disconnect Wallet
            </Button>
          </>
        ) : (
          <VStack>
            {connectors
              .filter((c) => c.type === "injected" || c.isAuthorized)
              .map((connector) => (
                <Button
                  key={connector.name}
                  colorScheme="blue"
                  onClick={() => handleConnect(connector.id)}
                  loading={status === 'pending'}
                  disabled={status === 'pending'}
                >
                  Connect with {connector.name}
                </Button>
              ))}
            {connectors.length === 0 && (
              <Text>
                No wallet connectors found. Please install MetaMask.
              </Text>
            )}
          </VStack>
        )}
        {wagmiConnectError && (
          <Text color="red.400">
            Connection Error: {wagmiConnectError.message}
          </Text>
        )}
      </VStack>
    </Box>
  );
};