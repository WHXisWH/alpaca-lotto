import { useState, useCallback, useEffect } from 'react';
import { useAccount, useSignMessage, useWalletClient } from 'wagmi';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { api } from '../services/api';

/**
 * Session key management hook
 * Enhanced with wagmi hooks and development mode support
 */
export const useSessionKeys = () => {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { signMessageAsync } = useSignMessage();
  
  const [hasActiveSessionKey, setHasActiveSessionKey] = useState(false);
  const [sessionKeyDetails, setSessionKeyDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Check for development mode
  const isDevelopmentMode = useCallback(() => {
    return !isConnected && typeof window !== 'undefined' && (!window.ethereum || !window.ethereum.isMetaMask);
  }, [isConnected]);
  
  // Load session key from storage
  const loadSessionKeyFromStorage = useCallback(() => {
    if (!address && !isDevelopmentMode()) return null;
    
    try {
      const storageKey = `sessionKey_${address?.toLowerCase() || 'dev'}`;
      const storedData = localStorage.getItem(storageKey);
      if (!storedData) return null;
      
      const sessionData = JSON.parse(storedData);
      
      // Check expiration
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
  
  // Save session key to storage
  const saveSessionKeyToStorage = useCallback((sessionData) => {
    if (!address && !isDevelopmentMode()) return;
    
    try {
      const storageKey = `sessionKey_${address?.toLowerCase() || 'dev'}`;
      localStorage.setItem(storageKey, JSON.stringify(sessionData));
    } catch (err) {
      console.error('Session key storage error:', err);
    }
  }, [address, isDevelopmentMode]);
  
  // Generate random session key using viem
  const generateSessionKey = useCallback(() => {
    // Generate a random private key
    const privateKey = generatePrivateKey();
    
    // Convert private key to account
    const account = privateKeyToAccount(privateKey);
    
    return {
      address: account.address,
      privateKey
    };
  }, []);
  
  /**
   * Create a session key
   * @param {number} duration - Duration in seconds
   */
  const createSessionKey = useCallback(async (duration) => {
    if (!isConnected && !isDevelopmentMode()) {
      throw new Error('Wallet not connected');
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Generate random session key
      const newSessionKey = generateSessionKey();
      
      // Create necessary data structure
      const currentTime = Math.floor(Date.now() / 1000);
      const expiresAt = currentTime + duration;
      
      // In development mode, skip the signature and API call
      if (isDevelopmentMode() || !walletClient) {
        console.log('Creating session key in development mode');
        
        // Create session data
        const sessionData = {
          key: newSessionKey,
          expiresAt: expiresAt,
          createdAt: currentTime,
          message: 'Development mode session key',
          signature: '0x0000000000000000000000000000000000000000000000000000000000000000'
        };
        
        // Update state and storage
        setSessionKeyDetails(sessionData);
        setHasActiveSessionKey(true);
        saveSessionKeyToStorage(sessionData);
        
        setIsLoading(false);
        return sessionData;
      }
      
      // In production, create message and sign it using wagmi
      const message = `AlpacaLotto: Activate session key ${newSessionKey.address} until ${expiresAt}.`;
      
      // Sign the message using wagmi's useSignMessage hook
      const signature = await signMessageAsync({ message });
      
      // Call API to register session key
      const response = await api.createSessionKey(duration, signature);
      
      if (response.success) {
        // Create session data
        const sessionData = {
          key: newSessionKey,
          expiresAt: expiresAt,
          createdAt: currentTime,
          message,
          signature
        };
        
        // Update state and storage
        setSessionKeyDetails(sessionData);
        setHasActiveSessionKey(true);
        saveSessionKeyToStorage(sessionData);
        
        setIsLoading(false);
        return sessionData;
      }
      
      throw new Error(response.error || 'Session key creation failed');
    } catch (err) {
      console.error('Session key creation error:', err);
      setError(err.message || 'Session key creation error');
      setIsLoading(false);
      throw err;
    }
  }, [isConnected, isDevelopmentMode, walletClient, generateSessionKey, signMessageAsync, saveSessionKeyToStorage]);
  
  /**
   * Revoke a session key
   */
  const revokeSessionKey = useCallback(async () => {
    if (!isConnected && !isDevelopmentMode()) {
      throw new Error('Wallet not connected');
    }
    
    if (!sessionKeyDetails) {
      throw new Error('No active session key');
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // In development mode, skip the signature and API call
      if (isDevelopmentMode() || !walletClient) {
        console.log('Revoking session key in development mode');
        
        // Clear state and storage
        setSessionKeyDetails(null);
        setHasActiveSessionKey(false);
        localStorage.removeItem(`sessionKey_${address?.toLowerCase() || 'dev'}`);
        
        setIsLoading(false);
        return true;
      }
      
      // In production, sign message using wagmi
      const message = `AlpacaLotto: Revoke session key ${sessionKeyDetails.key.address}.`;
      
      // Sign the message using wagmi's useSignMessage hook
      const signature = await signMessageAsync({ message });
      
      // Call API to revoke session key
      const response = await api.revokeSessionKey(
        sessionKeyDetails.key.address, 
        signature
      );
      
      if (response.success) {
        // Clear state and storage
        setSessionKeyDetails(null);
        setHasActiveSessionKey(false);
        localStorage.removeItem(`sessionKey_${address?.toLowerCase()}`);
        
        setIsLoading(false);
        return true;
      }
      
      throw new Error(response.error || 'Session key revocation failed');
    } catch (err) {
      console.error('Session key revocation error:', err);
      setError(err.message || 'Session key revocation error');
      setIsLoading(false);
      throw err;
    }
  }, [address, isConnected, isDevelopmentMode, walletClient, sessionKeyDetails, signMessageAsync]);
  
  /**
   * Get session key remaining time in seconds
   */
  const getTimeRemaining = useCallback(() => {
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
   */
  const isExpiringWithin = useCallback((withinSeconds) => {
    const remaining = getTimeRemaining();
    return remaining > 0 && remaining <= withinSeconds;
  }, [getTimeRemaining]);
  
  // Load session key on mount and account change
  useEffect(() => {
    if (address || isDevelopmentMode()) {
      loadSessionKeyFromStorage();
    }
  }, [address, loadSessionKeyFromStorage, isDevelopmentMode]);
  
  // Check session key expiration every minute
  useEffect(() => {
    if (!hasActiveSessionKey) return;
    
    const checkInterval = setInterval(() => {
      const remaining = getTimeRemaining();
      
      if (remaining <= 0) {
        // Clear state and storage when expired
        setSessionKeyDetails(null);
        setHasActiveSessionKey(false);
        localStorage.removeItem(`sessionKey_${address?.toLowerCase() || 'dev'}`);
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
    isExpiringWithin
  };
};

export default useSessionKeys;