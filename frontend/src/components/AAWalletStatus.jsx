// UPDATED: frontend/src/components/AAWalletStatus.jsx

import React, { useState, useEffect } from 'react';
import useUserOp from '../hooks/useUserOp';
import testModeUtils from '../utils/testModeUtils';

/**
 * Component to display wallet deployment status and provide actions
 */
const AAWalletStatus = ({ className = '', minimal = false }) => {
  const { 
    isDeployed, 
    needsNeroTokens,
    deployAAWallet,
    prefundAAWallet,
    isLoading,
    isPrefundingWallet,
    error: userOpError,
    isDevelopmentMode,
    enableTestMode
  } = useUserOp();
  
  const [prefundAmount, setPrefundAmount] = useState('0.05');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // If wallet is already deployed, don't show anything
  if (isDeployed || isDevelopmentMode) return null;
  
  // Handle deployment
  const handleDeploy = async () => {
    setError(null);
    setSuccess(null);
    
    try {
      await deployAAWallet();
      setSuccess('Smart contract wallet deployed successfully!');
    } catch (err) {
      if (err.message?.includes('AA21') || err.message?.includes('funds')) {
        setError('Not enough NERO balance. Please add NERO tokens first.');
      } else {
        setError(err.message || 'Failed to deploy wallet');
        
        // Offer test mode
        if (window.confirm('Deployment failed. Would you like to enter test mode instead?')) {
          enableTestMode();
        }
      }
    }
  };
  
  // Handle prefunding
  const handlePrefund = async () => {
    setError(null);
    setSuccess(null);
    
    try {
      await prefundAAWallet(prefundAmount);
      setSuccess(`Successfully added ${prefundAmount} NERO to your wallet`);
    } catch (err) {
      setError(err.message || 'Failed to add NERO tokens');
    }
  };
  
  // Enter test mode
  const handleEnterTestMode = () => {
    enableTestMode();
  };
  
  // In minimal mode, show a simplified banner
  if (minimal) {
    return (
      <div className={`aa-wallet-banner ${className}`}>
        <span className="banner-icon">⚠️</span>
        <span className="banner-text">Smart contract wallet not deployed.</span>
        <div className="banner-actions">
          <button 
            className="deploy-button"
            onClick={handleDeploy}
            disabled={isLoading}
          >
            {isLoading ? 'Deploying...' : 'Deploy Now'}
          </button>
          <button 
            className="test-mode-button"
            onClick={handleEnterTestMode}
          >
            Test Mode
          </button>
        </div>
      </div>
    );
  }
  
  // Full wallet status component
  return (
    <div className={`aa-wallet-status ${className}`}>
      <div className="status-header">
        <div className="status-icon">⚠️</div>
        <h3>Smart Contract Wallet Setup</h3>
      </div>
      
      <div className="status-content">
        <p>
          Your smart contract wallet needs to be set up before making transactions.
          This is a one-time process that will improve your transaction experience.
        </p>
        
        <div className="setup-actions">
          <div className="action-row">
            <button 
              className="deploy-button primary-button"
              onClick={handleDeploy}
              disabled={isLoading}
            >
              {isLoading ? 'Deploying...' : 'Deploy Wallet'}
            </button>
            <p className="action-description">
              Deploy your smart contract wallet. This will automatically add the necessary NERO tokens.
            </p>
          </div>
          
          <div className="advanced-section">
            <div className="section-header">
              <span className="section-title">Advanced Options</span>
            </div>
            
            <div className="action-row">
              <div className="prefund-controls">
                <input 
                  type="text" 
                  value={prefundAmount} 
                  onChange={(e) => setPrefundAmount(e.target.value)}
                  placeholder="Amount in NERO"
                  className="prefund-input"
                />
                <button 
                  className="prefund-button secondary-button"
                  onClick={handlePrefund}
                  disabled={isPrefundingWallet}
                >
                  {isPrefundingWallet ? 'Adding NERO...' : 'Add NERO'}
                </button>
              </div>
              <p className="action-description">
                Manually add NERO tokens to your wallet. Recommended: 0.05 NERO
              </p>
            </div>
            
            <div className="action-row">
              <button 
                className="test-mode-button"
                onClick={handleEnterTestMode}
              >
                Enter Test Mode
              </button>
              <p className="action-description">
                Use test mode to simulate transactions without deploying a wallet.
              </p>
            </div>
          </div>
        </div>
        
        {(error || userOpError) && (
          <div className="status-error">
            {error || userOpError}
          </div>
        )}
        
        {success && (
          <div className="status-success">
            {success}
          </div>
        )}
      </div>
    </div>
  );
};

export default AAWalletStatus;