import React, { useState } from 'react';
import {
  Dialog,
  DialogBackdrop,
  DialogPositioner,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogCloseTrigger,
  Input,
  VStack,
  Text,
  Field,
  Icon,
  HStack,
  Portal,
} from '@chakra-ui/react';
import { Button } from '@/components/ui/button';
import { CloseButton as UICloseButton } from '@/components/ui/close-button';
import { toaster } from '@/components/ui/toaster';
import { ethers } from 'ethers';
import { useAAWallet } from '@/context/AAWalletContext';
import { FaInfoCircle } from 'react-icons/fa';
import { Tooltip } from "@/components/ui/tooltip";

interface ReferralDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReferralDialog: React.FC<ReferralDialogProps> = ({ isOpen, onClose }) => {
  const { aaWalletAddress, isAAWalletInitialized } = useAAWallet();
  const [referrerAddress, setReferrerAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const primaryTextColor = "yellow.900";
  const secondaryTextColor = "gray.700";
  const accentColor = "green.600";
  const dialogBg = "yellow.50";
  const inputBg = "white";
  const inputBorder = "gray.300";
  const inputHoverBorder = "yellow.400";
  const inputFocusBorder = "green.500";
  const placeholderColor = "gray.500";
  const borderColor = "gray.200";
  const buttonHoverBg = "yellow.100";

  const handleSubmitReferral = async () => {
    if (!isAAWalletInitialized || !aaWalletAddress) {
      toaster.create({ title: "Error", description: "Please connect and initialize your wallet first.", type: "error" });
      return;
    }
    if (!referrerAddress || !ethers.utils.isAddress(referrerAddress)) {
      toaster.create({ title: "Invalid Address", description: "Please enter a valid referrer Ethereum address.", type: "error" });
      return;
    }
    if (referrerAddress.toLowerCase() === aaWalletAddress.toLowerCase()) {
      toaster.create({ title: "Invalid Referrer", description: "You cannot refer yourself.", type: "error" });
      return;
    }

    setIsLoading(true);
    try {
      const backendApiUrl = import.meta.env.VITE_BACKEND_API_URL;
      if (!backendApiUrl) {
        toaster.create({ title: "Configuration Error", description: "Backend API URL is not configured.", type: "error" });
        setIsLoading(false);
        return;
      }

      const response = await fetch(`${backendApiUrl}/api/referral`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentUserAA: aaWalletAddress,
          referrerAA: referrerAddress,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toaster.create({
          title: "Referral Submitted!",
          description: data.message || "Your referral has been submitted successfully.",
          type: "success"
        });
        setReferrerAddress('');
        onClose();
      } else {
        toaster.create({
          title: "Submission Failed",
          description: data.message || "Failed to submit referral. Please try again.",
          type: "error"
        });
      }
    } catch (error) {
      console.error("Referral submission error:", error);
      toaster.create({
          title: "Submission Error",
          description: "An unexpected error occurred while submitting your referral. Check console for details.",
          type: "error"
      });
    } finally {
      setIsLoading(false);
    }
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
            width={{ base: "95%", md: "md" }}
            shadow="2xl"
          >
            <DialogHeader borderBottomWidth="1px" borderColor={borderColor} color={accentColor} fontWeight="bold">
              Enter Referrer Address
            </DialogHeader>
            <DialogCloseTrigger asChild>
                <UICloseButton position="absolute" top="12px" right="12px" _hover={{ bg: buttonHoverBg }} borderRadius="md"/>
            </DialogCloseTrigger>
            <DialogBody py={6}>
              <VStack gap={4}>
                <Text fontSize="sm" color={secondaryTextColor}>
                  If someone referred you to Alpaca Lotto, enter their Ethereum address below to give them credit and potentially earn rewards yourself!
                </Text>
                <Field.Root id="referrer-address-dialog" width="100%">
                  <HStack mb={1} align="center">
                    <Field.Label htmlFor="referrer-input-dialog" color={secondaryTextColor} fontSize="sm">
                      Referrer's Address
                    </Field.Label>
                    <Tooltip content="Make sure this is the correct Ethereum address of the person who referred you." positioning={{ placement: "top" }} showArrow>
                        <Icon as={FaInfoCircle} color={secondaryTextColor} cursor="help" />
                    </Tooltip>
                  </HStack>
                  <Input
                    id="referrer-input-dialog"
                    placeholder="0x123..."
                    value={referrerAddress}
                    onChange={(e) => setReferrerAddress(e.target.value)}
                    bg={inputBg}
                    borderColor={inputBorder}
                    _hover={{ borderColor: inputHoverBorder }}
                    _focus={{ borderColor: inputFocusBorder, boxShadow: `0 0 0 1px ${inputFocusBorder}`}}
                    _placeholder={{ color: placeholderColor }}
                    borderRadius="lg"
                  />
                </Field.Root>
              </VStack>
            </DialogBody>
            <DialogFooter borderTopWidth="1px" borderColor={borderColor}>
              <Button variant="ghost" onClick={onClose} mr={3} _hover={{ bg: buttonHoverBg }} borderRadius="lg">
                Cancel
              </Button>
              <Button
                colorPalette="green"
                bg="green.600"
                color="white"
                _hover={{bg:"green.700"}}
                _active={{bg:"green.800"}}
                onClick={handleSubmitReferral}
                loading={isLoading}
                disabled={!ethers.utils.isAddress(referrerAddress) || isLoading}
                borderRadius="lg"
              >
                Submit Referral
              </Button>
            </DialogFooter>
          </DialogContent>
        </DialogPositioner>
      </Portal>
    </Dialog.Root>
  );
};