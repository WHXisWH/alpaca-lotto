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

  const cardBg = "white";
  const cardHoverBg = "yellow.50";
  const borderColor = "gray.200";
  const headingColor = "yellow.900";
  const textColor = "gray.700";
  let iconColor = `${colorScheme}.600`;
  if (colorScheme === "yellow") iconColor = "orange.500";


  return (
    <Box
      bg={cardBg}
      _hover={{
        bg: cardHoverBg,
        shadow: "lg",
        transform: "translateY(-2px) scale(1.02)",
        borderColor: `${colorScheme}.300`
      }}
      cursor="pointer"
      borderRadius="2xl"
      p={{ base: 5, md: 6 }}
      onClick={onClick}
      borderWidth="1px"
      borderColor={borderColor}
      display="flex"
      flexDirection="column"
      justifyContent="space-between"
      minHeight={{ base: "auto", md: "260px" }}
      transition="all 0.2s ease-out"
      width="100%"
      shadow="sm"
    >
      <VStack align="start" gap={3} flexGrow={1}>
        <HStack gap={3}>
          <Icon
            as={icon}
            w={{ base: 7, md: 8 }}
            h={{ base: 7, md: 8 }}
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
        colorPalette={colorScheme === "orange" ? "orange" : "green"}
        variant="solid"
        width="100%"
        mt={4}
        loading={btnLoading}
        disabled={btnDisabled || btnLoading}
        size="lg"
        borderRadius="xl"
        _hover={{ transform: 'scale(1.02)', bg: colorScheme === "orange" ? "orange.600" : "green.700" }}
        _active={{ transform: 'scale(0.98)', bg: colorScheme === "orange" ? "orange.700" : "green.800" }}
      >
        {btnText}
      </Button>
    </Box>
  );
}