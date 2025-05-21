import React, { ReactNode } from 'react';
import { Box, Flex, Heading, Image, Text, Link, Icon, HStack, Skeleton } from "@chakra-ui/react";
import { FaGithub } from "react-icons/fa";

interface LayoutProps {
  children: ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const alpacaHeaderBg = "gray.800";
  const alpacaFooterBg = "gray.750"; 
  const alpacaTextPrimary = "whiteAlpha.900";
  const alpacaTextSecondary = "gray.400";
  const alpacaAccent = "teal.300";
  const [isLogoLoaded, setIsLogoLoaded] = React.useState(false);

  return (
    <Flex direction="column" minHeight="100vh" bg="gray.900">
      <Box as="header" bg={alpacaHeaderBg} shadow="md" color={alpacaTextPrimary}>
        <Flex
          maxW="7xl"
          mx="auto"
          py={3}
          px={{ base: 4, sm: 6, lg: 8 }}
          align="center"
          justify="space-between"
        >
          <HStack gap={3}>
            <Skeleton boxSize="40px" loading={!isLogoLoaded} borderRadius="md">
              <Image 
                src="/images/alpaca-logo.png" 
                alt="Alpaca Lotto Logo" 
                boxSize="40px" 
                onLoad={() => setIsLogoLoaded(true)}
              />
            </Skeleton>
            <Heading as="h1" size="lg" fontWeight="bold" color={alpacaAccent}>
              Alpaca Lotto
            </Heading>
          </HStack>
        </Flex>
      </Box>
      <Box as="main" flex="1">
        <Box maxW="4xl" mx="auto" py={6} px={{ base: 4, sm: 6, lg: 8 }}>
          {children}
        </Box>
      </Box>
      <Box as="footer" bg={alpacaFooterBg} color={alpacaTextSecondary} borderTopWidth="1px" borderColor="gray.700">
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
          <Link href="https://github.com/your-repo-link" target="_blank" rel="noopener noreferrer" display="flex" alignItems="center" _hover={{color: alpacaAccent}}>
            <Icon as={FaGithub} mr={1}/>
            View on GitHub
          </Link>
        </Flex>
      </Box>
    </Flex>
  );
};