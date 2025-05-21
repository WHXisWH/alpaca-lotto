import React from "react";
import {
  Box,           
  HStack,
  Icon,
  Heading,
  Text,
  VStack,
} from "@chakra-ui/react";
import { Button } from "@/components/ui/button";
import { useColorModeValue } from "@/components/ui/color-mode";

interface LoginMethodCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
  btnText: string;
  onClick: () => void;
  colorScheme?: string;
  btnLoading?: boolean;
  btnDisabled?: boolean;
}

export function LoginMethodCard({
  icon,
  title,
  description,
  btnText,
  onClick,
  colorScheme = "green",
  btnLoading = false,
  btnDisabled = false,
}: LoginMethodCardProps) {

  const cardBg = useColorModeValue(
    `${colorScheme}.100`,
    `${colorScheme}.800`
  );
  const cardHoverBg = useColorModeValue(
    `${colorScheme}.200`,
    `${colorScheme}.700`
  );
  const borderColor = useColorModeValue(
    `${colorScheme}.200`,
    `${colorScheme}.700`
  );
  const headingColor = useColorModeValue(
    "gray.800",        
    "whiteAlpha.900"
  );
  const textColor = useColorModeValue(
    "gray.600", 
    "gray.300"
  );
  const iconColor = useColorModeValue(
    `${colorScheme}.500`,
    `${colorScheme}.300`
  );

  return (
    <Box
      bg={cardBg}
      _hover={{
        bg: cardHoverBg,
        shadow: "2xl",
        transform: "translateY(-2px)",
      }}
      cursor="pointer"
      borderRadius="xl"
      p={{ base: 4, md: 6 }}
      onClick={onClick}
      borderWidth="1px"
      borderColor={borderColor}
      display="flex"
      flexDirection="column"
      justifyContent="space-between"
      minHeight={{ base: "auto", md: "240px" }}
      transition="all 0.2s ease-out"
      width="100%"
    >
      <VStack align="start" gap={3} flexGrow={1}>
        <HStack gap={3}>
          <Icon
            as={icon}
            w={{ base: 6, md: 7 }}
            h={{ base: 6, md: 7 }}
            color={iconColor}
          />
          <Heading size="md" color={headingColor}>
            {title}
          </Heading>
        </HStack>
        <Text fontSize="sm" color={textColor} lineHeight="tall">
          {description}
        </Text>
      </VStack>
      <Button
        colorPalette={colorScheme}
        variant="solid"
        width="100%"
        mt={4}
        loading={btnLoading}
        disabled={btnDisabled || btnLoading}
      >
        {btnText}
      </Button>
    </Box>
  );
}
