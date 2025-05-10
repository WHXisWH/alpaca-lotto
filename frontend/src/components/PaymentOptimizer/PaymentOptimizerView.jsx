import React, { useState, useEffect } from 'react';

/**
 * Payment optimizer view component for token selection
 * Updated to show all payment types with appropriate warnings
 */
const PaymentOptimizerView = ({
  isLoading,
  error,
  paymentOptions,
  recommendedToken,
  selectedPaymentType,
  selectedToken,
  optimizationFactors,
  gasCostEstimates,
  handleTokenSelect,
  handlePaymentTypeChange,
  handleFactorChange
}) => {
  // Show warning for Type 0 when selected
  const [showSponsoredWarning, setShowSponsoredWarning] = useState(selectedPaymentType === 0);
  
  // Update warning when payment type changes
  useEffect(() => {
    setShowSponsoredWarning(selectedPaymentType === 0);
  }, [selectedPaymentType]);

  // Loading state
  if (isLoading) {
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
  if (!paymentOptions || paymentOptions.length === 0) {
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
          {/* Type 0 - Sponsored (Free) */}
          <div
            className={`payment-type-option ${selectedPaymentType === 0 ? 'selected' : ''}`}
            onClick={() => handlePaymentTypeChange(0)}
          >
            <div className="option-radio">
              <div className={`radio-inner ${selectedPaymentType === 0 ? 'selected' : ''}`}></div>
            </div>
            <div className="option-content">
              <div className="option-title">Sponsored (Free)</div>
              <div className="option-description">Developer pays gas fees for you</div>
            </div>
          </div>
          
          {/* Type 1 - Prepay with ERC20 */}
          <div
            className={`payment-type-option ${selectedPaymentType === 1 ? 'selected' : ''}`}
            onClick={() => handlePaymentTypeChange(1)}
          >
            <div className="option-radio">
              <div className={`radio-inner ${selectedPaymentType === 1 ? 'selected' : ''}`}></div>
            </div>
            <div className="option-content">
              <div className="option-title">Pay with ERC20 (Prepay)</div>
              <div className="option-description">Pay gas with token upfront, refund excess</div>
            </div>
          </div>
          
          {/* Type 2 - Postpay with ERC20 */}
          <div
            className={`payment-type-option ${selectedPaymentType === 2 ? 'selected' : ''}`}
            onClick={() => handlePaymentTypeChange(2)}
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
        
        {/* Warning for Type 0 */}
        {showSponsoredWarning && (
          <div className="payment-type-warning">
            <div className="warning-icon">ℹ️</div>
            <div className="warning-text">
              If sponsored transactions are unavailable, the system will automatically use ERC20 token payment instead.
            </div>
          </div>
        )}
      </div>
      
      {/* Token selection for Type 1 & 2 */}
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
                  <div className="token-icon">{token?.symbol?.charAt(0) ?? '？'}</div>
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
            </div>
            <div className="factors-sliders">
              {optimizationFactors && Object.entries(optimizationFactors).map(([key, value]) => (
                <div className="factor-item" key={key}>
                  <div className="factor-header">
                    <span className="factor-label">
                      {key === 'balanceWeight' ? 'Balance' : 
                       key === 'volatilityWeight' ? 'Stability' : 
                       key === 'slippageWeight' ? 'Gas Cost' : key}
                    </span>
                    <span className="factor-value">{value}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={value}
                    onChange={(e) => handleFactorChange(key, e.target.value)}
                    className="factor-slider"
                  />
                </div>
              ))}
            </div>
          </div>
        </>
      )}
      
      <div className="info-box">
        <div className="info-icon">ℹ️</div>
        <div className="info-content">
          <p>NERO Chain's Account Abstraction lets you pay for gas with any token, not just the native currency. Choose your preferred payment method above.</p>
        </div>
      </div>
    </div>
  );
};

export default PaymentOptimizerView;