import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { debounce } from 'lodash';
import { useAccount } from 'wagmi';
import useTokens from '../../hooks/useTokens';
import useUserOp from '../../hooks/useUserOp';
import paymasterService from '../../services/paymasterService';

const PaymentOptimizerCore = ({ children, onSelect, autoSelectRecommended = false }) => {
  const { address, isConnected } = useAccount();
  const { tokens, isLoading: tokensLoading } = useTokens();
  const { aaWalletAddress, initSDK, isLoading: userOpLoading } = useUserOp();

  const [paymentOptions, setPaymentOptions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [recommendedToken, setRecommendedToken] = useState(null);
  const [selectedPaymentType, setSelectedPaymentType] = useState(0);
  const [selectedToken, setSelectedToken] = useState(null);
  const [optimizationFactors, setOptimizationFactors] = useState({
    balanceWeight: 40,
    volatilityWeight: 30,
    slippageWeight: 30
  });
  const hasSelectedRef = useRef(false);
  const [gasCostEstimates, setGasCostEstimates] = useState({});
  
  // Reset selection state when payment options change
  useEffect(() => {
    hasSelectedRef.current = false;
  }, [paymentOptions]);

  // Initialize services once on component mount
  useEffect(() => {
    const initServices = async () => {
      try {
        if (isConnected) {
          await initSDK();
          await paymasterService.init();
        }
      } catch (err) {
        console.error('Failed to initialize services:', err);
        setError('Failed to initialize payment services');
      }
    };

    initServices();
  }, [isConnected, initSDK]);

  // Get supported tokens from Paymaster
  useEffect(() => {
    const getSupportedTokens = async () => {
      if (!aaWalletAddress || !tokens.length) return;

      setIsLoading(true);
      try {
        // Check if account is deployed before making API calls
        const isDeployed = await paymasterService.isAccountDeployed(aaWalletAddress);
        if (!isDeployed) {
          setPaymentOptions([]);
          setError('Smart contract wallet not yet deployed');
          setIsLoading(false);
          return;
        }
        
        const supportedTokens = await paymasterService.getSupportedTokens(aaWalletAddress);
        const supportedAddresses = supportedTokens.map(token => token.address.toLowerCase());
        const filteredTokens = tokens.filter(token => 
          supportedAddresses.includes(token.address.toLowerCase())
        );

        setPaymentOptions(filteredTokens);
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to get supported tokens:', err);
        setError('Failed to get supported payment tokens');
        setIsLoading(false);
      }
    };

    if (tokens.length > 0 && aaWalletAddress) {
      getSupportedTokens();
    }
  }, [tokens, aaWalletAddress]);

  // Optimize token selection with debounce
  const optimizeTokens = useCallback(async () => {
    if (!paymentOptions.length) return;
    
    try {
      const gasEstimates = {};
  
      for (const token of paymentOptions) {
        const estimate = await paymasterService.getGasCostEstimation(token.address, 300000);
        gasEstimates[token.address] = estimate || { gasCostToken: 1 };
      }
  
      setGasCostEstimates(gasEstimates);
  
      const scoredTokens = paymentOptions.map(token => {
        const balance = parseFloat(token.balance);
        const maxBalance = Math.max(...paymentOptions.map(t => parseFloat(t.balance)));
        const balanceScore = maxBalance > 0 ? (balance / maxBalance) : 0;
  
        const isStablecoin = ['DAI', 'USDC', 'USDT'].includes(token.symbol);
        const volatility = isStablecoin ? 0 : (token.symbol === 'WETH' ? 0.05 : (token.symbol === 'WBTC' ? 0.08 : 0.15));
        const volatilityScore = 1 - volatility;
  
        const gasEstimate = gasEstimates[token.address]?.gasCostToken || 1;
        const gasScores = Object.values(gasEstimates).map(est => est.gasCostToken || 1);
        const maxGasCost = Math.max(...gasScores);
        const slippageScore = maxGasCost > 0 ? (1 - (gasEstimate / maxGasCost)) : 0;
  
        const totalScore = (
          (balanceScore * (optimizationFactors.balanceWeight / 100)) +
          (volatilityScore * (optimizationFactors.volatilityWeight / 100)) +
          (slippageScore * (optimizationFactors.slippageWeight / 100))
        );
  
        return {
          ...token,
          balanceScore,
          volatilityScore,
          slippageScore,
          totalScore
        };
      });
  
      const sortedTokens = scoredTokens.sort((a, b) => b.totalScore - a.totalScore);
  
      if (sortedTokens.length > 0) {
        const recommended = sortedTokens[0];
        setRecommendedToken(recommended);
  
        if (
          !hasSelectedRef.current &&
          autoSelectRecommended &&
          recommended &&
          (!selectedToken || selectedToken.address !== recommended.address)
        ) {
          setSelectedToken(recommended);
          onSelect?.({ token: recommended, paymentType: selectedPaymentType });
          hasSelectedRef.current = true;
        }
      }
  
      setIsLoading(false);
    } catch (err) {
      console.error('Failed to optimize tokens:', err);
      setError('Failed to run token optimization');
      setIsLoading(false);
    }
  }, [paymentOptions, optimizationFactors, selectedToken, autoSelectRecommended, selectedPaymentType, onSelect]);

  // Debounced version of optimize function
  const debouncedOptimize = useMemo(() => 
    debounce(optimizeTokens, 700),
  [optimizeTokens]);

  // Run token optimization only when autoSelectRecommended is true and payment options change
  useEffect(() => {
    if (!autoSelectRecommended || !paymentOptions.length) return;
    
    setIsLoading(true);
    debouncedOptimize();
    
    return () => debouncedOptimize.cancel();
  }, [paymentOptions.length, debouncedOptimize, autoSelectRecommended]);

  // Handle token selection
  const handleTokenSelect = useCallback((token) => {
    setSelectedToken(token);
    
    if (onSelect) {
      onSelect({
        token,
        paymentType: selectedPaymentType
      });
    }
  }, [selectedPaymentType, onSelect]);
  
  // Handle payment type selection
  const handlePaymentTypeSelect = useCallback((type) => {
    setSelectedPaymentType(type);
    
    if (selectedToken && onSelect) {
      onSelect({
        token: selectedToken,
        paymentType: type
      });
    }
  }, [selectedToken, onSelect]);
  
  // Handle optimization factor adjustment
  const handleFactorChange = useCallback((factor, value) => {
    const newValue = Number(value);
    
    if (isNaN(newValue) || newValue < 0 || newValue > 100) {
      return;
    }
    
    setOptimizationFactors(prevFactors => {
      const newFactors = { ...prevFactors, [factor]: newValue };
      
      // Ensure total remains 100
      const total = Object.values(newFactors).reduce((sum, val) => sum + val, 0);
      
      if (total !== 100) {
        // Distribute the difference among other factors
        const diff = 100 - total;
        const otherFactors = Object.keys(newFactors).filter(key => key !== factor);
        
        if (otherFactors.length === 1) {
          // If there's only one other factor, assign the difference to it
          newFactors[otherFactors[0]] += diff;
        } else {
          // Distribute proportionally among other factors
          const otherTotal = otherFactors.reduce((sum, key) => sum + newFactors[key], 0);
          
          otherFactors.forEach(key => {
            const proportion = otherTotal > 0 ? newFactors[key] / otherTotal : 1 / otherFactors.length;
            newFactors[key] += diff * proportion;
          });
        }
      }
      
      // Round values to ensure they're integers
      Object.keys(newFactors).forEach(key => {
        newFactors[key] = Math.round(newFactors[key]);
      });
      
      return newFactors;
    });
  }, []);

  // Prepare state for child components
  const state = {
    isLoading: isLoading || tokensLoading || userOpLoading,
    error,
    paymentOptions,
    recommendedToken,
    selectedPaymentType,
    selectedToken,
    optimizationFactors,
    gasCostEstimates,
    handleTokenSelect,
    handlePaymentTypeSelect,
    handleFactorChange
  };
  
  // Render using render props pattern
  return children(state);
};

export default PaymentOptimizerCore;