import React, { useState, useEffect } from "react";
import {
  Box,
  Text,
  VStack,
  HStack,
  Spinner,
  Code,
  SimpleGrid,
  Heading,
  Icon,
  Center,
} from "@chakra-ui/react";
import { Button as UIButton } from "@/components/ui/button";
import { useAccount, useConnect, useDisconnect, Connector } from "wagmi";
import { useEthersSigner } from "@/utils/ethersAdapters";
import { useAAWallet } from "@/context/AAWalletContext";
import { SocialLogin } from "./SocialLogin";
import { LoginMethodCard } from "./LoginMethodCard";
import { FaGoogle, FaPaperPlane, FaWallet, FaQrcode } from "react-icons/fa"; // Added FaQrcode for WalletConnect

export const ConnectWallet: React.FC = () => {
  const { connect, connectors, error: wagmiConnectError, status: wagmiConnectStatus } = useConnect();
  const { address: wagmiEoaAddress, isConnected, connector: activeConnector, chain } = useAccount();
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const ethersSigner = useEthersSigner({ chainId: chain?.id });

  const [loginMethod, setLoginMethod] = useState<"social" | "eoa" | null>(
    null
  );
  const [showEOAConnectorList, setShowEOAConnectorList] =
    useState<boolean>(false);

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

  const cardBg = "gray.750";
  const alpacaNatureGreen = "green.300";
  const alpacaWarmBrown = "orange.400";

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
      targetConnector = connectors.find(
        (c) => c.id === "injected" || c.type === "injected"
      );
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
      if (isConnected && wagmiEoaAddress && !isAAWalletInitialized) {
        setShowEOAConnectorList(false);
      } else if (!isConnected) {
        setShowEOAConnectorList(true);
      }
    } else {
      setShowEOAConnectorList(false);
    }
  };

  const backToSelection = () => {
    if (isConnected && loginMethod === "eoa" && !isAAWalletInitialized) {
      wagmiDisconnect();
    }
    setLoginMethod(null);
    setShowEOAConnectorList(false);
  };

  if (isAAWalletInitialized && aaWalletAddress) {
    return (
      <Box
        p={4}
        borderWidth="1px"
        borderRadius="lg"
        shadow="md"
        bg={cardBg}
        color="whiteAlpha.900"
        borderColor="gray.600"
      >
        <VStack gap={3}>
          {isSocialLoggedIn ? (
            <VStack gap={1}>
              <Text fontWeight="bold" fontSize="lg" color={alpacaNatureGreen}>
                Welcome!
              </Text>
              <Text fontSize="sm">Logged in with Social Account.</Text>
              <Text fontSize="sm">Your Alpaca Smart Account:</Text>
              <Code
                colorPalette="green"
                p={1}
                display="block"
                overflowX="auto"
                fontSize="xs"
                variant="outline"
              >
                {aaWalletAddress}
              </Code>
            </VStack>
          ) : (
            <VStack gap={1}>
              <Text fontWeight="bold" fontSize="lg" color={alpacaNatureGreen}>
                Wallet Connected & Smart Account Ready!
              </Text>
              <Text fontSize="sm">
                EOA:{" "}
                <Code colorPalette="purple" variant="outline" fontSize="xs">
                  {eoaAddress}
                </Code>
              </Text>
              <Text fontSize="xs" color="gray.400">
                Chain: {chain?.name} | Connector: {activeConnector?.name}
              </Text>
              <Text fontSize="sm">
                Smart Account:{" "}
                <Code colorPalette="green" variant="outline" fontSize="xs">
                  {aaWalletAddress}
                </Code>
              </Text>
            </VStack>
          )}
          <UIButton
            colorPalette="red"
            variant="outline"
            onClick={handleFullDisconnect}
            size="sm"
          >
            Disconnect
          </UIButton>
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
        shadow="lg"
        bg={cardBg}
        color="whiteAlpha.900"
        textAlign="center"
        borderColor="gray.600"
      >
        <Spinner
          size="xl"
          color={alpacaNatureGreen}
          mb={4}
          borderWidth="4px"
          animationDuration="0.45s"
        />
        <Text fontSize="lg" fontWeight="semibold">
          Initializing Your Lucky Wallet...
        </Text>
        {(isSocialLoggedIn || loginMethod === "social") && (
          <Text fontSize="sm" color="gray.300">
            Processing secure login...
          </Text>
        )}
        {loginMethod === "eoa" && isConnected && (
          <Text fontSize="sm" color="gray.300">
            Setting up your smart account...
          </Text>
        )}
      </Box>
    );
  }

  return (
    <Box
      p={{ base: 4, md: 6 }}
      borderWidth="1px"
      borderRadius="xl"
      shadow="xl"
      bg="gray.800"
      color="whiteAlpha.900"
      width="100%"
      maxWidth={loginMethod ? "500px" : "650px"}
      mx="auto"
      borderColor="gray.700"
    >
      {!loginMethod ? (
        <VStack gap={6}>
          <Heading as="h2" size="xl" textAlign="center" color="whiteAlpha.900">
            Join Alpaca Lotto
          </Heading>
          <Text textAlign="center" fontSize="md" color="gray.300">
            Choose your preferred way to connect and start playing.
          </Text>
          <SimpleGrid columns={{ base: 1, md: 2 }} gap={6} width="100%">
            <LoginMethodCard
              icon={FaGoogle}
              title="Quick & Easy Login"
              description="Use your Google or Email account. We'll set up a secure smart wallet for you automatically!"
              btnText="Login with Social/Email"
              onClick={() => selectLoginMethod("social")}
              colorScheme="green"
              btnDisabled={aaLoading}
            />
            <LoginMethodCard
              icon={FaWallet}
              title="Use Crypto Wallet"
              description="Connect your existing MetaMask, WalletConnect, or other browser wallet."
              btnText="Connect External Wallet"
              onClick={() => selectLoginMethod("eoa")}
              colorScheme="orange"
              btnDisabled={aaLoading}
            />
          </SimpleGrid>
        </VStack>
      ) : loginMethod === "social" ? (
        <VStack gap={4} align="stretch">
          <UIButton
            onClick={backToSelection}
            variant="plain"
            colorPalette="gray"
            size="sm"
            alignSelf="flex-start"
            gap={1}
          >
            <Icon as={FaPaperPlane} style={{ transform: "rotate(180deg)" }} />
            Back to options
          </UIButton>
          <SocialLogin />
        </VStack>
      ) : (
        <VStack gap={4} align="stretch" width="100%">
          <UIButton
            onClick={backToSelection}
            variant="plain"
            colorPalette="gray"
            size="sm"
            alignSelf="flex-start"
            gap={1}
          >
            <Icon as={FaPaperPlane} style={{ transform: "rotate(180deg)" }} />
            Back to options
          </UIButton>
          <Heading as="h3" size="lg" textAlign="center" color="whiteAlpha.900">
            Connect Your Wallet
          </Heading>
          {isConnected && wagmiEoaAddress && !isAAWalletInitialized ? (
            <VStack
              gap={3}
              p={4}
              bg={"gray.750"}
              borderRadius="md"
              borderColor="gray.600"
              borderWidth="1px"
            >
              <Text color="whiteAlpha.900">
                Wallet Connected:{" "}
                <Code colorScheme="purple" fontSize="sm" variant="outline">
                  {wagmiEoaAddress}
                </Code>
              </Text>
              <Text fontSize="xs" color="gray.400">
                Chain: {chain?.name} | Connector: {activeConnector?.name}
              </Text>
              <UIButton
                colorPalette="orange"
                onClick={handleInitializeAA}
                loading={aaLoading}
                disabled={!ethersSigner || aaLoading}
                width="100%"
              >
                Activate Smart Account
              </UIButton>
              {aaError && (
                <Text color="red.400" fontSize="sm">
                  {aaError}
                </Text>
              )}
              <UIButton
                variant="outline"
                colorPalette="red"
                onClick={handleFullDisconnect}
                size="sm"
                mt={2}
              >
                Disconnect Wallet
              </UIButton>
            </VStack>
          ) : (
            showEOAConnectorList && (
              <VStack gap={3} width="100%">
                {connectors
                  .filter(
                    (c) => c.ready // Prioritize ready connectors
                  )
                  .map((connector) => (
                    <UIButton
                      key={connector.id}
                      colorPalette="blue"
                      variant="outline"
                      onClick={() => handleConnect(connector.id)}
                      loading={
                        wagmiConnectStatus === "pending" &&
                        connectors.find(c => c.id === connector.id)?.id === connector.id // More robust check for pending connector
                      }
                      disabled={wagmiConnectStatus === "pending"}
                      width="100%"
                      _hover={{
                        bg: "blue.500",
                        color: "white",
                        borderColor: "blue.500",
                      }}
                      borderColor="blue.400"
                      color="whiteAlpha.900"
                    >
                      <HStack justifyContent="center" width="full">
                        {connector.icon && <Icon as={() => <img src={connector.icon} alt={connector.name} style={{width:20, height:20}} />} mr={2} />}
                        {!connector.icon && connector.id === "walletConnect" && <Icon as={FaQrcode} mr={2}/>}
                        {!connector.icon && connector.type === "injected" && <Icon as={FaWallet} mr={2}/>}
                        <Text>
                          {connector.name === "Injected" && activeConnector?.name ? activeConnector.name : connector.name}
                        </Text>
                        {wagmiConnectStatus === "pending" &&
                         connectors.find(c => c.id === connector.id)?.id === connector.id && (
                          <Spinner
                            size="sm"
                            ml={2}
                            borderWidth="2px"
                            animationDuration="0.45s"
                          />
                        )}
                      </HStack>
                    </UIButton>
                  ))}
                {connectors.filter(c => c.ready).length === 0 && (
                  <Text color="gray.400">
                    No wallet connectors found or ready. Please install a browser wallet
                    like MetaMask or ensure WalletConnect is available.
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
            <UIButton
              colorPalette="blue"
              onClick={() => setShowEOAConnectorList(true)}
              width="100%"
            >
              Show Connection Options
            </UIButton>
          )}
          {isConnected && !wagmiEoaAddress && loginMethod === "eoa" && (
            <Center pt={4}>
              <VStack gap={2}>
                <Spinner color={alpacaWarmBrown} />
                <Text fontSize="sm" color="gray.300">
                  Awaiting wallet connection details...
                </Text>
              </VStack>
            </Center>
          )}
        </VStack>
      )}
    </Box>
  );
};