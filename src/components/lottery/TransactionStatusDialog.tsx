import React from 'react';
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
  Icon,
  Link,
  Code,
  Box,
  Portal,
  Heading,
} from '@chakra-ui/react';
import { Button } from '@/components/ui/button';
import { CloseButton as UICloseButton } from '@/components/ui/close-button';
import { LoadingAlpaca } from '../common';
import { FaCheckCircle, FaTimesCircle, FaHourglassHalf } from 'react-icons/fa';

interface TransactionState {
  loading: boolean;
  error: string | null;
  successMessage: string | null;
  hash: string | null;
  step: "idle" | "approving" | "purchasing" | "claiming" | "fetchingReceipt" | "dailyCheckIn";
}

interface TransactionStatusDialogProps {
  isOpen: boolean;
  onClose: () => void;
  transactionState: TransactionState;
}

export const TransactionStatusDialog: React.FC<TransactionStatusDialogProps> = ({
  isOpen,
  onClose,
  transactionState,
}) => {
  const { loading, error, successMessage, hash, step } = transactionState;

  const accentColor = "green.600";
  const errorColor = "red.600";
  const infoColor = "blue.600";
  const dialogBg = "yellow.50";
  const borderColor = "gray.200";
  const buttonHoverBg = "yellow.100";
  const primaryTextColor = "yellow.900";
  const secondaryTextColor = "gray.700";

  const renderContent = () => {
    if (error) {
      return (
        <VStack gap={4} textAlign="center">
          <Icon as={FaTimesCircle} boxSize={12} color={errorColor} />
          <Heading size="md" color={errorColor}>
            Transaction Failed
          </Heading>
          <Text fontSize="sm" color={secondaryTextColor} wordBreak="break-word">
            {error}
          </Text>
          {hash && (
            <Text fontSize="xs" color={secondaryTextColor}>
              UserOp Hash: <Code fontSize="xs">{hash.substring(0, 10)}...</Code>
            </Text>
          )}
        </VStack>
      );
    }

    if (loading) {
      let statusText = "Processing transaction...";
      if (step === 'approving') statusText = 'Requesting token approval...';
      if (step === 'purchasing') statusText = 'Purchasing your tickets...';
      if (step === 'claiming') statusText = 'Claiming your prize...';
      if (step === 'dailyCheckIn') statusText = 'Processing daily check-in...';
      if (step === 'fetchingReceipt') statusText = 'Confirming transaction on-chain...';

      return (
        <VStack gap={4} textAlign="center">
          <LoadingAlpaca size="80px" />
          <Heading size="md" color={primaryTextColor}>
            In Progress
          </Heading>
          <Text color={secondaryTextColor}>{statusText}</Text>
          {hash && (
            <Text fontSize="xs" color={secondaryTextColor}>
              UserOp Hash: <Code fontSize="xs">{hash.substring(0, 10)}...</Code>
            </Text>
          )}
        </VStack>
      );
    }

    if (successMessage) {
      return (
        <VStack gap={4} textAlign="center">
          <Icon as={FaCheckCircle} boxSize={12} color={accentColor} />
          <Heading size="md" color={accentColor}>
            Success!
          </Heading>
          <Text color={secondaryTextColor} wordBreak="break-word">
            {successMessage}
          </Text>
        </VStack>
      );
    }

    return (
        <VStack gap={4} textAlign="center">
          <Icon as={FaHourglassHalf} boxSize={12} color={infoColor} />
          <Heading size="md" color={primaryTextColor}>
            Ready
          </Heading>
          <Text color={secondaryTextColor}>
            The transaction dialog is ready.
          </Text>
        </VStack>
    );
  };

  if (!isOpen) {
    return null;
  }

  return (
    <Dialog.Root
        open={isOpen}
        onOpenChange={(detail) => {
          if (!detail.open) onClose();
        }}
        modal
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
            width={{ base: '95%', md: 'md' }}
            shadow="2xl"
          >
            <DialogHeader borderBottomWidth="1px" borderColor={borderColor} color={primaryTextColor} fontWeight="bold">
              Transaction Status
            </DialogHeader>
            <DialogCloseTrigger asChild>
                <UICloseButton position="absolute" top="12px" right="12px" _hover={{ bg: buttonHoverBg }} borderRadius="md"/>
            </DialogCloseTrigger>
            <DialogBody py={8} minH="200px" display="flex" alignItems="center" justifyContent="center">
              {renderContent()}
            </DialogBody>
            <DialogFooter borderTopWidth="1px" borderColor={borderColor}>
              <Button
                colorPalette="green"
                onClick={onClose}
                borderRadius="lg"
                bg="green.600"
                color="white"
                _hover={{bg:"green.700"}}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </DialogPositioner>
      </Portal>
    </Dialog.Root>
  );
};