import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import useTokens from '../hooks/useTokens';
import useUserOp from '../hooks/useUserOp';
import paymasterService from '../services/paymasterService';

/**
 * PaymentOptimizer Component
 * 
 * This component demonstrates NERO Chain's Account Abstraction Paymaster capabilities
 * by analyzing user tokens and suggesting the optimal token to use for gas payments.
 * 
 * @param {Object} props
 * @param {Function} props.onSelect - Callback when token is selected
 * @param {boolean} props.autoSelectRecommended - Automatically select recommended token
 */
const PaymentOptimizer = ({ onSelect, autoSelectRecommended = false }) => {
  const { address, isConnected } = useAccount();
  const { tokens, isLoading: tokensLoading } = useTokens();
  const { aaWalletAddress, initSDK, isLoading: userOpLoading } = useUserOp();
  
  const [paymentOptions, setPaymentOptions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [recommendedToken, setRecommendedToken] = useState(null);
  const [selectedPaymentType, setSelectedPaymentType] = useState(0); // Default: Sponsored
  const [selectedToken, setSelectedToken] = useState(null);
  const [optimizationFactors, setOptimizationFactors] = useState({
    balanceWeight: 40,
    volatilityWeight: 30,
    slippageWeight: 30
  });
  const [gasCostEstimates, setGasCostEstimates] = useState({});
  
  // Initialize services on component mount
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
  
  // Get supported tokens from Paymaster when AA wallet address is available
  useEffect(() => {
    const getSupportedTokens = async () => {
      if (!aaWalletAddress) return;
      
      setIsLoading(true);
      
      try {
        const supportedTokens = await paymasterService.getSupportedTokens(aaWalletAddress);
        
        // Filter user tokens to only include supported tokens
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
  
  // Calculate token scores and pick recommended token
  useEffect(() => {
    const optimizeTokens = async () => {
      if (!autoSelectRecommended || !paymentOptions.length || recommendedToken) return;
      
      setIsLoading(true);
      
      try {
        // Calculate gas cost estimates for each token
        const gasEstimates = {};
        
        for (const token of paymentOptions) {
          const estimate = await paymasterService.getGasCostEstimation(
            token.address, 
            300000 // Estimation for a typical transaction
          );
          
          gasEstimates[token.address] = estimate;
        }
        
        setGasCostEstimates(gasEstimates);
        
        // Calculate scores based on optimization factors
        const scoredTokens = paymentOptions.map(token => {
          const address = token.address.toLowerCase();
          
          // Balance score (higher balance = better score)
          const balance = parseFloat(token.balance);
          const maxBalance = Math.max(...paymentOptions.map(t => parseFloat(t.balance)));
          const balanceScore = maxBalance > 0 ? (balance / maxBalance) : 0;
          
          // Volatility score (lower volatility = better score)
          // For this example, stablecoins have 0 volatility, others range from 0.01 to 0.2
          const isStablecoin = ['DAI', 'USDC', 'USDT'].includes(token.symbol);
          const volatility = isStablecoin ? 0 : (token.symbol === 'WETH' ? 0.05 : (token.symbol === 'WBTC' ? 0.08 : 0.15));
          const volatilityScore = 1 - volatility; // Convert to score where higher is better
          
          // Slippage score (lower slippage/gas cost = better score)
          const gasEstimate = gasEstimates[token.address]?.gasCostToken || 0;
          const gasScores = Object.values(gasEstimates).map(est => est.gasCostToken || 0);
          const maxGasCost = Math.max(...gasScores.filter(score => score > 0)) || 1;
          const slippageScore = maxGasCost > 0 ? (1 - (gasEstimate / maxGasCost)) : 0;
          
          // Total weighted score
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
        
        // Sort by total score (descending)
        const sortedTokens = [...scoredTokens].sort((a, b) => b.totalScore - a.totalScore);
        
        // Set recommended token (highest score)
        if (sortedTokens.length > 0) {
          const recommended = sortedTokens[0];
          setRecommendedToken(recommended);
          
          // Auto-select if enabled
          if (autoSelectRecommended && !selectedToken) {
            setSelectedToken(recommended);
            
            if (onSelect) {
              onSelect({
                token: recommended,
                paymentType: selectedPaymentType
              });
            }
          }
        }
        
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to optimize tokens:', err);
        setError('Failed to run token optimization');
        setIsLoading(false);
      }
    };
    
    optimizeTokens();
  }, [paymentOptions, optimizationFactors]);
  
  // Handle token selection
  const handleTokenSelect = (token) => {
    setSelectedToken(token);
    
    if (onSelect) {
      onSelect({
        token,
        paymentType: selectedPaymentType
      });
    }
  };
  
  // Handle payment type selection
  const handlePaymentTypeSelect = (type) => {
    setSelectedPaymentType(type);
    
    if (selectedToken && onSelect) {
      onSelect({
        token: selectedToken,
        paymentType: type
      });
    }
  };
  
  // Handle optimization factor adjustment
  const handleFactorChange = (factor, value) => {
    const newValue = Number(value);
    
    if (isNaN(newValue) || newValue < 0 || newValue > 100) {
      return;
    }
    
    const newFactors = { ...optimizationFactors };
    newFactors[factor] = newValue;
    
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
    
    setOptimizationFactors(newFactors);
  };
  
  // Loading state
  if (isLoading || tokensLoading || userOpLoading) {
    return (
      <div className="payment-optimizer loading">
        <div className="loading-spinner"></div>
        <p>Analyzing tokens for optimal payment...</p>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className="payment-optimizer error">
        <div className="error-icon">⚠️</div>
        <h3>Optimization Error</h3>
        <p>{error}</p>
      </div>
    );
  }
  
  // Empty state
  if (paymentOptions.length === 0) {
    return (
      <div className="payment-optimizer empty">
        <p>No supported payment tokens found in your wallet.</p>
      </div>
    );
  }
  
  return (
    <div className="payment-optimizer">
      <div className="optimizer-header">
        <h3>Gas Payment Options</h3>
        {recommendedToken && (
          <div className="recommendation-badge">
            <span className="badge-icon">🤖</span>
            <span className="badge-text">AI Optimized</span>
          </div>
        )}
      </div>
      
      <div className="payment-types">
        <div className="section-title">Payment Method</div>
        <div className="payment-type-options">
          <div
            className={`payment-type-option ${selectedPaymentType === 0 ? 'selected' : ''}`}
            onClick={() => handlePaymentTypeSelect(0)}
          >
            <div className="option-radio">
              <div className={`radio-inner ${selectedPaymentType === 0 ? 'selected' : ''}`}></div>
            </div>
            <div className="option-content">
              <div className="option-title">Sponsored (Free)</div>
              <div className="option-description">Developer pays gas fees for you</div>
            </div>
          </div>
          
          <div
            className={`payment-type-option ${selectedPaymentType === 1 ? 'selected' : ''}`}
            onClick={() => handlePaymentTypeSelect(1)}
          >
            <div className="option-radio">
              <div className={`radio-inner ${selectedPaymentType === 1 ? 'selected' : ''}`}></div>
            </div>
            <div className="option-content">
              <div className="option-title">Pay with ERC20 (Prepay)</div>
              <div className="option-description">Pay gas with token upfront, refund excess</div>
            </div>
          </div>
          
          <div
            className={`payment-type-option ${selectedPaymentType === 2 ? 'selected' : ''}`}
            onClick={() => handlePaymentTypeSelect(2)}
          >
            <div className="option-radio">
              <div className={`radio-inner ${selectedPaymentType === 2 ? 'selected' : ''}`}></div>
            </div>
            <div className="option-content">
              <div className="option-title">Pay with ERC20 (Postpay)</div>
              <div className="option-description">Pay gas with token after execution</div>
            </div>
          </div>
        </div>
      </div>
      
      {(selectedPaymentType === 1 || selectedPaymentType === 2) && (
        <>
          <div className="token-selection">
            <div className="section-title">Select Token</div>
            <div className="token-list">
              {paymentOptions.map(token => (
                <div
                  key={token.address}
                  className={`token-option ${selectedToken?.address === token.address ? 'selected' : ''} ${recommendedToken?.address === token.address ? 'recommended' : ''}`}
                  onClick={() => handleTokenSelect(token)}
                >
                  <div className="token-icon">{token.symbol.charAt(0)}</div>
                  <div className="token-details">
                    <div className="token-name-row">
                      <span className="token-symbol">{token.symbol}</span>
                      <span className="token-name">{token.name}</span>
                      {recommendedToken?.address === token.address && (
                        <span className="ai-badge">AI Recommended</span>
                      )}
                    </div>
                    <div className="token-balance-row">
                      <span className="token-balance">{parseFloat(token.balance).toFixed(4)}</span>
                      <span className="token-usd-balance">
                        (${(parseFloat(token.balance) * (token.usdPrice || 1)).toFixed(2)})
                      </span>
                    </div>
                    
                    {gasCostEstimates[token.address] && (
                      <div className="gas-estimate-row">
                        <span className="gas-label">Est. Gas:</span>
                        <span className="gas-value">
                          {gasCostEstimates[token.address].gasCostToken.toFixed(6)} {token.symbol}
                        </span>
                      </div>
                    )}
                    
                    {token.totalScore !== undefined && (
                      <div className="score-bar-container">
                        <div className="score-bar">
                          <div 
                            className="score-fill" 
                            style={{ width: `${token.totalScore * 100}%` }}
                          ></div>
                        </div>
                        <span className="score-value">{(token.totalScore * 100).toFixed(0)}%</span>
                      </div>
                    )}
                  </div>
                  {token.totalScore !== undefined && (
                    <div className="score-breakdown">
                      <div className="breakdown-item">
                        <span className="breakdown-label">Balance</span>
                        <span className="breakdown-value">{(token.balanceScore * 100).toFixed(0)}%</span>
                      </div>
                      <div className="breakdown-item">
                        <span className="breakdown-label">Stability</span>
                        <span className="breakdown-value">{(token.volatilityScore * 100).toFixed(0)}%</span>
                      </div>
                      <div className="breakdown-item">
                        <span className="breakdown-label">Gas Cost</span>
                        <span className="breakdown-value">{(token.slippageScore * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          <div className="optimization-settings">
            <div className="section-title">
              <span>Optimization Factors</span>
              <button className="toggle-settings">⚙️</button>
            </div>
            <div className="factors-sliders">
              <div className="factor-item">
                <div className="factor-header">
                  <span className="factor-label">Balance</span>
                  <span className="factor-value">{optimizationFactors.balanceWeight}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={optimizationFactors.balanceWeight}
                  onChange={(e) => handleFactorChange('balanceWeight', e.target.value)}
                  className="factor-slider"
                />
              </div>
              
              <div className="factor-item">
                <div className="factor-header">
                  <span className="factor-label">Stability</span>
                  <span className="factor-value">{optimizationFactors.volatilityWeight}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={optimizationFactors.volatilityWeight}
                  onChange={(e) => handleFactorChange('volatilityWeight', e.target.value)}
                  className="factor-slider"
                />
              </div>
              
              <div className="factor-item">
                <div className="factor-header">
                  <span className="factor-label">Gas Cost</span>
                  <span className="factor-value">{optimizationFactors.slippageWeight}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={optimizationFactors.slippageWeight}
                  onChange={(e) => handleFactorChange('slippageWeight', e.target.value)}
                  className="factor-slider"
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PaymentOptimizer;