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
  Image,
  AspectRatio
} from "@chakra-ui/react";
import { Button as UIButton } from "@/components/ui/button";
import { useAccount, useConnect, useDisconnect, Connector } from "wagmi";
import { useEthersSigner } from "@/utils/ethersAdapters";
import { useAAWallet } from "@/context/AAWalletContext";
import { SocialLogin } from "./SocialLogin";
import { LoginMethodCard } from "./LoginMethodCard";
import { FaGoogle, FaWallet } from "react-icons/fa";
import { IoIosArrowRoundBack } from "react-icons/io";

export const ConnectWallet: React.FC = () => {
  const { connect, connectors, error: wagmiConnectError, status: wagmiConnectStatus } = useConnect();
  const { address: wagmiEoaAddress, isConnected, connector: activeConnector, chain } = useAccount();
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const ethersSigner = useEthersSigner();

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
  
  const cardBg = "white";
  const textColor = "yellow.900";
  const borderColor = "gray.200";
  const backButtonColor = "gray.700";
  const headingColor = "yellow.900";
  const descriptionColor = "gray.700";
  const cardInfoBg = "yellow.50";
  const accentColorGreen = "green.600";
  const accentColorOrange = "orange.500";

  useEffect(() => {
    if (isAAWalletInitialized) {
      setLoginMethod(null);
      setShowEOAConnectorList(false);
    }
  }, [isAAWalletInitialized]);

  // --- 核心改動：增加這個 useEffect 來處理錢包自動重連 ---
  useEffect(() => {
    // 如果 Wagmi 已經連接，並且我們的 AA 錢包尚未初始化，且不在加載中
    if (isConnected && wagmiEoaAddress && ethersSigner && !isAAWalletInitialized && !aaLoading) {
      // 檢查是否是從錢包登錄（而不是社交登錄）
      if (!isSocialLoggedIn) {
        // 自動觸發 AA 錢包的初始化
        initializeAAWallet(wagmiEoaAddress, ethersSigner);
      }
    }
  }, [isConnected, wagmiEoaAddress, ethersSigner, isAAWalletInitialized, aaLoading, isSocialLoggedIn, initializeAAWallet]);


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
        p={5}
        borderWidth="1px"
        borderRadius="xl"
        shadow="sm"
        bg={cardInfoBg}
        color={textColor}
        borderColor={borderColor}
      >
        <VStack gap={3}>
          {isSocialLoggedIn ? (
            <VStack gap={1}>
              <Text fontWeight="bold" fontSize="lg" color={accentColorGreen}>
                Welcome!
              </Text>
              <Text fontSize="sm" color={descriptionColor}>Logged in with Social Account.</Text>
              <Text fontSize="sm" color={descriptionColor}>Your Alpaca Smart Account:</Text>
              <Code
                colorScheme="green"
                p={2}
                borderRadius="lg"
                display="block"
                overflowX="auto"
                fontSize="xs"
                bg="green.100"
                color="green.800"
              >
                {aaWalletAddress}
              </Code>
            </VStack>
          ) : (
            <VStack gap={1}>
              <Text fontWeight="bold" fontSize="lg" color={accentColorGreen}>
                Wallet Connected & Smart Account Ready!
              </Text>
              <Text fontSize="sm">
                EOA:{" "}
                <Code colorScheme="purple" variant="outline" fontSize="xs" p={1} borderRadius="lg" borderColor="purple.300" color="purple.700">
                  {eoaAddress}
                </Code>
              </Text>
              <Text fontSize="xs" color={descriptionColor}>
                Chain: {chain?.name} | Connector: {activeConnector?.name}
              </Text>
              <Text fontSize="sm">
                Smart Account:{" "}
                <Code colorScheme="green" variant="outline" fontSize="xs" p={1} borderRadius="lg" borderColor="green.300" color="green.700">
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
            borderRadius="lg"
            _hover={{transform: 'scale(1.02)'}}
            _active={{transform: 'scale(0.98)'}}
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
        borderRadius="xl"
        shadow="md"
        bg={cardInfoBg}
        color={textColor}
        textAlign="center"
        borderColor={borderColor}
      >
        <Spinner
          size="xl"
          color={accentColorGreen}
          mb={4}
          borderWidth="4px"
        />
        <Text fontSize="lg" fontWeight="semibold">
          Initializing Your Lucky Wallet...
        </Text>
        {(isSocialLoggedIn || loginMethod === "social") && (
          <Text fontSize="sm" color={descriptionColor}>
            Processing secure login...
          </Text>
        )}
        {loginMethod === "eoa" && isConnected && (
          <Text fontSize="sm" color={descriptionColor}>
            Setting up your smart account...
          </Text>
        )}
      </Box>
    );
  }

  return (
    <Box
      p={{ base: 5, md: 8 }}
      borderWidth="1px"
      borderRadius="2xl"
      shadow="sm"
      bg={cardBg}
      color={textColor}
      width="100%"
      maxWidth={loginMethod ? "500px" : "650px"}
      mx="auto"
      borderColor={borderColor}
      _hover={{ shadow: 'md' }}
    >
      {!loginMethod ? (
        <VStack gap={6}>
          <Image src="/images/alpaca-welcoming.png" alt="A row of alpacas" width="100%" maxW="1000px" height="120px" objectFit="contain" mx="auto" mb={2} />
          <Heading as="h2" size={{base:"lg", md:"xl"}} textAlign="center" color={headingColor}>
            Join Alpaca Lotto
          </Heading>
          <Text textAlign="center" fontSize={{base:"sm", md:"md"}} color={descriptionColor}>
            Choose your preferred way to connect and start playing.
          </Text>
          <SimpleGrid columns={{ base: 1, md: 2 }} gap={{base:4, md:6}} width="100%">
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
      ) : (
        <VStack gap={4} align="stretch">
          <UIButton
            onClick={backToSelection}
            variant="ghost"
            color={backButtonColor}
            size="sm"
            alignSelf="flex-start"
            gap={1}
            _hover={{
                color: "yellow.800",
                bg: "yellow.100"
            }}
            pl={1}
            borderRadius="md"
          >
            <Icon as={IoIosArrowRoundBack} boxSize={6} />
            Back to options
          </UIButton>
          {loginMethod === 'social' ? <SocialLogin /> : (
            <VStack gap={4} align="stretch" width="100%">
              <Heading as="h3" size="lg" textAlign="center" color={headingColor}>
                Connect Your Wallet
              </Heading>
              {isConnected && wagmiEoaAddress && !isAAWalletInitialized ? (
                <VStack
                  gap={3}
                  p={4}
                  bg={cardInfoBg}
                  borderRadius="lg"
                  borderColor={borderColor}
                  borderWidth="1px"
                >
                  <Text color={textColor}>
                    Wallet Connected:{" "}
                    <Code colorScheme="purple" fontSize="sm" p={1} borderRadius="md" bg="purple.100" color="purple.800">
                      {wagmiEoaAddress}
                    </Code>
                  </Text>
                  <Text fontSize="xs" color={descriptionColor}>
                    Chain: {chain?.name} | Connector: {activeConnector?.name}
                  </Text>
                  <UIButton
                    colorPalette="green"
                    onClick={handleInitializeAA}
                    loading={aaLoading}
                    disabled={!ethersSigner || aaLoading}
                    width="100%"
                    borderRadius="lg"
                    _hover={{bg:"green.700", transform: 'scale(1.02)'}}
                    _active={{bg:"green.800", transform: 'scale(0.98)'}}
                  >
                    Activate Smart Account
                  </UIButton>
                  {aaError && (
                    <Text color="red.500" fontSize="sm">
                      {aaError}
                    </Text>
                  )}
                  <UIButton
                    variant="outline"
                    colorPalette="red"
                    onClick={handleFullDisconnect}
                    size="sm"
                    mt={2}
                    borderRadius="lg"
                    _hover={{transform: 'scale(1.02)'}}
                    _active={{transform: 'scale(0.98)'}}
                  >
                    Disconnect Wallet
                  </UIButton>
                </VStack>
              ) : (
                showEOAConnectorList && (
                  <VStack gap={3} width="100%">
                    {connectors
                      .filter(
                        (c) =>
                          c.isAuthorized ||
                          c.type === "injected" ||
                          c.id === "walletConnect"
                      )
                      .map((connector) => (
                        <UIButton
                          key={connector.id}
                          colorPalette="blue"
                          variant="outline"
                          onClick={() => handleConnect(connector.id)}
                          loading={
                            wagmiConnectStatus === "pending" &&
                            activeConnector?.id === connector.id
                          }
                          disabled={wagmiConnectStatus === "pending"}
                          width="100%"
                          borderRadius="lg"
                          _hover={{transform: 'scale(1.02)'}}
                          _active={{transform: 'scale(0.98)'}}
                        >
                          Connect with {connector.name}
                          {wagmiConnectStatus === "pending" &&
                            activeConnector?.id === connector.id && (
                              <Spinner
                                size="sm"
                                ml={2}
                                borderWidth="2px" 
                              />
                            )}
                        </UIButton>
                      ))}
                    {connectors.length === 0 && (
                      <Text color={descriptionColor}>
                        No wallet connectors found. Please install a browser wallet
                        like MetaMask.
                      </Text>
                    )}
                  </VStack>
                )
              )}
              {wagmiConnectError && (
                <Text color="red.500" mt={2} fontSize="sm" textAlign="center">
                  Connection Error: {wagmiConnectError.message}
                </Text>
              )}
              {!isConnected && !showEOAConnectorList && (
                <UIButton
                  colorPalette="green"
                  onClick={() => setShowEOAConnectorList(true)}
                  width="100%"
                  borderRadius="lg"
                  _hover={{bg:"green.700", transform: 'scale(1.02)'}}
                  _active={{bg:"green.800", transform: 'scale(0.98)'}}
                >
                  Show Connection Options
                </UIButton>
              )}
              {isConnected && !wagmiEoaAddress && loginMethod === "eoa" && (
                <Center pt={4}>
                  <VStack gap={2}>
                    <Spinner color={accentColorOrange} />
                    <Text fontSize="sm" color={descriptionColor}>
                      Awaiting wallet connection details...
                    </Text>
                  </VStack>
                </Center>
              )}
            </VStack>
          )}
        </VStack>
      )}
    </Box>
  );
};