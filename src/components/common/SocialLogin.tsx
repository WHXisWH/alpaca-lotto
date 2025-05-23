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
      borderRadius="lg"
      shadow="md"
      bg="gray.700" 
      color="white"
      width="100%"
      maxWidth="400px"
      mx="auto"
      borderColor="gray.600"
    >
      <VStack gap={4} align="stretch">
        <Text fontSize="xl" fontWeight="bold" textAlign="center" color="whiteAlpha.900">
          {isEmailLoginMode ? "Continue with Email" : "Join with Social Account"}
        </Text>
        
        {isEmailLoginMode ? (
          <VStack gap={3}>
            <Box width="100%">
              <Text mb={1} fontSize="sm" color="whiteAlpha.800">Email Address</Text>
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={handleEmailChange}
                bg="gray.600" 
                color="whiteAlpha.900"
                borderColor="gray.500" 
                _hover={{ borderColor: "gray.400" }}
                _focus={{ borderColor: "teal.300", boxShadow: "0 0 0 1px teal.300" }}
                _placeholder={{ color: "gray.400" }}
              />
            </Box>
            <Button
              colorPalette="green"
              width="100%"
              onClick={() => handleLogin("email_passwordless", email)}
              loading={isButtonLoading("email_passwordless")}
              disabled={aaLoading || !email}
            >
               {isButtonLoading("email_passwordless") ? <Spinner size="sm" borderWidth="2px" animationDuration="0.45s"/> : <Text color="white">Continue with Email</Text>}
            </Button>
            <Text
              fontSize="sm"
              color="gray.400"
              cursor="pointer"
              textAlign="center"
              onClick={() => setIsEmailLoginMode(false)}
              _hover={{ color: "teal.300" }}
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
              borderColor="gray.500"
              color="whiteAlpha.900"
              _hover={{ bg: "red.600", color: "white", borderColor: "red.700" }}
            >
              <HStack gap={2} justifyContent="center">
                <Icon as={FaGoogle} color={isButtonLoading("google") ? "gray.400" : "red.400"} _groupHover={{color: "white"}}/>
                <Text color="currentColor"> 
                  Continue with Google
                </Text>
              </HStack>
            </Button>
            
            <HStack width="100%" alignItems="center" my={2} gap={0}>
              <Box flex="1" height="1px" bg="gray.600" />
              <Text fontSize="sm" color="gray.400" px={2}>
                or
              </Text>
              <Box flex="1" height="1px" bg="gray.600" />
            </HStack>
            
            <Button
              variant="outline"
              width="100%"
              onClick={() => setIsEmailLoginMode(true)}
              disabled={aaLoading}
              borderColor="gray.500"
              color="whiteAlpha.900"
              _hover={{ bg: "gray.600", borderColor: "gray.500" }}
            >
              <HStack gap={2} justifyContent="center">
                <Icon as={FaEnvelope} color="gray.400" _groupHover={{color: "whiteAlpha.800"}}/>
                <Text color="currentColor"> 
                  Continue with Email
                </Text>
              </HStack>
            </Button>
          </VStack>
        )}
        
        {aaLoading && currentLoginProvider && (
             <HStack justifyContent="center" alignItems="center" mt={2} gap={2}>
                <Spinner size="sm" color="teal.300" borderWidth="2px" animationDuration="0.45s"/>
                <Text fontSize="sm" color="gray.300" ml={2}>Processing {currentLoginProvider.replace("_", " ")}...</Text>
            </HStack>
        )}

        <Text fontSize="xs" color="gray.500" textAlign="center" mt={3}>
          By continuing, you agree to our Terms of Service.
        </Text>
      </VStack>
    </Box>
  );
};

export default SocialLogin;