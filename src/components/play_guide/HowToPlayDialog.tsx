import React from "react";
import {
  Dialog,
  DialogBackdrop,
  DialogPositioner,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogCloseTrigger,
  VStack,
  Text,
  Heading,
  Code,
  Icon,
  Link,
  Portal,
  Box,
  chakra,
} from "@chakra-ui/react";
import { Button } from "@/components/ui/button";
import { CloseButton as UICloseButton } from "@/components/ui/close-button";
import {
  FaGoogleWallet,
  FaGoogle,
  FaTicketAlt,
  FaTrophy,
  FaQuestionCircle,
  FaInfoCircle, // Added for new user tip
} from "react-icons/fa";

const Ul = chakra("ul");
const Li = chakra("li");

interface HowToPlayDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HowToPlayDialog: React.FC<HowToPlayDialogProps> = ({
  isOpen,
  onClose,
}) => {
  const primaryTextColor = "yellow.900";
  const secondaryTextColor = "gray.700";
  const accentColor = "green.600";
  const dialogBg = "yellow.50";
  const borderColor = "gray.200";
  const buttonHoverBg = "yellow.100";
  const codeBg = "orange.100";
  const codeColor = "orange.800";
  const tipBg = "blue.50"; // Background for the new user tip
  const tipBorderColor = "blue.200";
  const tipTextColor = "blue.700";


  if (!isOpen) return null;

  const SectionHeading: React.FC<{ children: React.ReactNode; mb?: number | string }> = ({
    children,
    mb = 3,
  }) => (
    <Heading size="md" color={accentColor} mb={mb}>
      {children}
    </Heading>
  );

  const Paragraph: React.FC<{
    children: React.ReactNode;
    mt?: number | string;
    ml?: number | string;
    fontSize?: string | object;
  }> = ({ children, mt, ml, fontSize = "md" }) => (
    <Text color={secondaryTextColor} fontSize={fontSize} mt={mt} ml={ml}>
      {children}
    </Text>
  );

  const CustomLi: React.FC<{
    children: React.ReactNode;
    icon?: React.ElementType;
    iconColor?: string;
    num?: number;
  }> = ({ children, icon, iconColor, num }) => (
    <Li display="flex" alignItems="flex-start" gap={2} py={1} listStyleType={num ? "none" : "disc"} pl={num ? 0 : 4}>
      {num ? (
        <Text fontWeight="bold" color={accentColor}>{num}.</Text>
      ) : icon ? (
        <Icon as={icon} color={iconColor || accentColor} mt="0.2em" boxSize={4} />
      ) : null}
      <Box flex="1">{children}</Box>
    </Li>
  );

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(d) => {
        if (!d.open) onClose();
      }}
      modal
      size="xl"
    >
      <Portal>
        <DialogBackdrop bg="blackAlpha.600" />
        <DialogPositioner>
          <DialogContent
            bg={dialogBg}
            color={primaryTextColor}
            borderRadius="xl"
            borderWidth="1px"
            borderColor={borderColor}
            width={{ base: "95%", md: "2xl", lg: "3xl" }}
            maxH="85vh"
            shadow="2xl"
          >
            <DialogHeader
              borderBottomWidth="1px"
              borderColor={borderColor}
              color={accentColor}
              fontWeight="bold"
              fontSize="2xl"
            >
              <Icon as={FaQuestionCircle} mr={3} boxSize={6} />
              How to Play Alpaca Lotto
            </DialogHeader>
            <DialogCloseTrigger asChild>
              <UICloseButton
                position="absolute"
                top="16px"
                right="16px"
                _hover={{ bg: buttonHoverBg }}
                borderRadius="md"
              />
            </DialogCloseTrigger>
            <DialogBody py={6} px={{ base: 4, md: 6 }} overflowY="auto" className="no-scrollbar">
              <VStack gap={6} align="stretch">
                <Box>
                  <SectionHeading mb={2}>Welcome to Alpaca Lotto!</SectionHeading>
                  <Paragraph>
                    Alpaca Lotto is a fun, fair, and easy-to-use blockchain lottery platform on the NERO Chain. We use Account Abstraction (AA) technology for a smooth experience, just like your favorite Web2 apps!
                  </Paragraph>
                  <Paragraph mt={1} fontSize="sm">
                    Key Features: Social Login, Smart Wallets, Simplified Gas Fees (USDC for tickets).
                  </Paragraph>
                </Box>

                <Box>
                  <SectionHeading>1. Getting Started (Login/Register)</SectionHeading>
                  <Ul m={0}>
                    <CustomLi icon={FaGoogle} iconColor="red.500">
                      <Box>
                        <Text fontWeight="bold" display="inline">Social Login (Recommended): </Text>
                        <Text as="span">Click "Login with Social/Email", choose Google. A secure Smart Account will be created for you.</Text>
                      </Box>
                    </CustomLi>
                    <CustomLi icon={FaGoogleWallet} iconColor="blue.500">
                      <Box>
                        <Text fontWeight="bold" display="inline">Connect Existing Crypto Wallet: </Text>
                        <Text as="span">Click "Connect External Wallet" to link MetaMask, WalletConnect, etc.</Text>
                      </Box>
                    </CustomLi>
                  </Ul>
                  <Paragraph mt={2}>
                    After login, your{" "}
                    <Code bg={codeBg} color={codeColor} px={1} borderRadius="md" fontSize="xs">
                      Smart Account
                    </Code>{" "}
                    address and USDC balance appear at the top.
                  </Paragraph>
                </Box>

                <Box>
                  <SectionHeading>2. Buying Tickets</SectionHeading>
                  <Ul m={0}>
                    <CustomLi num={1}>
                      <Text><Text as="span" fontWeight="bold">Select Lottery: </Text>Browse lotteries in the "Buy Tickets" tab.</Text>
                    </CustomLi>
                    <CustomLi num={2}>
                      <Text><Text as="span" fontWeight="bold">Choose Quantity: </Text>Select ticket amount.</Text>
                    </CustomLi>
                    <CustomLi num={3}>
                      <Text><Text as="span" fontWeight="bold">Referral (Optional): </Text>Use the "Referral" button.</Text>
                    </CustomLi>
                    <CustomLi num={4}>
                      <Text><Text as="span" fontWeight="bold">Check Costs: </Text>Review USDC cost and Gas.</Text>
                    </CustomLi>
                    <CustomLi num={5}>
                      <Box>
                        <Text fontWeight="bold">First-Time Purchase Prep:</Text>
                        <Ul mt={1} pl={5} gap={1}>
                          <Li listStyleType="disc">
                            <Code bg={codeBg} color={codeColor} px={1} borderRadius="md" fontSize="xs">
                              Approve USDC
                            </Code>{" "}
                             one-time allowance for spending.
                          </Li>
                          <Li listStyleType="disc">Ensure sufficient USDC balance for tickets and Gas.</Li>
                        </Ul>
                        <Box
                          mt={2}
                          p={3}
                          bg={tipBg}
                          borderWidth="1px"
                          borderColor={tipBorderColor}
                          borderRadius="md"
                          display="flex"
                          alignItems="flex-start"
                          gap={2}
                        >
                          <Icon as={FaInfoCircle} color={tipTextColor} mt="0.15em" boxSize={4} flexShrink={0}/>
                          <Text fontSize="xs" color={tipTextColor} lineHeight="short">
                            <Text as="span" fontWeight="bold">First-time AA Wallet Users:</Text> You'll need some USDC in your Smart Account for ticket purchases. If your balance is zero, please add funds (e.g., via the 'Fund Your Account' option if you used social login, or by transferring USDC to your Smart Account address). After funding, refresh the page. For the initial USDC approval, ensure the 'Gas Payment Option' is set to 'Sponsored Gas (Free)'. Once approved, you can select your preferred gas payment method for actual ticket purchases.
                          </Text>
                        </Box>
                      </Box>
                    </CustomLi>
                    <CustomLi num={6}>
                      <Text><Text as="span" fontWeight="bold">Purchase: </Text>Click "Purchase Tickets" and confirm.</Text>
                    </CustomLi>
                  </Ul>
                </Box>

                <Box>
                  <SectionHeading>3. Checking Tickets & Claiming Prizes</SectionHeading>
                  <Ul m={0}>
                    <CustomLi num={1} icon={FaTicketAlt}>
                      <Text><Text as="span" fontWeight="bold">View Tickets: </Text>See "Awaiting Draw" and "Past Lotteries".</Text>
                    </CustomLi>
                    <CustomLi num={2}>
                      <Text><Text as="span" fontWeight="bold">Await Draw: </Text>Wait for draw time.</Text>
                    </CustomLi>
                    <CustomLi num={3} icon={FaTrophy}>
                      <Text><Text as="span" fontWeight="bold">Claim Prize: </Text>Click "Claim Prize" if you win.</Text>
                    </CustomLi>
                  </Ul>
                </Box>

                <Box>
                  <SectionHeading mb={2}>4. PacaLuck Token (PLT)</SectionHeading>
                  <Paragraph>Earn PLT via referrals and milestones; future use for Gas and events.</Paragraph>
                </Box>

                <Box>
                  <SectionHeading mb={2}>Questions?</SectionHeading>
                  <Paragraph>
                    Join our community on{" "}
                    <Link href="https://x.com/AlpacaLotto" color="blue.500" target="_blank" rel="noopener noreferrer">
                      Twitter
                    </Link>
                    .
                  </Paragraph>
                </Box>
              </VStack>
            </DialogBody>
            <DialogFooter borderTopWidth="1px" borderColor={borderColor}>
              <Button
                colorPalette="green"
                bg="green.600"
                color="white"
                _hover={{ bg: "green.700" }}
                _active={{ bg: "green.800" }}
                onClick={onClose}
                borderRadius="lg"
              >
                Got it!
              </Button>
            </DialogFooter>
          </DialogContent>
        </DialogPositioner>
      </Portal>
    </Dialog.Root>
  );
};