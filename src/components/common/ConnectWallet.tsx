import React, { useState } from "react";
import { Box, Text, VStack, Spinner, Code, HStack } from "@chakra-ui/react";
import { Button } from "@/components/ui/button"; //
import { useAccount, useConnect, useDisconnect, Connector } from "wagmi";
import { useEthersSigner } from "@/utils/ethersAdapters";
import { useAAWallet } from "@/context/AAWalletContext";
import { SocialLogin } from "./SocialLogin";

export const ConnectWallet: React.FC = () => {
  const { connect, connectors, error: wagmiConnectError, status } = useConnect();
  const { address: wagmiEoaAddress, isConnected, connector: activeConnector, chain } = useAccount(); // Renamed to avoid clash
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const ethersSigner = useEthersSigner({ chainId: chain?.id });
  const [showSocialLogin, setShowSocialLogin] = useState<boolean>(true);

  const {
    initializeAAWallet,
    isAAWalletInitialized,
    aaWalletAddress,
    loading: aaLoading,
    error: aaError,
    isSocialLoggedIn,
    disconnectSocialLogin,
    eoaAddress,
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
    if (wagmiEoaAddress && ethersSigner && !isSocialLoggedIn) {
      initializeAAWallet(wagmiEoaAddress, ethersSigner);
    } else {
      console.error(
        "WAGMI EOA address or ethers signer not available, or social login is active."
      );
    }
  };

  const handleDisconnect = async () => {
    if (isSocialLoggedIn) {
      await disconnectSocialLogin();
    }
    if (isConnected) {
        wagmiDisconnect();
    }
    setShowSocialLogin(true);
  };


  if (isAAWalletInitialized && aaWalletAddress) {
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
          {isSocialLoggedIn ? (
            <Text>
              Logged in via Social. Smart Account:{" "}
              <Code colorScheme="teal">{aaWalletAddress}</Code>
            </Text>
          ) : (
            <>
              <Text>
                Connected EOA: <Code colorScheme="purple">{eoaAddress}</Code> 
              </Text>
              <Text fontSize="sm">
                Chain: {chain?.name} (ID: {chain?.id}) Connector:{" "}
                {activeConnector?.name}
              </Text>
              <Text>
                Smart Account: <Code colorScheme="teal">{aaWalletAddress}</Code>
              </Text>
            </>
          )}
          <Button
            colorScheme="red"
            variant="outline"
            onClick={handleDisconnect}
          >
            Disconnect
          </Button>
        </VStack>
      </Box>
    );
  }
  
  if (aaLoading) {
    return (
      <Box
        p={4}
        borderWidth="1px"
        borderRadius="lg"
        shadow="md"
        bg="gray.800"
        color="white"
        textAlign="center"
      >
        <Spinner size="md" color="teal.300" mb={2} />
        <Text>Initializing your lucky wallet...</Text>
        {isSocialLoggedIn && <Text fontSize="sm">Processing social login...</Text>}
      </Box>
    );
  }

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
        <HStack gap={2} width="100%" justifyContent="center">
          <Button
            colorScheme={showSocialLogin ? "teal" : "gray"}
            onClick={() => setShowSocialLogin(true)}
            variant={showSocialLogin ? "solid" : "outline"}
          >
            Quick Login (Social/Email)
          </Button>
          <Button
            colorScheme={!showSocialLogin ? "teal" : "gray"}
            onClick={() => setShowSocialLogin(false)}
            variant={!showSocialLogin ? "solid" : "outline"}
          >
            Connect External Wallet
          </Button>
        </HStack>
        
        {showSocialLogin ? (
          <SocialLogin />
        ) : (
          <VStack gap={4} width="100%">
            {isConnected && wagmiEoaAddress ? ( // Connected with Wagmi
              <>
                <Text>
                  Connected EOA: <Code colorScheme="purple">{wagmiEoaAddress}</Code>
                </Text>
                <Text fontSize="sm">
                  Chain: {chain?.name} (ID: {chain?.id}) Connector:{" "}
                  {activeConnector?.name}
                </Text>
                <Button
                  colorScheme="orange"
                  onClick={handleInitializeAA}
                  loading={aaLoading} // aaLoading is for AA initialization
                  disabled={!ethersSigner || aaLoading}
                >
                  Initialize Smart Account
                </Button>
                {aaError && ( // AA specific error
                  <Text color="red.400">AA Init Error: {aaError}</Text>
                )}
                <Button
                  colorScheme="red"
                  variant="outline"
                  onClick={handleDisconnect} // Use unified disconnect
                >
                  Disconnect Wallet
                </Button>
              </>
            ) : ( // Not connected with Wagmi
              <VStack gap={4} width="100%">
                {connectors
                  .filter((c) => c.isAuthorized || c.type === "injected" || c.id === "walletConnect") // Show common connectors
                  .map((connector) => (
                    <Button
                      key={connector.id} // Use id for key
                      colorScheme="blue"
                      onClick={() => handleConnect(connector.id)}
                      loading={status === 'pending' && activeConnector?.id === connector.id}
                      disabled={status === 'pending'}
                      width="100%"
                    >
                      Connect with {connector.name}
                      {status === 'pending' && activeConnector?.id === connector.id && <Spinner size="sm" ml={2} />}
                    </Button>
                  ))}
                {connectors.length === 0 && (
                  <Text>
                    No wallet connectors found. Please install a browser wallet like MetaMask.
                  </Text>
                )}
              </VStack>
            )}
            {wagmiConnectError && ( 
              <Text color="red.400" mt={2}>
                Connection Error: {wagmiConnectError.message}
              </Text>
            )}
          </VStack>
        )}
      </VStack>
    </Box>
  );
};