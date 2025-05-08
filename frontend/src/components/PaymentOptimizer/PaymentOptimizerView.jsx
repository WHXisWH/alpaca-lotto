import React from 'react';

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
  handlePaymentTypeSelect,
  handleFactorChange
}) => {
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

export default PaymentOptimizerView;