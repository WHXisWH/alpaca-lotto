import React, { useEffect } from 'react';
import {
  Box,
  Text,
  Spinner,
  Icon,
} from "@chakra-ui/react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { usePaymaster, PaymasterType, SupportedToken } from '@/context/PaymasterContext'; // Added SupportedToken
import { ethers } from 'ethers';
import { MdWarning } from 'react-icons/md';

export const PaymasterSettings: React.FC = () => {
  const {
    selectedPaymasterType,
    setSelectedPaymasterType,
    supportedTokens,
    selectedToken,
    setSelectedToken,
    loading: paymasterContextLoading, // Renamed to avoid conflict if any local loading state
    error: paymasterError,
    isFreeGasAvailable,
    fetchSupportedTokens, // Added to dependencies of useEffect if used
    isLoadingTokens, // Added
  } = usePaymaster();

  useEffect(() => {
    if (typeof fetchSupportedTokens === "function" && !isLoadingTokens) { // Ensure fetchSupportedTokens is callable and not already loading
        // Optionally call fetchSupportedTokens here if needed on component mount or when certain conditions change
        // For now, assuming it's called appropriately elsewhere (e.g., in App.tsx or PaymasterContext itself)
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
    (t: SupportedToken) => t.address && t.address !== ethers.constants.AddressZero && (t.type === 1 || t.type === 2) // Added type check for paymaster usage
  );

  return (
    <Box p={5} shadow="md" borderWidth="1px" borderRadius="lg" bg="gray.700" color="white">
      <Box display="flex" flexDirection="column" gap={4}>
        <Text fontSize="xl" fontWeight="bold" color="teal.300">
          Gas Payment Options
        </Text>

        {paymasterError && (
          <Alert
            status="error"
            icon={<Icon as={MdWarning} boxSize={5} color="red.400" />}
          >
            {paymasterError}
          </Alert>
        )}

        <Box>
          <Text mb={2}>Paymaster Type</Text>
          <select
            style={{
              width: '100%',
              padding: '0.5rem',
              borderRadius: '4px',
              background: '#2D3748', // Example dark theme background
              color: 'white',
              border: '1px solid #4A5568', // Example dark theme border
            }}
            disabled={isLoadingTokens || paymasterContextLoading}
            value={selectedPaymasterType ?? ''} // Handle null/undefined selectedPaymasterType
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
            <Text mb={2}>Select ERC20 Token for Gas</Text>
            {isLoadingTokens ? (
              <Spinner />
            ) : erc20Tokens.length > 0 ? (
              <select
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: '4px',
                  background: '#2D3748',
                  color: 'white',
                  border: '1px solid #4A5568',
                }}
                value={selectedToken?.address ?? ''} // Handle null/undefined selectedToken
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
                {erc20Tokens.map((t: SupportedToken) => ( // Explicitly type 't'
                  <option key={t.address} value={t.address}>
                    {t.symbol}
                  </option>
                ))}
              </select>
            ) : (
              <Text>No ERC20 tokens available for Paymaster.</Text>
            )}
          </Box>
        )}

        <Button
          onClick={() => {
              if (fetchSupportedTokens) {
                  fetchSupportedTokens();
              }
          }}
          loading={isLoadingTokens} // Use isLoadingTokens for button loading state
          size="sm"
          colorScheme="teal"
        >
          Refresh Token List
        </Button>
      </Box>
    </Box>
  );
};

export default PaymasterSettings;