import React, { useEffect } from 'react';
import {
  Box,
  Text,
  Spinner,
  Icon,
  VStack
} from "@chakra-ui/react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { usePaymaster, PaymasterType, SupportedToken } from '@/context/PaymasterContext';
import { ethers } from 'ethers';
import { MdWarning } from 'react-icons/md';

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
  const selectBorderColor = "gray.800"; 
  const accentColor = "green.600";

  useEffect(() => {
    if (typeof fetchSupportedTokens === "function" && !isLoadingTokens) {
    }
  }, [fetchSupportedTokens, isLoadingTokens]);


  const paymasterTypeOptions = [
    { label: 'Native Token (NERO)', value: PaymasterType.NATIVE },
    ...(isFreeGasAvailable
      ? [{ label: 'Sponsored Gas (Free)', value: PaymasterType.FREE_GAS }]
      : []),
    { label: 'ERC20 Token', value: PaymasterType.TOKEN },
  ];

  const erc20Tokens = supportedTokens.filter(
    (t: SupportedToken) => t.address && t.address !== ethers.constants.AddressZero && (t.type === 1 || t.type === 2)
  );

  return (
    <Box p={5} bg="white" color={primaryTextColor} borderRadius="xl">
      <VStack gap={4} align="stretch">
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
          <Text mb={2} fontWeight="medium" color={secondaryTextColor}>Paymaster Type</Text>
          <select
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: '0.75rem',
              background: selectBg,
              color: primaryTextColor,
              border: `3px solid ${selectBorderColor}`,
              boxShadow: "sm"
            }}
            disabled={isLoadingTokens || paymasterContextLoading}
            value={selectedPaymasterType ?? ''}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                if (setSelectedPaymasterType) {
                    setSelectedPaymasterType(e.target.value as PaymasterType);
                }
            }}
          >
            <option value="" disabled>
              Select paymaster type
            </option>
            {paymasterTypeOptions.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Box>

        {selectedPaymasterType === PaymasterType.TOKEN && (
          <Box>
            <Text mb={2} fontWeight="medium" color={secondaryTextColor}>Select ERC20 Token for Gas</Text>
            {isLoadingTokens ? (
              <Spinner color={accentColor} />
            ) : erc20Tokens.length > 0 ? (
              <select
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '0.75rem',
                  background: selectBg,
                  color: primaryTextColor,
                  border: `3px solid ${selectBorderColor}`,
                  boxShadow: "sm"
                }}
                value={selectedToken?.address ?? ''}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                  const addr = e.target.value;
                  const token = supportedTokens.find((t: SupportedToken) => t.address === addr) || null;
                  if (setSelectedToken) {
                    setSelectedToken(token);
                  }
                }}
              >
                <option value="" disabled>
                  Select ERC20 token
                </option>
                {erc20Tokens.map((t: SupportedToken) => (
                  <option key={t.address} value={t.address}>
                    {t.symbol}
                  </option>
                ))}
              </select>
            ) : (
              <Text color={secondaryTextColor}>No ERC20 tokens available for Paymaster.</Text>
            )}
          </Box>
        )}

        <Button
          onClick={() => {
              if (fetchSupportedTokens) {
                  fetchSupportedTokens();
              }
          }}
          loading={isLoadingTokens}
          size="md"
          variant="outline"
          borderRadius="lg"
          color="green.700"
          borderColor="green.300"
          _hover={{bg: "green.50", transform: 'scale(1.02)'}}
          _active={{transform: 'scale(0.98)', bg: "green.100"}}
        >
          Refresh Token List
        </Button>
      </VStack>
    </Box>
  );
};

export default PaymasterSettings;