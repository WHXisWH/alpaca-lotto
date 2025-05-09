import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';

const EnhancedPaymentUI = ({ onSelect, autoSelectRecommended = true }) => {
  const { address } = useAccount();
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recommendation, setRecommendation] = useState(null);
  const [selectedPaymentType, setSelectedPaymentType] = useState(0);
  const [selectedToken, setSelectedToken] = useState(null);
  const [optimizationFactors, setOptimizationFactors] = useState({
    balance: 30,
    volatility: 25,
    gasPrice: 20,
    networkConditions: 15,
    userPreference: 10
  });
  const [gasEstimates, setGasEstimates] = useState({});
  const [showDetailedAnalysis, setShowDetailedAnalysis] = useState(false);
  
  // Fetch token data
  useEffect(() => {
    const fetchTokenData = async () => {
      setLoading(true);
      try {
        // Fetch user's tokens
        const userTokens = await fetchUserTokens(address);
        setTokens(userTokens);
        
        // Get gas estimates for each token
        const estimates = {};
        for (const token of userTokens) {
          estimates[token.address] = await estimateGasCost(token.address);
        }
        setGasEstimates(estimates);
        
        // Run optimization algorithm
        const optimizationResult = await optimizeTokenSelection(
          userTokens, 
          optimizationFactors,
          estimates
        );
        setRecommendation(optimizationResult);
        
        // Auto-select if enabled
        if (autoSelectRecommended && optimizationResult) {
          setSelectedToken(optimizationResult.recommendedToken);
          onSelect?.({
            token: optimizationResult.recommendedToken,
            paymentType: selectedPaymentType
          });
        }
      } catch (err) {
        console.error("Error loading token data:", err);
      } finally {
        setLoading(false);
      }
    };
    
    if (address) {
      fetchTokenData();
    }
  }, [address, optimizationFactors, autoSelectRecommended, onSelect, selectedPaymentType]);
  
  // Token selection handler
  const handleTokenSelect = (token) => {
    setSelectedToken(token);
    onSelect?.({
      token,
      paymentType: selectedPaymentType
    });
  };
  
  // Payment type selection handler
  const handlePaymentTypeSelect = (type) => {
    setSelectedPaymentType(type);
    if (selectedToken) {
      onSelect?.({
        token: selectedToken,
        paymentType: type
      });
    }
  };
  
  // Factor adjustment handler with real-time optimization
  const handleFactorChange = (factor, value) => {
    const newFactors = { ...optimizationFactors };
    newFactors[factor] = parseInt(value);
    
    // Ensure total is 100%
    const total = Object.values(newFactors).reduce((sum, val) => sum + val, 0);
    if (total !== 100) {
      const diff = 100 - total;
      const otherFactors = Object.keys(newFactors).filter(key => key !== factor);
      
      // Distribute difference proportionally
      const otherTotal = otherFactors.reduce((sum, key) => sum + newFactors[key], 0);
      otherFactors.forEach(key => {
        const proportion = otherTotal ? (newFactors[key] / otherTotal) : (1 / otherFactors.length);
        newFactors[key] += Math.round(diff * proportion);
      });
    }
    
    setOptimizationFactors(newFactors);
  };
  
  // Toggle detailed analysis view
  const toggleDetailedAnalysis = () => {
    setShowDetailedAnalysis(!showDetailedAnalysis);
  };
  
  if (loading) {
    return (
      <div className="payment-optimizer loading">
        <div className="loading-spinner"></div>
        <p>Analyzing tokens for optimal payment...</p>
      </div>
    );
  }
  
  if (tokens.length === 0) {
    return (
      <div className="payment-optimizer empty">
        <p>No supported payment tokens found in your wallet.</p>
      </div>
    );
  }
  
  return (
    <div className="payment-optimizer">
      {/* Header with AI Badge */}
      <div className="optimizer-header">
        <h3>Gas Payment Optimization</h3>
        {recommendation && (
          <div className="recommendation-badge">
            <span className="badge-icon">🤖</span>
            <span className="badge-text">AI Optimized</span>
          </div>
        )}
        <button 
          className="detail-toggle" 
          onClick={toggleDetailedAnalysis}
        >
          {showDetailedAnalysis ? 'Hide Details' : 'Show Details'}
        </button>
      </div>
      
      {/* Payment Types Section */}
      <div className="payment-types">
        <div className="section-title">Payment Method</div>
        <div className="payment-type-options">
          {/* Type 0: Sponsored Gas */}
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
          
          {/* Type 1: Prepay with ERC20 */}
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
          
          {/* Type 2: Postpay with ERC20 */}
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
      
      {/* Token Selection Section - Only shown for payment types 1 and 2 */}
      {(selectedPaymentType === 1 || selectedPaymentType === 2) && (
        <>
          <div className="token-selection">
            <div className="section-title">Select Token</div>
            <div className="token-list">
              {tokens.map(token => (
                <div
                  key={token.address}
                  className={`token-option ${selectedToken?.address === token.address ? 'selected' : ''} ${recommendation?.recommendedToken?.address === token.address ? 'recommended' : ''}`}
                  onClick={() => handleTokenSelect(token)}
                >
                  <div className="token-icon">{token?.symbol?.charAt(0) ?? '？'}</div>
                  <div className="token-details">
                    <div className="token-name-row">
                      <span className="token-symbol">{token.symbol}</span>
                      <span className="token-name">{token.name}</span>
                      {recommendation?.recommendedToken?.address === token.address && (
                        <span className="ai-badge">AI Recommended</span>
                      )}
                    </div>
                    <div className="token-balance-row">
                      <span className="token-balance">{parseFloat(token.balance).toFixed(4)}</span>
                      <span className="token-usd-balance">
                        (${(parseFloat(token.balance) * (token.usdPrice || 1)).toFixed(2)})
                      </span>
                    </div>
                    
                    {gasEstimates[token.address] && (
                      <div className="gas-estimate-row">
                        <span className="gas-label">Est. Gas:</span>
                        <span className="gas-value">
                          {gasEstimates[token.address].gasCostToken.toFixed(6)} {token.symbol}
                        </span>
                      </div>
                    )}
                    
                    {/* Score Visualization */}
                    {token.score !== undefined && (
                      <div className="score-bar-container">
                        <div className="score-bar">
                          <div 
                            className="score-fill" 
                            style={{ width: `${token.score * 100}%` }}
                          ></div>
                        </div>
                        <span className="score-value">{(token.score * 100).toFixed(0)}%</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Score Breakdown */}
                  {token.score !== undefined && showDetailedAnalysis && (
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
                      <div className="breakdown-item">
                        <span className="breakdown-label">Network</span>
                        <span className="breakdown-value">{(token.networkScore * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          {/* Only show optimization settings in detailed view */}
          {showDetailedAnalysis && (
            <div className="optimization-settings">
              <div className="section-title">
                <span>Optimization Factors</span>
              </div>
              <div className="factors-sliders">
                {Object.entries(optimizationFactors).map(([factor, weight]) => (
                  <div className="factor-item" key={factor}>
                    <div className="factor-header">
                      <span className="factor-label">{factor.charAt(0).toUpperCase() + factor.slice(1)}</span>
                      <span className="factor-value">{weight}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={weight}
                      onChange={(e) => handleFactorChange(factor, e.target.value)}
                      className="factor-slider"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      
      {/* Network Conditions Panel - Advanced Information */}
      {showDetailedAnalysis && (
        <div className="network-conditions">
          <div className="section-title">Current Network Conditions</div>
          <div className="condition-items">
            <div className="condition-item">
              <span className="condition-label">Gas Price:</span>
              <span className="condition-value">Low (12 Gwei)</span>
            </div>
            <div className="condition-item">
              <span className="condition-label">Mempool:</span>
              <span className="condition-value">Light (85 pending txs)</span>
            </div>
            <div className="condition-item">
              <span className="condition-label">Congestion:</span>
              <span className="condition-value">4% (Very Low)</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Info Box - Educational Component */}
      <div className="info-box">
        <div className="info-icon">ℹ️</div>
        <div className="info-content">
          <p>NERO Chain's Account Abstraction allows you to pay for gas with any token you own, 
          not just the native currency. The AI optimization analyzes your tokens to find the
          most cost-effective option based on current market conditions.</p>
        </div>
      </div>
    </div>
  );
};

// Mock implementation of required functions
// These would be replaced with actual API calls in production
const fetchUserTokens = async (address) => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Return mock tokens with scoring data
  return [
    {
      address: '0x6b175474e89094c44da98b954eedeac495271d0f',
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      decimals: 18,
      balance: '125.75',
      usdPrice: 1.0,
      score: 0.92,
      balanceScore: 0.85,
      volatilityScore: 0.98,
      slippageScore: 0.95,
      networkScore: 0.90,
      reasons: ['Excellent stability', 'Good liquidity', 'Sufficient balance']
    },
    {
      address: '0xC86Fed58edF0981e927160C50ecB8a8B05B32fed',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      balance: '350.5',
      usdPrice: 1.0,
      score: 0.95,
      balanceScore: 0.95,
      volatilityScore: 0.99,
      slippageScore: 0.98,
      networkScore: 0.88,
      reasons: ['Excellent stability', 'High liquidity', 'Large balance']
    },
    {
      address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      balance: '200.0',
      usdPrice: 1.0,
      score: 0.87,
      balanceScore: 0.90,
      volatilityScore: 0.97,
      slippageScore: 0.92,
      networkScore: 0.70,
      reasons: ['Good stability', 'Moderate liquidity', 'Sufficient balance']
    },
    {
      address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
      symbol: 'WBTC',
      name: 'Wrapped Bitcoin',
      decimals: 8,
      balance: '0.015',
      usdPrice: 42000,
      score: 0.78,
      balanceScore: 0.75,
      volatilityScore: 0.70,
      slippageScore: 0.85,
      networkScore: 0.83,
      reasons: ['High value', 'Moderate volatility', 'Good liquidity']
    },
    {
      address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      symbol: 'WETH',
      name: 'Wrapped Ether',
      decimals: 18,
      balance: '0.25',
      usdPrice: 2800,
      score: 0.83,
      balanceScore: 0.80,
      volatilityScore: 0.75,
      slippageScore: 0.90,
      networkScore: 0.89,
      reasons: ['High liquidity', 'Moderate volatility', 'Good network support']
    }
  ];
};

const estimateGasCost = async (tokenAddress) => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Return mock gas estimates
  const mockEstimates = {
    '0x6b175474e89094c44da98b954eedeac495271d0f': { gasCostToken: 0.0015 },
    '0xC86Fed58edF0981e927160C50ecB8a8B05B32fed': { gasCostToken: 0.0012 },
    '0xdac17f958d2ee523a2206206994597c13d831ec7': { gasCostToken: 0.0018 },
    '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': { gasCostToken: 0.0000025 },
    '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': { gasCostToken: 0.00035 }
  };
  
  return mockEstimates[tokenAddress] || { gasCostToken: 0.002 };
};

const optimizeTokenSelection = async (tokens, factors, gasEstimates) => {
  // Simulate AI processing delay
  await new Promise(resolve => setTimeout(resolve, 800));
  
  // Apply scoring based on factors
  const scoredTokens = tokens.map(token => {
    // Calculate composite score based on factors
    const weightedScore = 
      (token.balanceScore * (factors.balance / 100)) +
      (token.volatilityScore * (factors.volatility / 100)) +
      (token.slippageScore * (factors.gasPrice / 100)) +
      (token.networkScore * (factors.networkConditions / 100));
    
    return {
      ...token,
      compositeScore: weightedScore
    };
  });
  
  // Sort by score
  const sortedTokens = [...scoredTokens].sort((a, b) => b.compositeScore - a.compositeScore);
  
  return {
    recommendedToken: sortedTokens[0],
    allScores: sortedTokens,
    factors
  };
};

export default EnhancedPaymentUI;