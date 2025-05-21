import React, { useState, useEffect } from "react";
import { 
    Box, 
    Text, 
    VStack, 
    HStack,
    Spinner, 
    Code, 
    SimpleGrid, 
    Card,
    Heading,
    Icon,
    Portal
} from "@chakra-ui/react";
import { Button } from "@/components/ui/button";
import { useAccount, useConnect, useDisconnect, Connector } from "wagmi";
import { useEthersSigner } from "@/utils/ethersAdapters";
import { useAAWallet } from "@/context/AAWalletContext";
import { SocialLogin } from "./SocialLogin";
import { FaGoogle, FaEnvelope, FaWallet } from "react-icons/fa";


export const ConnectWallet: React.FC = () => {
  const { connect, connectors, error: wagmiConnectError, status: wagmiConnectStatus } = useConnect();
  const { address: wagmiEoaAddress, isConnected, connector: activeConnector, chain } = useAccount();
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const ethersSigner = useEthersSigner({ chainId: chain?.id });

  const [loginMethod, setLoginMethod] = useState<"social" | "eoa" | null>(null);
  const [showEOAConnectorList, setShowEOAConnectorList] = useState<boolean>(false);


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

  useEffect(() => {
    if (isAAWalletInitialized) {
      setLoginMethod(null);
      setShowEOAConnectorList(false);
    }
  }, [isAAWalletInitialized]);

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
    setShowEOAConnectorList(false);
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

  const handleFullDisconnect = async () => {
    if (isSocialLoggedIn) {
      await disconnectSocialLogin();
    }
    if (isConnected) {
        wagmiDisconnect();
    }
    setLoginMethod(null);
    setShowEOAConnectorList(false);
  };

  const selectLoginMethod = (method: "social" | "eoa") => {
    setLoginMethod(method);
    if (method === "eoa") {
        if (isConnected && wagmiEoaAddress) {
           setShowEOAConnectorList(false);
        } else {
           setShowEOAConnectorList(true);
        }
    } else {
        setShowEOAConnectorList(false);
    }
  };
  
  const backToSelection = () => {
    setLoginMethod(null);
    setShowEOAConnectorList(false);
    if (isConnected && !isAAWalletInitialized) {
        wagmiDisconnect();
    }
  }

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
             <VStack gap={1}>
                <Text fontWeight="bold" fontSize="lg" color="teal.300">Welcome!</Text>
                <Text>
                Logged in with Social Account.
                </Text>
                <Text>Your Smart Account for Alpaca Lotto:</Text>
                <Code colorScheme="teal" p={1} display="block" overflowX="auto" fontSize="sm">{aaWalletAddress}</Code>
             </VStack>
          ) : (
            <VStack gap={1}>
              <Text fontWeight="bold" fontSize="lg" color="teal.300">Wallet Connected & Smart Account Ready!</Text>
              <Text>
                Connected EOA: <Code colorScheme="purple" fontSize="sm">{eoaAddress}</Code>
              </Text>
              <Text fontSize="xs">
                Chain: {chain?.name} (ID: {chain?.id}) | Connector:{" "}
                {activeConnector?.name}
              </Text>
              <Text>
                Your Smart Account: <Code colorScheme="teal" fontSize="sm">{aaWalletAddress}</Code>
              </Text>
            </VStack>
          )}
          <Button
            colorPalette="red"
            variant="outline"
            onClick={handleFullDisconnect}
            size="sm"
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
        p={6}
        borderWidth="1px"
        borderRadius="lg"
        shadow="md"
        bg="gray.800"
        color="white"
        textAlign="center"
      >
        <Spinner size="xl" color="teal.300" mb={4} borderWidth="4px" animationDuration="0.45s" />
        <Text fontSize="lg" fontWeight="semibold">Initializing Your Lucky Wallet...</Text>
        {(isSocialLoggedIn || loginMethod === "social") && <Text fontSize="sm" color="gray.300">Processing secure login...</Text>}
        {(loginMethod === "eoa" && isConnected) && <Text fontSize="sm" color="gray.300">Setting up your smart account...</Text>}
      </Box>
    );
  }

  return (
    <Box
      p={6}
      borderWidth="1px"
      borderRadius="lg"
      shadow="md"
      bg="gray.800"
      color="whiteAlpha.900"
      width="100%"
      maxWidth={loginMethod ? "500px" : "600px"}
      mx="auto"
    >
      {!loginMethod ? (
        <VStack gap={6}>
            <Heading as="h2" size="lg" textAlign="center" color="white">
                Join Alpaca Lotto
            </Heading>
            <Text textAlign="center" fontSize="md" color="gray.300">
                Choose your preferred way to connect and start playing.
            </Text>
            <SimpleGrid columns={{ base: 1, md: 2 }} gap={6} width="100%">
                 <Card.Root 
                    onClick={() => selectLoginMethod("social")} 
                    cursor="pointer" 
                    bg="gray.700" 
                    _hover={{ bg: "gray.600", shadow: "xl" }}
                    transition="background-color 0.2s ease-out, box-shadow 0.2s ease-out"
                    borderRadius="lg"
                    borderWidth="1px"
                    borderColor="gray.600"
                    p={2}
                >
                    <Card.Header>
                        <HStack gap={2}>
                             <Icon as={FaGoogle} w={6} h={6} color="teal.300" />
                             <Heading size="md" color="whiteAlpha.900">Quick & Easy Login</Heading>
                        </HStack>
                    </Card.Header>
                    <Card.Body>
                        <Text fontSize="sm" color="gray.300">
                            Use your Google or Email account. We'll set up a secure smart wallet for you automatically!
                        </Text>
                    </Card.Body>
                    <Card.Footer>
                        <Button colorPalette="teal" variant="solid" width="100%"> 
                            Login with Social/Email
                        </Button>
                    </Card.Footer>
                </Card.Root>
                <Card.Root
                    onClick={() => selectLoginMethod("eoa")} 
                    cursor="pointer" 
                    bg="gray.700" 
                    _hover={{ bg: "gray.600", shadow: "xl" }}
                    transition="background-color 0.2s ease-out, box-shadow 0.2s ease-out"
                    borderRadius="lg"
                    borderWidth="1px"
                    borderColor="gray.600"
                    p={2}
                >
                    <Card.Header>
                         <HStack gap={2}>
                            <Icon as={FaWallet} w={6} h={6} color="purple.300" />
                            <Heading size="md" color="whiteAlpha.900">Use Crypto Wallet</Heading>
                        </HStack>
                    </Card.Header>
                    <Card.Body>
                        <Text fontSize="sm" color="gray.300">
                            Connect your existing MetaMask, WalletConnect, or other browser wallet.
                        </Text>
                    </Card.Body>
                    <Card.Footer>
                         <Button colorPalette="purple" variant="solid" width="100%">
                            Connect External Wallet
                        </Button>
                    </Card.Footer>
                </Card.Root>
            </SimpleGrid>
        </VStack>
      ) : loginMethod === "social" ? (
        <VStack gap={4} align="stretch">
            <Button onClick={backToSelection} variant="plain" colorPalette="gray" size="sm" alignSelf="flex-start">
                &larr; Back to options
            </Button>
            <SocialLogin />
        </VStack>
      ) : (
        <VStack gap={4} align="stretch" width="100%">
            <Button onClick={backToSelection} variant="plain" colorPalette="gray" size="sm" alignSelf="flex-start">
                &larr; Back to options
            </Button>
            <Heading as="h3" size="md" textAlign="center" color="whiteAlpha.900">
                Connect Your Wallet
            </Heading>
            {isConnected && wagmiEoaAddress && !isAAWalletInitialized ? (
              <VStack gap={3} p={4} bg="gray.700" borderRadius="md">
                <Text color="whiteAlpha.900">
                  Wallet Connected: <Code colorScheme="purple" fontSize="sm">{wagmiEoaAddress}</Code>
                </Text>
                <Text fontSize="xs" color="gray.400">
                  Chain: {chain?.name} | Connector: {activeConnector?.name}
                </Text>
                <Button
                  colorPalette="orange"
                  onClick={handleInitializeAA}
                  loading={aaLoading}
                  disabled={!ethersSigner || aaLoading}
                  width="100%"
                >
                  Activate Smart Account
                </Button>
                {aaError && (
                  <Text color="red.400" fontSize="sm">Error: {aaError}</Text>
                )}
                <Button
                  variant="outline"
                  colorPalette="red"
                  onClick={handleFullDisconnect}
                  size="sm"
                  mt={2}
                >
                  Disconnect Wallet
                </Button>
              </VStack>
            ) : (
                showEOAConnectorList && (
                    <VStack gap={3} width="100%">
                        {connectors
                        .filter((c) => c.isAuthorized || c.type === "injected" || c.id === "walletConnect")
                        .map((connector) => (
                            <Button
                            key={connector.id}
                            colorPalette="blue"
                            variant="outline"
                            onClick={() => handleConnect(connector.id)}
                            loading={wagmiConnectStatus === 'pending' && activeConnector?.id === connector.id}
                            disabled={wagmiConnectStatus === 'pending'}
                            width="100%"
                            _hover={{ bg: "blue.600", color: "white", borderColor: "blue.600" }}
                            borderColor="blue.500"
                            color="whiteAlpha.900"
                            >
                            Connect with {connector.name}
                            {wagmiConnectStatus === 'pending' && activeConnector?.id === connector.id && <Spinner size="sm" ml={2} borderWidth="2px" animationDuration="0.45s"/>}
                            </Button>
                        ))}
                        {connectors.length === 0 && (
                        <Text color="gray.400">
                            No wallet connectors found. Please install a browser wallet like MetaMask.
                        </Text>
                        )}
                    </VStack>
                )
            )}
            {wagmiConnectError && (
              <Text color="red.400" mt={2} fontSize="sm" textAlign="center">
                Connection Error: {wagmiConnectError.message}
              </Text>
            )}
            {!isConnected && !showEOAConnectorList && (
                 <Button colorPalette="blue" onClick={() => setShowEOAConnectorList(true)} width="100%">
                    Show Connection Options
                </Button>
            )}
        </VStack>
      )}
    </Box>
  );
};