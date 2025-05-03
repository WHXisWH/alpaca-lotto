import React, { useState } from 'react';

/**
 * Wallet connection component.
 * @param {Object} props
 * @param {string} props.account - The connected account.
 * @param {boolean} props.isConnecting - Flag for connection in progress.
 * @param {Function} props.onConnect - Connection handler.
 * @param {string} props.aaWalletAddress - AA wallet address.
 * @param {boolean} props.isDevelopmentMode - Development mode flag.
 */
const WalletConnect = ({ 
  account, 
  isConnecting = false, 
  onConnect, 
  aaWalletAddress,
  isDevelopmentMode = false
}) => {
  const [showDetails, setShowDetails] = useState(false);

  // Format wallet address for display (abbreviated).
  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Click handler for the connect button.
  const handleConnect = async () => {
    if (onConnect) {
      try {
        // Call the connect function with error handling
        await onConnect();
      } catch (err) {
        console.error('Connection error in component:', err);
        // The error will be handled in the hook
      }
    }
  };

  if (!account) {
    return (
      <div className="wallet-connect">
        <button 
          className="connect-button"
          onClick={handleConnect}
          disabled={isConnecting}
        >
          {isConnecting ? 'Connecting...' : 'Connect Wallet'}
        </button>
        {isDevelopmentMode && (
          <span className="dev-mode-indicator">Development Mode</span>
        )}
      </div>
    );
  }

  return (
    <div className={`wallet-connect connected ${isDevelopmentMode ? 'dev-mode' : ''}`}>
      <div 
        className="wallet-info"
        onClick={() => setShowDetails(!showDetails)}
      >
        <div className="wallet-icon"></div>
        <span className="wallet-address">{formatAddress(account)}</span>
        {isDevelopmentMode && (
          <span className="dev-mode-indicator">Dev</span>
        )}
        <span className="dropdown-arrow">{showDetails ? '▲' : '▼'}</span>
      </div>

      {showDetails && (
        <div className="wallet-details">
          <div className="detail-row">
            <span className="detail-label">Connected Wallet:</span>
            <span className="detail-value" title={account}>{formatAddress(account)}</span>
          </div>
          {aaWalletAddress && (
            <div className="detail-row">
              <span className="detail-label">AA Wallet:</span>
              <span className="detail-value" title={aaWalletAddress}>{formatAddress(aaWalletAddress)}</span>
            </div>
          )}
          <button 
            className="disconnect-button"
            onClick={() => {
              // Option: Implement disconnect functionality.
              setShowDetails(false);
            }}
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
};

export default WalletConnect;