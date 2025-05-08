import React from 'react';

/**
 * Token selection component.
 * @param {Object} props
 * @param {Array} props.tokens - Array of tokens.
 * @param {Object} props.selectedToken - The currently selected token.
 * @param {Function} props.onSelect - Handler for token selection.
 * @param {boolean} props.isLoading - Loading state.
 * @param {Object} props.recommendation - AI recommendation info.
 */
const TokenSelector = ({
  tokens = [],
  selectedToken,
  onSelect,
  isLoading = false,
  recommendation
}) => {
  if (isLoading) {
    return (
      <div className="token-selector loading">
        <div className="loading-spinner"></div>
        <p>Analyzing tokens...</p>
      </div>
    );
  }

  if (tokens.length === 0) {
    return (
      <div className="token-selector empty">
        <p>No tokens available</p>
      </div>
    );
  }

  const isRecommended = (token) => {
    return recommendation && 
           recommendation.recommendedToken && 
           recommendation.recommendedToken.address === token.address;
  };

  return (
    <div className="token-selector">
      <div className="selector-header">
        <h3>Payment Token</h3>
        {recommendation && recommendation.recommendedToken && (
          <span className="ai-recommendation">AI Recommendation Available</span>
        )}
      </div>
      
      <div className="tokens-list">
        {tokens.map((token) => (
          <div
            key={token.address}
            className={`token-item ${selectedToken?.address === token.address ? 'selected' : ''} ${isRecommended(token) ? 'recommended' : ''}`}
            onClick={() => onSelect(token)}
          >
            <div className="token-icon">
              {token.symbol ? token?.symbol?.charAt(0) : '?'}
            </div>
            <div className="token-details">
              <div className="token-name-row">
                <span className="token-symbol">{token.symbol || 'Unknown'}</span>
                <span className="token-name">{token.name || ''}</span>
                {isRecommended(token) && (
                  <span className="ai-badge">AI Recommended</span>
                )}
              </div>
              <div className="token-balance-row">
                <span className="token-balance">{parseFloat(token.balance || 0).toFixed(4)}</span>
                {token.usdBalance && (
                  <span className="token-usd-balance">
                    (${parseFloat(token.usdBalance).toFixed(2)})
                  </span>
                )}
              </div>
              {(token.score || isRecommended(token)) && (
                <div className="token-score-row">
                  <div className="score-bar">
                    <div 
                      className="score-fill" 
                      style={{ width: `${(token.score || 0) * 100}%` }}
                    ></div>
                  </div>
                  {token.score && (
                    <span className="score-label">
                      Score: {(token.score * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
              )}
              {token.reasons && token.reasons.length > 0 && (
                <div className="token-reasons">
                  <ul>
                    {token.reasons.slice(0, 2).map((reason, index) => (
                      <li key={index}>{reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            {isRecommended(token) && (
              <div className="recommendation-indicator">BEST</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TokenSelector;