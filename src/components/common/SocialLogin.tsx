import React, { useState } from "react";
import {
  Box,
  VStack,
  Text,
  Input,
  HStack,
  Icon,
  Spinner,
} from "@chakra-ui/react";
import { Button } from "@/components/ui/button";
import { FaGoogle, FaEnvelope } from "react-icons/fa";
import { useAAWallet } from "@/context/AAWalletContext";
import { toaster } from "@/components/ui/toaster";

export const SocialLogin: React.FC = () => {
  const [email, setEmail] = useState("");
  const [isEmailLoginMode, setIsEmailLoginMode] = useState(false);
  const { initializeAAWalletFromSocial, loading: aaLoading, error: aaErrorFromContext } = useAAWallet();
  const [currentLoginProvider, setCurrentLoginProvider] = useState<string | null>(null);

  const primaryTextColor = "yellow.900";
  const secondaryTextColor = "gray.700";
  const accentColorGreen = "green.600";
  const cardBg = "yellow.50";
  const borderColor = "gray.200";
  const inputBg = "white";
  const inputBorderColor = "gray.300";
  const inputFocusBorderColor = "green.500";
  const placeholderColor = "gray.500";

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
  };

  const handleLogin = async (provider: string, userEmail?: string) => {
    if (provider === "email_passwordless" && !userEmail) {
        setTimeout(() => toaster.create({
            title: "Email Required",
            description: "Please enter your email to continue with email login.",
            type: "error"
        }), 0);
        return;
    }

    setCurrentLoginProvider(provider);
    try {
      await initializeAAWalletFromSocial(provider, userEmail);
    } catch (error: any) {
      setTimeout(() => toaster.create({
        title: "Login Attempt Failed",
        description: error.message || `Failed to login with ${provider}. ${aaErrorFromContext || ''}`,
        type: "error"
      }), 0);
    } finally {
        setCurrentLoginProvider(null);
    }
  };
  
  const isButtonLoading = (provider: string) => aaLoading && currentLoginProvider === provider;

  return (
    <Box
      p={6}
      borderWidth="1px"
      borderRadius="xl"
      shadow="sm"
      bg={cardBg} 
      color={primaryTextColor}
      width="100%"
      maxWidth="400px"
      mx="auto"
      borderColor={borderColor}
    >
      <VStack gap={4} align="stretch">
        <Text fontSize="xl" fontWeight="bold" textAlign="center" color={primaryTextColor}>
          {isEmailLoginMode ? "Continue with Email" : "Join with Social Account"}
        </Text>
        
        {isEmailLoginMode ? (
          <VStack gap={3}>
            <Box width="100%">
              <Text mb={1} fontSize="sm" color={secondaryTextColor}>Email Address</Text>
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={handleEmailChange}
                bg={inputBg}
                color={primaryTextColor}
                borderColor={inputBorderColor}
                _hover={{ borderColor: "gray.400" }}
                _focus={{ borderColor: inputFocusBorderColor, boxShadow: `0 0 0 1px ${inputFocusBorderColor}` }}
                _placeholder={{ color: placeholderColor }}
                size="lg"
                borderRadius="lg"
              />
            </Box>
            <Button
              colorPalette="green"
              width="100%"
              onClick={() => handleLogin("email_passwordless", email)}
              loading={isButtonLoading("email_passwordless")}
              disabled={aaLoading || !email}
              size="lg"
              borderRadius="xl"
              _hover={{ bg:"green.700", transform: 'scale(1.02)'}}
              _active={{ bg:"green.800", transform: 'scale(0.98)'}}
            >
               {isButtonLoading("email_passwordless") ? <Spinner size="sm" color="white"/> : <Text>Continue with Email</Text>}
            </Button>
            <Text
              fontSize="sm"
              color={secondaryTextColor}
              cursor="pointer"
              textAlign="center"
              onClick={() => setIsEmailLoginMode(false)}
              _hover={{ color: accentColorGreen }}
            >
              Or use Google login
            </Text>
          </VStack>
        ) : (
          <VStack gap={3}>
            <Button
              variant="outline"
              width="100%"
              onClick={() => handleLogin("google")}
              loading={isButtonLoading("google")}
              disabled={aaLoading}
              borderColor={inputBorderColor}
              color={primaryTextColor}
              _hover={{ bg: "yellow.100" , transform: 'scale(1.02)'}}
              _active={{ transform: 'scale(0.98)'}}
              size="lg"
              borderRadius="xl"
            >
              <HStack gap={3} justifyContent="center">
                <Icon as={FaGoogle} color="red.500"/>
                <Text color="currentColor"> 
                  Continue with Google
                </Text>
              </HStack>
            </Button>
            
            <HStack width="100%" alignItems="center" my={2} gap={2}>
              <Box flex="1" height="1px" bg={borderColor} />
              <Text fontSize="sm" color={placeholderColor} px={2}>
                or
              </Text>
              <Box flex="1" height="1px" bg={borderColor} />
            </HStack>
            
            <Button
              variant="outline"
              width="100%"
              onClick={() => setIsEmailLoginMode(true)}
              disabled={aaLoading}
              borderColor={inputBorderColor}
              color={primaryTextColor}
              _hover={{ bg: "yellow.100", transform: 'scale(1.02)'}}
              _active={{ transform: 'scale(0.98)'}}
              size="lg"
              borderRadius="xl"
            >
              <HStack gap={3} justifyContent="center">
                <Icon as={FaEnvelope} color={secondaryTextColor}/>
                <Text color="currentColor"> 
                  Continue with Email
                </Text>
              </HStack>
            </Button>
          </VStack>
        )}
        
        {aaLoading && currentLoginProvider && (
             <HStack justifyContent="center" alignItems="center" mt={2} gap={2}>
                <Spinner size="sm" color={accentColorGreen} />
                <Text fontSize="sm" color={secondaryTextColor} ml={2}>Processing {currentLoginProvider.replace("_", " ")}...</Text>
            </HStack>
        )}

        <Text fontSize="xs" color={placeholderColor} textAlign="center" mt={3}>
          By continuing, you agree to our Terms of Service.
        </Text>
      </VStack>
    </Box>
  );
};

export default SocialLogin;