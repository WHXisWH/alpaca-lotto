import React, { useState } from 'react';
import useUserOp from '../hooks/useUserOp';

/**
 * A reusable modal component for prefunding and deploying AA wallets
 * Modified to be optional rather than mandatory
 */
const WalletPrefundModal = ({ isOpen, onClose, onComplete }) => {
  const {
    prefundAAWallet,
    deployAAWallet,
    checkAAWalletPrefunding,
    isPrefundingWallet,
    isLoading,
    aaWalletAddress
  } = useUserOp();
  
  const [prefundAmount, setPrefundAmount] = useState("0.05");
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('initial'); // 'initial', 'prefunded', 'deployed', 'error'
  const [isDeployingWallet, setIsDeployingWallet] = useState(false);
  
  if (!isOpen) return null;
  
  // Handle prefunding the AA wallet
  const handlePrefundWallet = async () => {
    setError(null);
    
    try {
      // Check if wallet is already prefunded
      const isPrefunded = await checkAAWalletPrefunding();
      if (isPrefunded) {
        setStatus('prefunded');
        setError('Wallet is already prefunded. You can now deploy it.');
        return;
      }
      
      // Prefund the wallet
      await prefundAAWallet(prefundAmount);
      
      setStatus('prefunded');
      setError('Wallet has been successfully prefunded! You can now deploy it or continue with your transaction.');
    } catch (err) {
      console.error('Error prefunding wallet:', err);
      setError(err.message || 'Failed to prefund wallet. Please make sure you have enough NERO tokens.');
      setStatus('error');
    }
  };

  // Handle wallet deployment
  const handleDeployWallet = async () => {
    try {
      setIsDeployingWallet(true);
      setError(null);

      // Check if wallet is already prefunded
      const isPrefunded = await checkAAWalletPrefunding();
      if (!isPrefunded) {
        setError('Wallet needs to be prefunded first. Please use the "Prefund Wallet" button.');
        setIsDeployingWallet(false);
        return;
      }
      
      // Deploy the wallet
      await deployAAWallet();
      
      setStatus('deployed');
      setError('Smart contract wallet deployed successfully!');
      
      // Notify parent component
      if (onComplete) {
        setTimeout(() => {
          onComplete();
        }, 1500);
      }
    } catch (err) {
      console.error('Error deploying wallet:', err);
      
      // Check for NERO token errors
      if (err.message?.includes('NERO tokens') || err.message?.includes('prefund')) {
        setError('Your wallet needs to be prefunded with NERO tokens in the EntryPoint contract. Please use the "Prefund Wallet" button first.');
      } else {
        setError(err.message || 'Failed to deploy wallet. Please try again later.');
      }
      setStatus('error');
    } finally {
      setIsDeployingWallet(false);
    }
  };
  
  return (
    <div className="modal-overlay">
      <div className="wallet-prefund-modal">
        <div className="modal-header">
          <h2>Smart Contract Wallet Setup</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-content">
          <div className="warning-message">
            <strong>Optional Wallet Setup</strong>
            <p>Setting up a smart contract wallet is <strong>optional</strong> but can improve your transaction experience. You can skip this setup and continue using the app normally.</p>
          </div>
          
          <div className="setup-steps">
            <div className="step">
              <div className="step-number">1</div>
              <div className="step-content">
                <h4>Prefund Wallet</h4>
                <p>Deposit NERO tokens to the EntryPoint contract for your smart contract wallet.</p>
                <div className="prefund-controls">
                  <input 
                    type="text" 
                    value={prefundAmount} 
                    onChange={(e) => setPrefundAmount(e.target.value)}
                    placeholder="Amount in NERO"
                    className="prefund-input"
                  />
                  <button 
                    className="prefund-button"
                    onClick={handlePrefundWallet}
                    disabled={isPrefundingWallet}
                  >
                    {isPrefundingWallet ? 'Prefunding...' : 'Prefund Wallet'}
                  </button>
                </div>
                <div className="prefund-note">Recommended: 0.05 NERO</div>
              </div>
            </div>
            
            <div className="step">
              <div className="step-number">2</div>
              <div className="step-content">
                <h4>Deploy Wallet</h4>
                <p>After prefunding, deploy your smart contract wallet to the blockchain.</p>
                <button 
                  className="deploy-button"
                  onClick={handleDeployWallet}
                  disabled={isDeployingWallet}
                >
                  {isDeployingWallet ? 'Deploying Wallet...' : 'Deploy Wallet'}
                </button>
              </div>
            </div>
          </div>
          
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button 
            className="skip-button"
            onClick={() => {
              localStorage.setItem('skipWalletSetup', 'true');
              onClose();
            }}
          >
            Skip for Now
          </button>
          {status === 'deployed' && (
            <button 
              className="confirm-button"
              onClick={onComplete}
            >
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default WalletPrefundModal;