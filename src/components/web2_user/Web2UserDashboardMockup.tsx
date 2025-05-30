import React, { useState } from "react";
import {
  Box,
  VStack,
  HStack,
  Heading,
  Text,
  Spinner,
  Input,
  InputGroup,
  Textarea,
  Image,
  Dialog,
  DialogBackdrop,
  DialogPositioner,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogBody,
  DialogCloseTrigger,
  useDisclosure,
  SimpleGrid,
  Card,
  Icon as ChakraIcon,
  Separator,
  Portal,
  Skeleton,
} from "@chakra-ui/react";
import { Button } from "@/components/ui/button";
import { CloseButton as UICloseButton } from "@/components/ui/close-button";
import {
  FaCreditCard,
  FaCoins,
  FaQuestionCircle,
  FaPaperPlane,
} from "react-icons/fa";

export const Web2UserDashboardMockup: React.FC = () => {
  const {
    open: isCreditCardModalOpen,
    onOpen: onCreditCardModalOpen,
    onClose: onCreditCardModalClose,
  } = useDisclosure();
  const {
    open: isAiBotModalOpen,
    onOpen: onAiBotModalOpen,
    onClose: onAiBotModalClose,
  } = useDisclosure();

  const [creditCardAmount, setCreditCardAmount] = useState("");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState<boolean | null>(null);

  const [aiBotMessage, setAiBotMessage] = useState("");
  const [aiBotResponses, setAiBotResponses] = useState<
    { user: string; bot: string }[]
  >([]);
  const [isBotTyping, setIsBotTyping] = useState(false);

  const mainBg = "yellow.50";
  const textColor = "yellow.900";
  const secondaryTextColor = "gray.700";
  const borderColor = "gray.200";
  const separatorColor = "gray.200";
  const cardBg = "white";
  const cardBorderColor = "gray.200";
  const headingAccentColor = "green.600";
  const dialogBg = "white";
  const inputBg = "white";
  const inputBorder = "gray.300";
  const inputHoverBorder = "yellow.400";
  const placeholderColor = "gray.500"; 
  const buttonHoverBg = "yellow.100";
  const chatHeaderBg = "yellow.100";
  const chatUserMsgBg = "blue.500"; 
  const chatBotMsgBg = "yellow.100";
  const supportBlue = "blue.500";
  const natureGreen = "green.600";

  const [isBotIconLoaded, setIsBotIconLoaded] = useState(false);
  const [isBotAvatarLoaded, setIsBotAvatarLoaded] = useState(false);

  const handleCreditCardSubmit = () => {
    if (!creditCardAmount || parseFloat(creditCardAmount) <= 0) {
      alert("Please enter a valid amount.");
      return;
    }
    setIsProcessingPayment(true);
    setPaymentSuccess(null);
    setTimeout(() => {
      setIsProcessingPayment(false);
      setPaymentSuccess(true);
      setCreditCardAmount("");
      setTimeout(() => {
        onCreditCardModalClose();
        setPaymentSuccess(null);
      }, 2500);
    }, 2000);
  };

  const handleAiBotSubmit = () => {
    if (!aiBotMessage.trim()) return;
    const userMsg = aiBotMessage;
    setAiBotResponses((prev) => [...prev, { user: userMsg, bot: "" }]);
    setAiBotMessage("");
    setIsBotTyping(true);

    setTimeout(() => {
      let botResponse =
        "I am an Alpaca Assistant here to help! How can I assist you with funding your account or understanding Alpaca Lotto today?";
      if (
        userMsg.toLowerCase().includes("hello") ||
        userMsg.toLowerCase().includes("hi")
      ) {
        botResponse =
          "Hello there! How can I help you get started with Alpaca Lotto?";
      } else if (
        userMsg.toLowerCase().includes("fund") ||
        userMsg.toLowerCase().includes("deposit") ||
        userMsg.toLowerCase().includes("credit card")
      ) {
        botResponse =
          "You can add funds using the 'Add Funds with Credit Card' option. If you don't have a credit card, I can guide you on other ways to get USDC for NERO Chain. Would you like to know more about that?";
      } else if (userMsg.toLowerCase().includes("exchange")) {
        botResponse =
          "You can purchase NERO or USDC on NERO Chain from exchanges like (example: MEXC, Gate.io - please verify actual exchanges supporting NERO) and then transfer to your Smart Account address. I can provide a general guide if you like!";
      } else if (userMsg.toLowerCase().includes("help")) {
        botResponse =
          "I can help with questions about funding your account, how to play, or understanding your smart wallet. What's on your mind?";
      }

      setAiBotResponses((prev) => {
        const newResponses = [...prev];
        newResponses[newResponses.length - 1].bot = botResponse;
        return newResponses;
      });
      setIsBotTyping(false);
    }, 1500);
  };

  return (
    <Box
      p={{ base: 4, md: 5 }}
      shadow="sm"
      borderWidth="1px"
      borderRadius="xl"
      bg={mainBg}
      color={textColor}
      mt={6}
      borderColor={borderColor}
    >
      <VStack align="stretch" gap={5}>
        <Heading as="h3" size="lg" textAlign="center" color={headingAccentColor}>
          Your Alpaca Lotto Dashboard
        </Heading>
        <Text textAlign="center" color={secondaryTextColor} fontSize="md">
          Manage your funds and get help here. Let's get you ready to play!
        </Text>

        <Separator my={3} borderColor={separatorColor} />

        <SimpleGrid columns={{ base: 1, md: 2 }} gap={6}>
          <Card.Root
            shadow="sm"
            borderRadius="xl"
            borderColor={cardBorderColor}
            borderWidth="1px"
            bg={cardBg}
            _hover={{ shadow: 'md', transform: 'translateY(-2px)' }}
            transition="all 0.2s ease-out"
          >
            <Card.Body p={5}>
              <VStack gap={4} align="stretch">
                <HStack gap={3}>
                  <ChakraIcon as={FaCreditCard} w={6} h={6} color={supportBlue} />
                  <Heading size="md" color={textColor}>
                    Fund Your Account
                  </Heading>
                </HStack>
                <Text fontSize="sm" color={secondaryTextColor}>
                  Easily add USDC to your smart account using your credit card.
                  Secure and fast.
                </Text>
                <Button
                  colorPalette="green" 
                  bg="green.600"
                  color="white"
                  _hover={{bg:"green.700", transform: 'scale(1.02)'}}
                  _active={{bg:"green.800", transform: 'scale(0.98)'}}
                  onClick={onCreditCardModalOpen}
                  gap={2}
                  borderRadius="lg"
                >
                  <FaCreditCard />
                  Add Funds with Credit Card
                </Button>
              </VStack>
            </Card.Body>
          </Card.Root>

          <Card.Root
            shadow="sm"
            borderRadius="xl"
            borderColor={cardBorderColor}
            borderWidth="1px"
            bg={cardBg}
            _hover={{ shadow: 'md', transform: 'translateY(-2px)' }}
            transition="all 0.2s ease-out"
          >
            <Card.Body p={5}>
              <VStack gap={4} align="stretch">
                <HStack gap={3}>
                  <Skeleton
                    boxSize="24px"
                    loading={!isBotIconLoaded}
                    borderRadius="md"
                  >
                    <Image
                      src="/images/alpaca-ai-bot-icon.png"
                      alt="Alpaca AI Assistant Icon"
                      boxSize="24px"
                      onLoad={() => setIsBotIconLoaded(true)}
                      borderRadius="md"
                    />
                  </Skeleton>
                  <Heading size="md" color={textColor}>
                    Alpaca AI Assistant
                  </Heading>
                </HStack>
                <Text fontSize="sm" color={secondaryTextColor}>
                  Have questions? Our friendly Alpaca Bot can help you with
                  funding options or game rules.
                </Text>
                <Button
                  colorPalette="green"
                  bg="green.600"
                  color="white"
                  _hover={{bg:"green.700", transform: 'scale(1.02)'}}
                  _active={{bg:"green.800", transform: 'scale(0.98)'}}
                  onClick={onAiBotModalOpen}
                  gap={2}
                  borderRadius="lg"
                >
                  <ChakraIcon as={FaQuestionCircle} />
                  Ask Alpaca Bot
                </Button>
              </VStack>
            </Card.Body>
          </Card.Root>
        </SimpleGrid>

        <Dialog.Root
          open={isCreditCardModalOpen}
          onOpenChange={(detail) => {
            if (!detail.open) onCreditCardModalClose();
          }}
          modal
        >
          <Portal>
            <DialogBackdrop bg="blackAlpha.600" />
            <DialogPositioner>
              <DialogContent
                bg={dialogBg}
                color={textColor}
                borderRadius="xl"
                borderWidth="1px"
                borderColor={cardBorderColor}
                width={{ base: "95%", md: "md" }}
                shadow="2xl"
              >
                <DialogHeader
                  borderBottomWidth="1px"
                  borderColor={cardBorderColor}
                  color={supportBlue}
                  fontWeight="bold"
                >
                  Add Funds via Credit Card (Mock)
                </DialogHeader>
                <DialogCloseTrigger asChild>
                  <UICloseButton
                    position="absolute"
                    top="12px"
                    right="12px"
                    _hover={{ bg: buttonHoverBg }}
                    borderRadius="md"
                  />
                </DialogCloseTrigger>
                <DialogBody py={6}>
                  {isProcessingPayment ? (
                    <VStack
                      justifyContent="center"
                      alignItems="center"
                      minH="150px"
                      gap={3}
                    >
                      <Spinner
                        size="xl"
                        color={supportBlue}
                        borderWidth="4px"
                      />
                      <Text color={secondaryTextColor}>
                        Processing your payment securely...
                      </Text>
                    </VStack>
                  ) : paymentSuccess === true ? (
                    <VStack
                      justifyContent="center"
                      alignItems="center"
                      minH="150px"
                      gap={3}
                    >
                      <ChakraIcon
                        as={FaCoins}
                        w={12}
                        h={12}
                        color={natureGreen}
                      />
                      <Text
                        fontSize="lg"
                        fontWeight="bold"
                        color={natureGreen}
                      >
                        Payment Successful!
                      </Text>
                      <Text color={secondaryTextColor}>
                        Funds will be reflected in your account shortly.
                      </Text>
                    </VStack>
                  ) : paymentSuccess === false ? (
                    <VStack
                      justifyContent="center"
                      alignItems="center"
                      minH="150px"
                      gap={3}
                    >
                      <ChakraIcon
                        as={FaCreditCard}
                        w={12}
                        h={12}
                        color="red.500"
                      />
                      <Text fontSize="lg" fontWeight="bold" color="red.600">
                        Payment Failed
                      </Text>
                      <Text color={secondaryTextColor}>
                        Please try again or contact support.
                      </Text>
                    </VStack>
                  ) : (
                    <VStack gap={4}>
                      <Text color={secondaryTextColor} fontSize="sm">
                        This is a mock interface for adding funds. No real
                        transaction will occur.
                      </Text>
                      <InputGroup>
                        <Input
                          size="lg"
                          type="number"
                          placeholder="Enter amount in USDC"
                          value={creditCardAmount}
                          onChange={(e) => setCreditCardAmount(e.target.value)}
                          bg={inputBg}
                          borderColor={inputBorder}
                          _hover={{ borderColor: inputHoverBorder }}
                          _focus={{
                            borderColor: supportBlue,
                            boxShadow: `0 0 0 1px ${supportBlue}`,
                          }}
                          _placeholder={{ color: placeholderColor }}
                          borderRadius="lg"
                        />
                      </InputGroup>
                      <Box
                        textAlign="center"
                        fontSize="xs"
                        color={secondaryTextColor}
                        p={2}
                        bg={"yellow.100"}
                        borderRadius="md"
                      >
                        Simulating secure payment processing by a third-party
                        provider.
                      </Box>
                    </VStack>
                  )}
                </DialogBody>
                <DialogFooter borderTopWidth="1px" borderColor={cardBorderColor}>
                  <Button
                    variant="ghost"
                    onClick={onCreditCardModalClose}
                    mr={3}
                    _hover={{ bg: buttonHoverBg }}
                    disabled={isProcessingPayment || paymentSuccess === true}
                    borderRadius="lg"
                  >
                    Cancel
                  </Button>
                  <Button
                    colorPalette="green"
                    bg="green.600"
                    color="white"
                    _hover={{bg:"green.700"}}
                    _active={{bg:"green.800"}}
                    onClick={handleCreditCardSubmit}
                    loading={isProcessingPayment}
                    disabled={
                      isProcessingPayment ||
                      paymentSuccess === true ||
                      paymentSuccess === false ||
                      !creditCardAmount
                    }
                    borderRadius="lg"
                  >
                    {isProcessingPayment ? "Processing..." : "Pay Now (Mock)"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </DialogPositioner>
          </Portal>
        </Dialog.Root>

        <Dialog.Root
          open={isAiBotModalOpen}
          onOpenChange={(detail) => {
            if (!detail.open) onAiBotModalClose();
          }}
          modal
        >
          <Portal>
            <DialogBackdrop bg="blackAlpha.600" />
            <DialogPositioner>
              <DialogContent
                bg={dialogBg}
                color={textColor}
                borderRadius="xl"
                borderWidth="1px"
                borderColor={cardBorderColor}
                maxH="80vh"
                width={{ base: "95%", md: "lg" }}
                shadow="2xl"
              >
                <DialogHeader
                  borderBottomWidth="1px"
                  borderColor={cardBorderColor}
                  color={natureGreen}
                  fontWeight="bold"
                >
                  Chat with Alpaca AI Assistant (Mock)
                </DialogHeader>
                <DialogCloseTrigger asChild>
                  <UICloseButton
                    position="absolute"
                    top="12px"
                    right="12px"
                    _hover={{ bg: buttonHoverBg }}
                    borderRadius="md"
                  />
                </DialogCloseTrigger>
                <DialogBody py={4} px={{ base: 3, md: 6 }} overflowY="auto">
                  <HStack mb={4} p={3} bg={chatHeaderBg} borderRadius="lg" gap={3}>
                    <Skeleton
                      boxSize="40px"
                      loading={!isBotAvatarLoaded}
                      borderRadius="full"
                    >
                      <Image
                        src="/images/alpaca-ai-bot-avatar.png"
                        alt="Alpaca Bot Avatar"
                        borderRadius="full"
                        boxSize="40px"
                        onLoad={() => setIsBotAvatarLoaded(true)}
                      />
                    </Skeleton>
                    <VStack align="start" gap={0}>
                      <Text fontWeight="bold" color={textColor}>
                        Alpaca Bot
                      </Text>
                      <Text fontSize="xs" color={natureGreen}>
                        Online
                      </Text>
                    </VStack>
                  </HStack>
                  <VStack
                    gap={3}
                    align="stretch"
                    minHeight="250px"
                    maxHeight="300px"
                    overflowY="auto"
                    pr={2}
                  >
                    {aiBotResponses.map((msg, index) => (
                      <React.Fragment key={index}>
                        <Box
                          alignSelf="flex-end"
                          bg={chatUserMsgBg}
                          color="white"
                          px={3}
                          py={2}
                          borderRadius="lg"
                          borderBottomRightRadius="md"
                          maxWidth="80%"
                        >
                          <Text fontSize="sm">{msg.user}</Text>
                        </Box>
                        {msg.bot && (
                          <HStack
                            alignSelf="flex-start"
                            maxWidth="80%"
                            alignItems="flex-end"
                            gap={2}
                          >
                            <Skeleton
                              boxSize="24px"
                              loading={!isBotIconLoaded} 
                              borderRadius="md"
                              flexShrink={0}
                            >
                              <Image
                                src="/images/alpaca-ai-bot-icon.png"
                                alt="Bot Icon"
                                boxSize="24px"
                                borderRadius="sm"
                                onLoad={() => setIsBotIconLoaded(true)}
                              />
                            </Skeleton>
                            <Box
                              bg={chatBotMsgBg}
                              color={textColor}
                              px={3}
                              py={2}
                              borderRadius="lg"
                              borderBottomLeftRadius="md"
                            >
                              <Text fontSize="sm" whiteSpace="pre-wrap">
                                {msg.bot}
                              </Text>
                            </Box>
                          </HStack>
                        )}
                      </React.Fragment>
                    ))}
                    {isBotTyping && (
                      <HStack alignSelf="flex-start" gap={2} px={2} py={1}>
                        <Spinner
                          size="xs"
                          color={natureGreen}
                          borderWidth="2px" 
                        />
                        <Text fontSize="sm" color={secondaryTextColor}>
                          Alpaca Bot is typing...
                        </Text>
                      </HStack>
                    )}
                  </VStack>
                </DialogBody>
                <DialogFooter borderTopWidth="1px" borderColor={cardBorderColor}>
                  <HStack width="100%" gap={2}>
                    <Textarea
                      placeholder="Type your message..."
                      value={aiBotMessage}
                      onChange={(e) => setAiBotMessage(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleAiBotSubmit();
                        }
                      }}
                      bg={inputBg}
                      borderColor={inputBorder}
                      _hover={{ borderColor: inputHoverBorder }}
                      _focus={{
                        borderColor: natureGreen,
                        boxShadow: `0 0 0 1px ${natureGreen}`,
                      }}
                      _placeholder={{ color: placeholderColor }}
                      resize="none"
                      rows={1}
                      fontSize="sm"
                      borderRadius="lg"
                    />
                    <Button
                      colorPalette="green"
                      bg="green.600"
                      color="white"
                      _hover={{bg:"green.700", transform: 'scale(1.02)'}}
                      _active={{bg:"green.800", transform: 'scale(0.98)'}}
                      onClick={handleAiBotSubmit}
                      disabled={isBotTyping || !aiBotMessage.trim()}
                      gap={2}
                      borderRadius="lg"
                    >
                      Send
                      <FaPaperPlane />
                    </Button>
                  </HStack>
                </DialogFooter>
              </DialogContent>
            </DialogPositioner>
          </Portal>
        </Dialog.Root>
      </VStack>
    </Box>
  );
};