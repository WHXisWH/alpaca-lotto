import React from "react";
import {
  chakra,
  Box,
  Text,
  Spinner,
  Icon,
  VStack,
} from "@chakra-ui/react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { usePaymaster, PaymasterType, SupportedToken } from "@/context/PaymasterContext";
import { ethers } from "ethers";
import { MdWarning } from "react-icons/md";

const ChakraSelect = chakra("select");

export const PaymasterSettings: React.FC = () => {
  const {
    selectedPaymasterType,
    setSelectedPaymasterType,
    supportedTokens,
    selectedToken,
    setSelectedToken,
    loading: paymasterContextLoading,
    error: paymasterError,
    isFreeGasAvailable,
    fetchSupportedTokens,
    isLoadingTokens,
  } = usePaymaster();

  const primaryTextColor = "yellow.900";
  const secondaryTextColor = "gray.700";
  const selectBg = "white";
  const selectBorderColor = "gray.300";
  const accentColor = "green.600";

  const paymasterTypeOptions = [
    { label: "Native Token (NERO)", value: PaymasterType.NATIVE },
    ...(isFreeGasAvailable ? [{ label: "Sponsored Gas (Free)", value: PaymasterType.FREE_GAS }] : []),
    { label: "ERC20 Token", value: PaymasterType.TOKEN },
  ];

  const erc20Tokens = supportedTokens.filter(
    (t: SupportedToken) =>
      t.address && t.address !== ethers.constants.AddressZero && (t.type === 1 || t.type === 2)
  );

  return (
    <Box p={5} bg="white" borderRadius="xl" boxShadow="md" color={primaryTextColor}>
      <VStack gap={6} align="stretch">
        {paymasterError && (
          <Alert
            status="error"
            icon={<Icon as={MdWarning} boxSize={5} color="red.500" />}
            bg="red.50"
            borderColor="red.200"
            color="red.700"
            borderRadius="lg"
          >
            {paymasterError}
          </Alert>
        )}

        <Box>
          <Text mb={2} fontWeight="medium" color={secondaryTextColor}>
            Paymaster Type
          </Text>
          <ChakraSelect
            w="100%"
            textAlign="center" 
            textAlignLast="center"
            value={selectedPaymasterType ?? ""}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
              const v = e.target.value as PaymasterType;
              setSelectedPaymasterType(v);
              if (v !== PaymasterType.TOKEN) {
                setSelectedToken(null);
              }
            }}
            bg={selectBg}
            border="1px solid"
            borderColor={selectBorderColor}
            color={primaryTextColor}
            _focus={{ borderColor: accentColor }}
            borderRadius="lg"
            height="40px"
            px={3}
            disabled={paymasterContextLoading || isLoadingTokens}
          >
            <option value="" disabled>
              Select paymaster type
            </option>
            {paymasterTypeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </ChakraSelect>
        </Box>

        {selectedPaymasterType === PaymasterType.TOKEN && (
          <Box>
            <Text mb={2} fontWeight="medium" color={secondaryTextColor}>
              Select ERC20 Token for Gas
            </Text>
            {isLoadingTokens ? (
              <Spinner color={accentColor} />
            ) : erc20Tokens.length > 0 ? (
              <ChakraSelect
                w="100%"
                textAlign="center" 
                textAlignLast="center"
                value={selectedToken?.address ?? ""}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                  const addr = e.target.value;
                  const token =
                    supportedTokens.find((t: SupportedToken) => t.address === addr) || null;
                  setSelectedToken(token);
                }}
                bg={selectBg}
                border="1px solid"
                borderColor={selectBorderColor}
                color={primaryTextColor}
                _focus={{ borderColor: accentColor }}
                borderRadius="lg"
                height="40px"
                px={3}
                disabled={isLoadingTokens}
              >
                <option value="" disabled>
                  Select ERC20 token
                </option>
                {erc20Tokens.map((t: SupportedToken) => (
                  <option key={t.address} value={t.address}>
                    {t.symbol}
                  </option>
                ))}
              </ChakraSelect>
            ) : (
              <Text color={secondaryTextColor} fontSize="sm">
                No ERC20 tokens available for Paymaster.
              </Text>
            )}
          </Box>
        )}

        <Button
          onClick={() => {
            fetchSupportedTokens?.();
          }}
          loading={isLoadingTokens}
          size="md"
          variant="outline"
          borderRadius="lg"
          color="green.700"
          borderColor="green.300"
          _hover={{ bg: "green.50", transform: "scale(1.02)" }}
          _active={{ transform: "scale(0.98)", bg: "green.100" }}
        >
          Refresh Token List
        </Button>
      </VStack>
    </Box>
  );
};

export default PaymasterSettings;
