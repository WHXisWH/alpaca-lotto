import React, { ReactNode, useState } from 'react';
import { Box, Flex, Heading, Image, Text, Link, Icon, HStack, Skeleton, Button as ChakraButton } from "@chakra-ui/react";
import { FaGift, FaGithub, FaTwitter } from "react-icons/fa";

interface LayoutProps {
  children: ReactNode;
  onOpenReferralModal?: () => void; 
}

export const Layout: React.FC<LayoutProps> = ({ children, onOpenReferralModal }) => {
  const headerBg = "white";
  const footerBg = "green.100"; 
  const textPrimary = "yellow.900";
  const textSecondary = "gray.700";
  const accentColor = "green.600";
  const [isLogoLoaded, setIsLogoLoaded] = useState(false);

  return (
    <Flex direction="column" minHeight="100vh" bg="green.50">
      <Box as="header" bg={headerBg} shadow="sm" color={textPrimary} borderBottomWidth="1px" borderColor="gray.200">
        <Flex
          maxW="7xl"
          mx="auto"
          py={3}
          px={{ base: 4, sm: 6, lg: 8 }}
          align="center"
          justify="space-between"
        >
          <HStack gap={3}>
            <Skeleton boxSize="40px" loading={isLogoLoaded} borderRadius="lg">
              <Image 
                src="/images/alpaca-logo.png" 
                alt="Alpaca Lotto Logo" 
                boxSize="40px" 
                onLoad={() => setIsLogoLoaded(true)}
                borderRadius="lg"
              />
            </Skeleton>
            <Heading as="h1" size="lg" fontWeight="bold" color={accentColor}>
              Alpaca Lotto
            </Heading>
          </HStack>
          <HStack gap={4}>
            {onOpenReferralModal && (
              <ChakraButton
                size="sm"
                variant="outline"
                colorScheme="yellow"
                color="yellow.700"
                borderColor="yellow.300"
                onClick={onOpenReferralModal}
                _hover={{ bg: "yellow.50" }}
                borderRadius="lg"
                gap={2}
              >
                <Icon as={FaGift} />
                Referral
              </ChakraButton>
            )}
            <Link href="https://x.com/AlpacaLotto" target="_blank" rel="noopener noreferrer" display="flex" alignItems="center" _hover={{color: "blue.500"}}>
                <Icon as={FaTwitter} boxSize={5} color="gray.700"/>
            </Link>
            <Link href="https://github.com/WHXisWH/alpaca-lotto" target="_blank" rel="noopener noreferrer" display="flex" alignItems="center" _hover={{color: "yellow.900"}}>
              <Icon as={FaGithub} boxSize={5} color="gray.700"/>
            </Link>
          </HStack>
        </Flex>
      </Box>
      <Box as="main" flex="1">
        <Box maxW="4xl" mx="auto" py={6} px={{ base: 4, sm: 6, lg: 8 }}>
          {children}
        </Box>
      </Box>
      <Box as="footer" bg={footerBg} color={textSecondary} borderTopWidth="1px" borderColor="gray.200">
        <Flex
          maxW="7xl"
          mx="auto"
          py={4}
          px={{ base: 4, sm: 6, lg: 8 }}
          direction={{ base: "column", sm: "row" }}
          justify="space-between"
          align="center"
          gap={2}
        >
          <Text textAlign="center" fontSize="sm">
            &copy; {new Date().getFullYear()} Alpaca Lotto - Built on NERO Chain with Account Abstraction
          </Text>
        </Flex>
      </Box>
    </Flex>
  );
};