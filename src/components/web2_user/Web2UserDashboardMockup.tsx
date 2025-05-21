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
} from "@chakra-ui/react";
import { Button } from "@/components/ui/button";
import { CloseButton as UICloseButton } from "@/components/ui/close-button";
import { FaCreditCard, FaCoins, FaQuestionCircle, FaRobot } from "react-icons/fa";


export const Web2UserDashboardMockup: React.FC = () => {
  const { open: isCreditCardModalOpen, onOpen: onCreditCardModalOpen, onClose: onCreditCardModalClose } = useDisclosure();
  const { open: isAiBotModalOpen, onOpen: onAiBotModalOpen, onClose: onAiBotModalClose } = useDisclosure();
  
  const [creditCardAmount, setCreditCardAmount] = useState("");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState<boolean | null>(null);

  const [aiBotMessage, setAiBotMessage] = useState("");
  const [aiBotResponses, setAiBotResponses] = useState<{user: string, bot: string}[]>([]);
  const [isBotTyping, setIsBotTyping] = useState(false);

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
    setAiBotResponses(prev => [...prev, {user: userMsg, bot: ""}]);
    setAiBotMessage("");
    setIsBotTyping(true);

    setTimeout(() => {
        let botResponse = "I am an Alpaca Assistant here to help! How can I assist you with funding your account or understanding Alpaca Lotto today?";
        if (userMsg.toLowerCase().includes("hello") || userMsg.toLowerCase().includes("hi")) {
            botResponse = "Hello there! How can I help you get started with Alpaca Lotto?";
        } else if (userMsg.toLowerCase().includes("fund") || userMsg.toLowerCase().includes("deposit") || userMsg.toLowerCase().includes("credit card")) {
            botResponse = "You can add funds using the 'Add Funds with Credit Card' option. If you don't have a credit card, I can guide you on other ways to get USDC for NERO Chain. Would you like to know more about that?";
        } else if (userMsg.toLowerCase().includes("exchange")) {
            botResponse = "You can purchase NERO or USDC on NERO Chain from exchanges like (example: MEXC, Gate.io - please verify actual exchanges supporting NERO) and then transfer to your Smart Account address. I can provide a general guide if you like!";
        } else if (userMsg.toLowerCase().includes("help")) {
             botResponse = "I can help with questions about funding your account, how to play, or understanding your smart wallet. What's on your mind?";
        }
        
        setAiBotResponses(prev => {
            const newResponses = [...prev];
            newResponses[newResponses.length - 1].bot = botResponse;
            return newResponses;
        });
        setIsBotTyping(false);
    }, 1500);
  };


  return (
    <Box p={5} shadow="lg" borderWidth="1px" borderRadius="xl" bg="gray.700" color="white" mt={6} borderColor="gray.600">
      <VStack align="stretch" gap={5}>
        <Heading as="h3" size="lg" textAlign="center" color="teal.300">
          Your Alpaca Lotto Dashboard
        </Heading>
        <Text textAlign="center" color="gray.300" fontSize="md">
          Manage your funds and get help here. Let's get you ready to play!
        </Text>
        
        <Separator my={2} borderColor="gray.500"/>


        <SimpleGrid columns={{base: 1, md: 2}} gap={6}>
            <Card.Root bg="gray.600" shadow="md" borderRadius="lg">
                <Card.Body>
                    <VStack gap={4} align="stretch">
                        <HStack gap={2}>
                            <ChakraIcon as={FaCreditCard} w={6} h={6} color="blue.300" />
                            <Heading size="md" color="whiteAlpha.900">Fund Your Account</Heading>
                        </HStack>
                        <Text fontSize="sm" color="gray.300">
                            Easily add USDC to your smart account using your credit card. Secure and fast.
                        </Text>
                         <Button 
                            colorPalette="blue"
                            onClick={onCreditCardModalOpen}
                            gap={2}
                        >
                            <FaCreditCard />
                            Add Funds with Credit Card
                        </Button>
                    </VStack>
                </Card.Body>
            </Card.Root>

            <Card.Root bg="gray.600" shadow="md" borderRadius="lg">
                <Card.Body>
                    <VStack gap={4} align="stretch">
                        <HStack gap={2}>
                             <ChakraIcon as={FaRobot} w={6} h={6} color="green.300" />
                            <Heading size="md" color="whiteAlpha.900">Alpaca AI Assistant</Heading>
                        </HStack>
                        <Text fontSize="sm" color="gray.300">
                            Have questions? Our friendly Alpaca Bot can help you with funding options or game rules.
                        </Text>
                        <Button 
                            colorPalette="green"
                            onClick={onAiBotModalOpen}
                            gap={2}
                        >
                            <FaQuestionCircle />
                            Ask Alpaca Bot
                        </Button>
                    </VStack>
                </Card.Body>
            </Card.Root>
        </SimpleGrid>

        <Dialog.Root 
            open={isCreditCardModalOpen} 
            onOpenChange={(detail) => { if (!detail.open) onCreditCardModalClose();}}
            modal 
        >
            <Portal>
                <DialogBackdrop bg="blackAlpha.700" />
                <DialogPositioner>
                    <DialogContent 
                        bg="gray.700" 
                        color="white" 
                        borderRadius="xl" 
                        borderWidth="1px" 
                        borderColor="gray.500"
                        width={{base: "90%", md: "md"}}
                    >
                        <DialogHeader borderBottomWidth="1px" borderColor="gray.600" color="teal.300">
                            Add Funds via Credit Card (Mock)
                        </DialogHeader>
                        <DialogCloseTrigger asChild>
                             <UICloseButton position="absolute" top="8px" right="8px" _hover={{bg: "gray.600"}} />
                        </DialogCloseTrigger>
                        <DialogBody py={6}>
                            {isProcessingPayment ? (
                            <VStack justifyContent="center" alignItems="center" minH="150px" gap={3}>
                                <Spinner size="xl" color="teal.300" borderWidth="4px" animationDuration="0.45s"/>
                                <Text color="gray.300">Processing your payment securely...</Text>
                            </VStack>
                            ) : paymentSuccess === true ? (
                            <VStack justifyContent="center" alignItems="center" minH="150px" gap={3}>
                                <ChakraIcon as={FaCoins} w={12} h={12} color="green.400" />
                                <Text fontSize="lg" fontWeight="bold" color="green.300">Payment Successful!</Text>
                                <Text color="gray.300">Funds will be reflected in your account shortly.</Text>
                            </VStack>
                            ) : paymentSuccess === false ? (
                            <VStack justifyContent="center" alignItems="center" minH="150px" gap={3}>
                                <ChakraIcon as={FaCreditCard} w={12} h={12} color="red.400" />
                                <Text fontSize="lg" fontWeight="bold" color="red.300">Payment Failed</Text>
                                <Text color="gray.300">Please try again or contact support.</Text>
                            </VStack>
                            ) : (
                            <VStack gap={4}>
                                <Text color="gray.300">This is a mock interface for adding funds. No real transaction will occur.</Text>
                                <InputGroup 
                                    startElement={
                                        <Text color="gray.400" pl={3} pr={2} style={{pointerEvents: "none"}}>
                                            $
                                        </Text>
                                    }
                                >
                                    <Input 
                                        type="number"
                                        placeholder="Enter amount in USDC"
                                        value={creditCardAmount}
                                        onChange={(e) => setCreditCardAmount(e.target.value)}
                                        bg="gray.600"
                                        borderColor="gray.500"
                                        _hover={{borderColor: "gray.400"}}
                                        _focus={{borderColor: "teal.300", boxShadow: "0 0 0 1px teal.300"}}
                                        _placeholder={{color: "gray.400"}}
                                    />
                                </InputGroup>
                                <Box textAlign="center" fontSize="xs" color="gray.400" p={2} bg="gray.600" borderRadius="md">
                                   Simulating secure payment processing by a third-party provider.
                                </Box>
                            </VStack>
                            )}
                        </DialogBody>
                        <DialogFooter borderTopWidth="1px" borderColor="gray.600">
                            <Button variant="ghost" onClick={onCreditCardModalClose} mr={3} _hover={{bg: "gray.600"}} disabled={isProcessingPayment || paymentSuccess === true}>
                                Cancel
                            </Button>
                            <Button 
                                colorPalette="blue"
                                onClick={handleCreditCardSubmit} 
                                loading={isProcessingPayment}
                                disabled={isProcessingPayment || paymentSuccess === true || paymentSuccess === false || !creditCardAmount}
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
            onOpenChange={(detail) => { if (!detail.open) onAiBotModalClose();}}
            modal
        >
            <Portal>
                <DialogBackdrop bg="blackAlpha.700" />
                <DialogPositioner>
                    <DialogContent 
                        bg="gray.700" 
                        color="white" 
                        borderRadius="xl" 
                        borderWidth="1px" 
                        borderColor="gray.500" 
                        maxH="80vh"
                        width={{base: "90%", md: "lg"}}
                    >
                        <DialogHeader borderBottomWidth="1px" borderColor="gray.600" color="green.300">
                            Chat with Alpaca AI Assistant (Mock)
                        </DialogHeader>
                        <DialogCloseTrigger asChild>
                             <UICloseButton position="absolute" top="8px" right="8px" _hover={{bg: "gray.600"}} />
                        </DialogCloseTrigger>
                        <DialogBody py={4} overflowY="auto">
                            <HStack mb={4} p={3} bg="gray.600" borderRadius="md" gap={3}>
                                <Box p={2} bg="green.500" borderRadius="full">
                                    <ChakraIcon as={FaRobot} color="white" boxSize={6}/>
                                </Box>
                                <VStack align="start" gap={0}>
                                     <Text fontWeight="bold" color="whiteAlpha.900">Alpaca Bot</Text>
                                     <Text fontSize="xs" color="green.300">Online</Text>
                                </VStack>
                            </HStack>
                            <VStack gap={4} align="stretch" minHeight="200px">
                                {aiBotResponses.map((msg, index) => (
                                    <React.Fragment key={index}>
                                        <Box alignSelf="flex-end" bg="blue.500" color="white" px={4} py={2} borderRadius="lg" borderBottomRightRadius="none" maxWidth="80%">
                                            <Text>{msg.user}</Text>
                                        </Box>
                                        {msg.bot && (
                                            <Box alignSelf="flex-start" bg="gray.600" color="whiteAlpha.900" px={4} py={2} borderRadius="lg" borderBottomLeftRadius="none" maxWidth="80%">
                                                <Text whiteSpace="pre-wrap">{msg.bot}</Text>
                                            </Box>
                                        )}
                                    </React.Fragment>
                                ))}
                                {isBotTyping && (
                                    <HStack alignSelf="flex-start" gap={2} px={2} py={1}>
                                        <Spinner size="xs" color="green.300" borderWidth="2px" animationDuration="0.45s"/>
                                        <Text fontSize="sm" color="gray.400">Alpaca Bot is typing...</Text>
                                    </HStack>
                                )}
                            </VStack>
                        </DialogBody>
                        <DialogFooter borderTopWidth="1px" borderColor="gray.600">
                            <HStack width="100%" gap={2}>
                                <Textarea
                                    placeholder="Type your message..."
                                    value={aiBotMessage}
                                    onChange={(e) => setAiBotMessage(e.target.value)}
                                    onKeyPress={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAiBotSubmit(); }}}
                                    bg="gray.600"
                                    borderColor="gray.500"
                                    _hover={{borderColor: "gray.400"}}
                                    _focus={{borderColor: "green.300", boxShadow: "0 0 0 1px green.300"}}
                                    _placeholder={{color: "gray.400"}}
                                    resize="none"
                                    rows={1}
                                />
                                <Button colorPalette="green" onClick={handleAiBotSubmit} disabled={isBotTyping || !aiBotMessage.trim()}>
                                    Send
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