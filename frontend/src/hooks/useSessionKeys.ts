import { useState, useCallback, useEffect } from 'react';
import { useAccount, useSignMessage, useWalletClient } from 'wagmi';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import useUserOp from './useUserOp';
import useWagmiWallet from './useWagmiWallet';

/**
 * Interface for session key details
 */
interface SessionKeyDetails {
  address: string;
  privateKey: string;
  expiresAt: number;
  createdAt: number;
  validUntil: number;
  operationsHash?: string;
}

/**
 * Hook return interface
 */
interface UseSessionKeysReturn {
  hasActiveSessionKey: boolean;
  sessionKeyDetails: SessionKeyDetails | null;
  isLoading: boolean;
  error: string | null;
  createSessionKey: (duration: number) => Promise<boolean>;
  revokeSessionKey: () => Promise<boolean>;
  getTimeRemaining: () => number;
  isExpiringWithin: (withinSeconds: number) => boolean;
  getSessionKeySignature: (message: string) => Promise<string>;
}

/**
 * Session key management hook
 * Enhanced with NERO Chain's AA implementation
 */
export const useSessionKeys = (): UseSessionKeysReturn => {
  // Use wagmi hooks
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { signMessageAsync } = useSignMessage();
  
  // Use our custom hooks
  const { isDevelopmentMode } = useWagmiWallet();
  const { createSessionKey: createSessionKeyOp, revokeSessionKey: revokeSessionKeyOp } = useUserOp();
  
  // State
  const [hasActiveSessionKey, setHasActiveSessionKey] = useState<boolean>(false);
  const [sessionKeyDetails, setSessionKeyDetails] = useState<SessionKeyDetails | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  /**
   * Generate a new session key
   * @returns {Object} - Session key with address and private key
   */
  const generateSessionKey = useCallback(() => {
    // Generate a random private key
    const privateKey = generatePrivateKey();
    
    // Convert private key to account
    const account = privateKeyToAccount(privateKey);
    
    return {
      address: account.address,
      privateKey: privateKey
    };
  }, []);
  
  /**
   * Load session key from storage
   * @returns {SessionKeyDetails | null} - Stored session key details
   */
  const loadSessionKeyFromStorage = useCallback((): SessionKeyDetails | null => {
    if (!address && !isDevelopmentMode) return null;
    
    try {
      // Storage key is based on connected address or "dev" for development mode
      const storageKey = `alpaca_session_key_${address?.toLowerCase() || 'dev'}`;
      const storedData = localStorage.getItem(storageKey);
      
      if (!storedData) return null;
      
      const sessionData = JSON.parse(storedData) as SessionKeyDetails;
      
      // Check if session key is still valid
      if (sessionData.expiresAt && sessionData.expiresAt > Date.now() / 1000) {
        setHasActiveSessionKey(true);
        setSessionKeyDetails(sessionData);
        return sessionData;
      } else {
        // Remove expired session key
        localStorage.removeItem(storageKey);
        setHasActiveSessionKey(false);
        setSessionKeyDetails(null);
        return null;
      }
    } catch (err) {
      console.error('Session key loading error:', err);
      setHasActiveSessionKey(false);
      setSessionKeyDetails(null);
      return null;
    }
  }, [address, isDevelopmentMode]);
  
  /**
   * Save session key to storage
   * @param {SessionKeyDetails} sessionData - Session key details
   */
  const saveSessionKeyToStorage = useCallback((sessionData: SessionKeyDetails): void => {
    if (!address && !isDevelopmentMode) return;
    
    try {
      const storageKey = `alpaca_session_key_${address?.toLowerCase() || 'dev'}`;
      localStorage.setItem(storageKey, JSON.stringify(sessionData));
    } catch (err) {
      console.error('Session key storage error:', err);
    }
  }, [address, isDevelopmentMode]);
  
  /**
   * Create a new session key
   * @param {number} duration - Duration in seconds
   * @returns {Promise<boolean>} - Success status
   */
  const createSessionKey = useCallback(async (duration: number): Promise<boolean> => {
    if (!isConnected && !isDevelopmentMode) {
      throw new Error('Wallet not connected');
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Generate new session key
      const newSessionKey = generateSessionKey();
      
      // Current time
      const currentTime = Math.floor(Date.now() / 1000);
      const expiresAt = currentTime + duration;
      
      // Create session key parameters
      const sessionParams = {
        duration: duration,
        paymentType: 0, // Use sponsored gas for better UX
      };
      
      // In development mode, skip the on-chain operation
      if (isDevelopmentMode) {
        console.log('Creating session key in development mode');
        
        // Create session data
        const sessionData: SessionKeyDetails = {
          ...newSessionKey,
          expiresAt: expiresAt,
          createdAt: currentTime,
          validUntil: expiresAt
        };
        
        // Update state and storage
        setSessionKeyDetails(sessionData);
        setHasActiveSessionKey(true);
        saveSessionKeyToStorage(sessionData);
        
        setIsLoading(false);
        return true;
      }
      
      // Execute session key creation transaction using Account Abstraction
      try {
        // Call the UserOp hook to create session key
        const sessionKeyAddress = await createSessionKeyOp(sessionParams);
        
        // If successful, save the session key
        const sessionData: SessionKeyDetails = {
          address: sessionKeyAddress,
          privateKey: newSessionKey.privateKey,
          expiresAt: expiresAt,
          createdAt: currentTime,
          validUntil: expiresAt
        };
        
        // Update state and storage
        setSessionKeyDetails(sessionData);
        setHasActiveSessionKey(true);
        saveSessionKeyToStorage(sessionData);
        
        setIsLoading(false);
        return true;
      } catch (err: any) {
        console.error('Error creating session key via UserOp:', err);
        throw err;
      }
    } catch (err: any) {
      console.error('Session key creation error:', err);
      setError(err.message || 'Session key creation error');
      setIsLoading(false);
      return false;
    }
  }, [
    isConnected, 
    isDevelopmentMode, 
    generateSessionKey, 
    saveSessionKeyToStorage, 
    createSessionKeyOp
  ]);
  
  /**
   * Revoke current session key
   * @returns {Promise<boolean>} - Success status
   */
  const revokeSessionKey = useCallback(async (): Promise<boolean> => {
    if (!isConnected && !isDevelopmentMode) {
      throw new Error('Wallet not connected');
    }
    
    if (!sessionKeyDetails) {
      throw new Error('No active session key');
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // In development mode, skip the on-chain operation
      if (isDevelopmentMode) {
        console.log('Revoking session key in development mode');
        
        // Clear session key data
        const storageKey = `alpaca_session_key_${address?.toLowerCase() || 'dev'}`;
        localStorage.removeItem(storageKey);
        
        setSessionKeyDetails(null);
        setHasActiveSessionKey(false);
        
        setIsLoading(false);
        return true;
      }
      
      // Execute session key revocation transaction using Account Abstraction
      try {
        // Call the UserOp hook to revoke session key
        await revokeSessionKeyOp(sessionKeyDetails.address);
        
        // Clear session key data
        const storageKey = `alpaca_session_key_${address?.toLowerCase()}`;
        localStorage.removeItem(storageKey);
        
        setSessionKeyDetails(null);
        setHasActiveSessionKey(false);
        
        setIsLoading(false);
        return true;
      } catch (err: any) {
        console.error('Error revoking session key via UserOp:', err);
        throw err;
      }
    } catch (err: any) {
      console.error('Session key revocation error:', err);
      setError(err.message || 'Session key revocation error');
      setIsLoading(false);
      return false;
    }
  }, [
    address, 
    isConnected, 
    isDevelopmentMode, 
    sessionKeyDetails, 
    revokeSessionKeyOp
  ]);
  
  /**
   * Get remaining time for session key in seconds
   * @returns {number} - Remaining time in seconds
   */
  const getTimeRemaining = useCallback((): number => {
    if (!hasActiveSessionKey || !sessionKeyDetails) {
      return 0;
    }
    
    const currentTime = Math.floor(Date.now() / 1000);
    const remaining = sessionKeyDetails.expiresAt - currentTime;
    
    return Math.max(0, remaining);
  }, [hasActiveSessionKey, sessionKeyDetails]);
  
  /**
   * Check if session key is expiring within a certain time
   * @param {number} withinSeconds - Time period to check
   * @returns {boolean} - Whether session key is expiring within the specified time
   */
  const isExpiringWithin = useCallback((withinSeconds: number): boolean => {
    const remaining = getTimeRemaining();
    return remaining > 0 && remaining <= withinSeconds;
  }, [getTimeRemaining]);
  
  /**
   * Get signature using session key
   * @param {string} message - Message to sign
   * @returns {Promise<string>} - Signature
   */
  const getSessionKeySignature = useCallback(async (message: string): Promise<string> => {
    if (!hasActiveSessionKey || !sessionKeyDetails) {
      throw new Error('No active session key');
    }
    
    try {
      // In development mode, return mock signature
      if (isDevelopmentMode) {
        return '0x' + [...Array(130)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
      }
      
      // Create account from private key
      const account = privateKeyToAccount(sessionKeyDetails.privateKey as `0x${string}`);
      
      // Sign message
      const signature = await account.signMessage({ message });
      
      return signature;
    } catch (err: any) {
      console.error('Session key signing error:', err);
      throw new Error('Failed to sign with session key: ' + err.message);
    }
  }, [hasActiveSessionKey, sessionKeyDetails, isDevelopmentMode]);
  
  // Load session key on mount and account change
  useEffect(() => {
    loadSessionKeyFromStorage();
  }, [address, loadSessionKeyFromStorage]);
  
  // Check session key expiration every minute
  useEffect(() => {
    if (!hasActiveSessionKey) return;
    
    const checkInterval = setInterval(() => {
      const remaining = getTimeRemaining();
      
      if (remaining <= 0) {
        // Clear session key data when expired
        const storageKey = `alpaca_session_key_${address?.toLowerCase() || 'dev'}`;
        localStorage.removeItem(storageKey);
        
        setSessionKeyDetails(null);
        setHasActiveSessionKey(false);
      }
    }, 60 * 1000); // Every minute
    
    return () => clearInterval(checkInterval);
  }, [address, hasActiveSessionKey, getTimeRemaining]);
  
  return {
    hasActiveSessionKey,
    sessionKeyDetails,
    isLoading,
    error,
    createSessionKey,
    revokeSessionKey,
    getTimeRemaining,
    isExpiringWithin,
    getSessionKeySignature
  };
};

export default useSessionKeys;