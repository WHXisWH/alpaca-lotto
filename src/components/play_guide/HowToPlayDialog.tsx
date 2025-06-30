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
  FaMedal,
  FaCog,
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
    <Li display="flex" alignItems="flex-start" gap={2} py={1} listStyleType={"none"}>
      {num ? (
        <Text fontWeight="bold" color={accentColor} w="18px">{num}.</Text>
      ) : icon ? (
        <Icon as={icon} color={iconColor || accentColor} mt="0.2em" boxSize={4} w="18px" />
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
                </Box>

                <Box>
                  <SectionHeading>2. Buying Tickets</SectionHeading>
                  <Ul m={0}>
                    <CustomLi num={1}>
                      <Text><Text as="span" fontWeight="bold">Choose Payment Method:</Text> On the ticket card, use the selector buttons to pay with either <Code bg={codeBg} color={codeColor} px={1} borderRadius="md" fontSize="xs">USDC</Code> or our special <Code bg={codeBg} color={codeColor} px={1} borderRadius="md" fontSize="xs">PLT</Code> token.</Text>
                    </CustomLi>
                    <CustomLi num={2}>
                      <Text><Text as="span" fontWeight="bold">Select Quantity:</Text> Choose how many tickets you want to buy.</Text>
                    </CustomLi>
                    <CustomLi num={3}>
                       <Box>
                         <Text fontWeight="bold">One-Time Approval:</Text>
                         <Paragraph fontSize="sm" mt={1}>
                           For security, your first purchase with any token requires a one-time "Approve" transaction. This is a standard Web3 step that gives the lottery contract permission to accept your tokens.
                         </Paragraph>
                       </Box>
                    </CustomLi>
                    <CustomLi num={4}>
                      <Text><Text as="span" fontWeight="bold">Purchase:</Text> Click the final purchase button and confirm the transaction in your wallet.</Text>
                    </CustomLi>
                  </Ul>
                </Box>

                <Box>
                  <SectionHeading>3. Checking Tickets & Claiming Prizes</SectionHeading>
                  <Ul m={0}>
                    <CustomLi icon={FaTicketAlt}>
                      <Text><Text as="span" fontWeight="bold">View Your Tickets:</Text> Go to the "My Tickets" tab to see your tickets for upcoming and past lotteries.</Text>
                    </CustomLi>
                    <CustomLi icon={FaTrophy} iconColor="orange.400">
                      <Text><Text as="span" fontWeight="bold">Claim Your Prize:</Text> If you win, a "Claim Prize" button will appear on the winning ticket group. Click it to receive your winnings!</Text>
                    </CustomLi>
                  </Ul>
                </Box>
                
                <Box>
                  <SectionHeading>4. PacaLuck Token (PLT)</SectionHeading>
                  <Ul m={0}>
                    <CustomLi>
                        <Text><Text as="span" fontWeight="bold">How to Earn:</Text> Earn PLT from the <Text as="span" fontWeight="bold">Daily Check-in</Text> in the "Hall of Fame" tab, by referring friends, and reaching purchase milestones.</Text>
                    </CustomLi>
                     <CustomLi>
                        <Text><Text as="span" fontWeight="bold">How to Use:</Text> Use your PLT tokens directly to <Text as="span" fontWeight="bold">purchase lottery tickets</Text> or hold them for future perks!</Text>
                    </CustomLi>
                  </Ul>
                </Box>

                <Box>
                  <SectionHeading>5. Hall of Fame & Settings</SectionHeading>
                   <Ul m={0}>
                    <CustomLi icon={FaMedal} iconColor="gold">
                        <Text><Text as="span" fontWeight="bold">My Badge Wall:</Text> View all the cool achievement badges you've unlocked on your journey.</Text>
                    </CustomLi>
                    <CustomLi icon={FaTrophy} iconColor="silver">
                        <Text><Text as="span" fontWeight="bold">Leaderboards:</Text> Check out the top players, including the "Referral Masters" leaderboard.</Text>
                    </CustomLi>
                     <CustomLi icon={FaCog} iconColor="gray.500">
                        <Text><Text as="span" fontWeight="bold">Account Settings:</Text> Configure advanced Account Abstraction features like "Gaming Mode" for automated purchasing.</Text>
                    </CustomLi>
                  </Ul>
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