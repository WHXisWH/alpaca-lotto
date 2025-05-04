import React, { useState } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';

/**
 * Wallet connection component using wagmi hooks.
 * @param {Object} props
 * @param {boolean} props.isDevelopmentMode - Development mode flag.
 * @param {string} props.aaWalletAddress - AA wallet address.
 */
const WalletConnect = ({ isDevelopmentMode = false, aaWalletAddress }) => {
  const [showDetails, setShowDetails] = useState(false);
  
  // Use wagmi hooks
  const { address, isConnected } = useAccount();
  const { connect, connectors, isLoading: isConnecting, error } = useConnect();
  const { disconnect } = useDisconnect();

  // Format wallet address for display (abbreviated).
  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Click handler for the connect button.
  const handleConnect = async () => {
    try {
      // Find the appropriate connector (prefer MetaMask)
      const connector = connectors.find(c => c.name === 'MetaMask') || connectors[0];
      if (connector) {
        await connect({ connector });
      }
    } catch (err) {
      console.error('Connection error in component:', err);
      // Error will be handled by useConnect hook
    }
  };

  // Disconnect wallet handler
  const handleDisconnect = () => {
    disconnect();
    setShowDetails(false);
  };

  if (!isConnected && !isDevelopmentMode) {
    return (
      <div className="wallet-connect">
        <button 
          className="connect-button"
          onClick={handleConnect}
          disabled={isConnecting}
        >
          {isConnecting ? 'Connecting...' : 'Connect Wallet'}
        </button>
      </div>
    );
  }

  // For development mode or connected wallet
  const displayAddress = address || (isDevelopmentMode ? '0x1234567890123456789012345678901234567890' : '');

  return (
    <div className={`wallet-connect connected ${isDevelopmentMode ? 'dev-mode' : ''}`}>
      <div 
        className="wallet-info"
        onClick={() => setShowDetails(!showDetails)}
      >
        <div className="wallet-icon"></div>
        <span className="wallet-address">{formatAddress(displayAddress)}</span>
        {isDevelopmentMode && (
          <span className="dev-mode-indicator">Dev</span>
        )}
        <span className="dropdown-arrow">{showDetails ? '▲' : '▼'}</span>
      </div>

      {showDetails && (
        <div className="wallet-details">
          <div className="detail-row">
            <span className="detail-label">Connected Wallet:</span>
            <span className="detail-value" title={displayAddress}>{formatAddress(displayAddress)}</span>
          </div>
          {aaWalletAddress && (
            <div className="detail-row">
              <span className="detail-label">AA Wallet:</span>
              <span className="detail-value" title={aaWalletAddress}>{formatAddress(aaWalletAddress)}</span>
            </div>
          )}
          <button 
            className="disconnect-button"
            onClick={handleDisconnect}
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
};

export default WalletConnect;