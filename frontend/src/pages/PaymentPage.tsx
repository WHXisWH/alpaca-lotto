import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import useWagmiWallet from '../hooks/useWagmiWallet';
import useUserOp from '../hooks/useUserOp';
import useLotteries from '../hooks/useLotteries';
import useSessionKeys from '../hooks/useSessionKeys';
import WalletPrefundModal from '../components/WalletPrefundModal'; // Import our new component
import { ethers } from 'ethers';

/**
 * Payment processing page
 * Updated to handle wallet prefunding requirements
 */
const PaymentPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { lottery, token, quantity, recommendation } = location.state || {};
  
  // Using wagmi hooks
  const { address, isConnected } = useAccount();
  const { connectWallet, isDevelopmentMode } = useWagmiWallet();
  
  const { 
    fetchUserTickets,
    fetchLotteryDetails,
    fetchAllUserTickets
  } = useLotteries();
  
  // Custom hooks with prefunding checks
  const { 
    executeTicketPurchase, 
    isLoading: purchaseLoading, 
    error: purchaseError, 
    txHash,
    isDevelopmentMode: userOpDevMode,
    isDeployed,
    needsNeroTokens,
    walletNeedsPrefunding,
    checkAAWalletPrefunding
  } = useUserOp();
  
  const { hasActiveSessionKey } = useSessionKeys();
  
  // State
  const [paymentType, setPaymentType] = useState(0); // Default is sponsored (Type 0)
  const [paymentToken, setPaymentToken] = useState(token);
  const [transactionStatus, setTransactionStatus] = useState('preparing'); // 'preparing', 'processing', 'success', 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const [isPrefundModalOpen, setIsPrefundModalOpen] = useState(false); // Add state for prefund modal
  const [processingSteps, setProcessingSteps] = useState([
    { id: 'preparing', label: 'Preparing transaction', status: 'pending' },
    { id: 'submitting', label: 'Submitting to blockchain', status: 'waiting' },
    { id: 'confirming', label: 'Confirming transaction', status: 'waiting' },
    { id: 'finalizing', label: 'Finalizing purchase', status: 'waiting' }
  ]);
  
  // Check if wallet needs prefunding when component mounts
  useEffect(() => {
    if (!isDeployed || needsNeroTokens) {
      checkAAWalletPrefunding().then(isPrefunded => {
        if (!isPrefunded) {
          setIsPrefundModalOpen(true);
        }
      }).catch(console.error);
    }
  }, [isDeployed, needsNeroTokens, checkAAWalletPrefunding]);
  
  // Navigate back to home if lottery or token is missing
  useEffect(() => {
    if (!lottery || !token) {
      navigate('/');
    }
  }, [lottery, token, navigate]);
  
  // Connect wallet if not connected
  useEffect(() => {
    if (!isConnected && !isDevelopmentMode) {
      connectWallet();
    }
  }, [isConnected, connectWallet, isDevelopmentMode]);
  
  // Payment type change handler
  const handlePaymentTypeChange = (e) => {
    setPaymentType(parseInt(e.target.value));
  };
  
  // Payment token change handler
  const handlePaymentTokenChange = (selectedToken) => {
    setPaymentToken(selectedToken);
  };
  
  // Helper to update processing steps
  const updateProcessingStep = (stepId, newStatus) => {
    setProcessingSteps(prevSteps => 
      prevSteps.map(step => 
        step.id === stepId ? { ...step, status: newStatus } : step
      )
    );
  };
  
  // Transaction submission handler
  const handleSubmitTransaction = async () => {
    if ((!isConnected && !isDevelopmentMode) || !lottery || !token) {
      setErrorMessage('Wallet not connected or missing required information');
      return;
    }
    
    // Check if wallet needs prefunding before proceeding
    if (!isDeployed || needsNeroTokens || walletNeedsPrefunding) {
      const isPrefunded = await checkAAWalletPrefunding();
      if (!isPrefunded) {
        setIsPrefundModalOpen(true);
        return;
      }
    }
    
    setTransactionStatus('processing');
    updateProcessingStep('preparing', 'complete');
    updateProcessingStep('submitting', 'pending');
    
    try {
      // Execute ticket purchase transaction
      const result = await executeTicketPurchase({
        lotteryId: lottery.id,
        tokenAddress: token.address,
        quantity,
        paymentType,
        paymentToken: paymentToken?.address,
        useSessionKey: hasActiveSessionKey,
        checkPrefunding: true // Enable prefunding check
      });
      
      // Check if transaction needs prefunding
      if (result && result.needsPrefunding) {
        setTransactionStatus('preparing');
        setIsPrefundModalOpen(true);
        setErrorMessage(result.error || 'Your wallet needs to be prefunded');
        return;
      }
      
      // If we have a success result with hash
      if (result && result.transactionHash) {
        // Update processing status
        updateProcessingStep('submitting', 'complete');
        updateProcessingStep('confirming', 'pending');
        
        // Simulate blockchain confirmation time
        await new Promise(resolve => setTimeout(resolve, isDevelopmentMode ? 1500 : 3000));
        
        updateProcessingStep('confirming', 'complete');
        updateProcessingStep('finalizing', 'pending');
        
        // Short delay before showing success
        await new Promise(resolve => setTimeout(resolve, 1000));
        updateProcessingStep('finalizing', 'complete');
        
        setTransactionStatus('success');
      }
    } catch (error) {
      console.error('Transaction error:', error);
      
      // Check if error indicates prefunding is needed
      if (error.message?.includes('prefund') || 
          error.message?.includes('NERO tokens') || 
          error.message?.includes('deploy')) {
        setIsPrefundModalOpen(true);
        setTransactionStatus('preparing');
        setErrorMessage('Your wallet needs to be prefunded with NERO tokens');
        return;
      }
      
      // Update processing steps to show error
      const currentStep = processingSteps.find(step => step.status === 'pending');
      if (currentStep) {
        updateProcessingStep(currentStep.id, 'error');
      }
      
      setErrorMessage(error.message || 'Transaction failed');
      setTransactionStatus('error');
    }
  };
  
  // Navigate back to home
  const handleGoBack = async () => {
    if (transactionStatus === 'success' && lottery) {
      // Refresh ticket data and lottery information after successful purchase
      try {
        await fetchUserTickets(lottery.id);
        await fetchLotteryDetails(lottery.id);
        await fetchAllUserTickets(); // Refresh all user tickets for complete update
      } catch (err) {
        console.error('Error refreshing data after purchase:', err);
      }
    }
    navigate('/');
  };
  
  /**
   * Close prefund modal
   */
  const handleClosePrefundModal = () => {
    setIsPrefundModalOpen(false);
  };
  
  /**
   * Handle prefund completion
   */
  const handlePrefundComplete = async () => {
    setIsPrefundModalOpen(false);
    
    // After prefunding is complete, check if we should continue with transaction
    const isPrefunded = await checkAAWalletPrefunding();
    if (isPrefunded) {
      // If we were in the preparing state, retry the transaction
      if (transactionStatus === 'preparing') {
        handleSubmitTransaction();
      }
    }
  };
  
  // Estimate gas cost
  const calculateEstimatedGas = () => {
    // Simple implementation - in a real app, would call estimateGas
    if (paymentType === 0) {
      return 'Free (Sponsored)';
    } else if (paymentToken) {
      return `~${(0.001).toFixed(6)} ${paymentToken.symbol}`;
    }
    return 'Calculating...';
  };
  
  // Calculate total cost
  const calculateTotalCost = () => {
    if (!lottery || !token) return '0';
    
    try {
      // Convert the ticketPrice from string to BigNumber for proper math operations
      const ticketPriceBN = ethers.BigNumber.from(lottery.ticketPrice);
      
      // Convert quantity to BigNumber
      const quantityBN = ethers.BigNumber.from(quantity);
      
      // Calculate ticket total as BigNumber (ticketPrice * quantity)
      const ticketTotalBN = ticketPriceBN.mul(quantityBN);
      
      // For display purposes, convert to ethers and then to a more readable format
      const ticketTotalEth = ethers.utils.formatEther(ticketTotalBN);
      
      // If token has USD price available, calculate the payment in tokens
      if (token.usdPrice) {
        // Convert USD amount to token amount (this is simplified and would normally use proper price oracles)
        const usdAmount = parseFloat(ticketTotalEth) * 1800; // Assuming 1 ETH = $1800 USD for this example
        const tokenAmount = usdAmount / token.usdPrice;
        return tokenAmount.toFixed(6);
      }
      
      // If no USD price available, just return the ETH amount
      return ticketTotalEth;
    } catch (error) {
      console.error('Error calculating total cost:', error);
      return '0';
    }
  };
  
  // Loading state
  if (!lottery || !token) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading payment information...</p>
      </div>
    );
  }
  
  // Transaction processing view
  if (transactionStatus === 'processing') {
    return (
      <div className="transaction-processing">
        <div className="processing-card">
          <div className="loading-spinner"></div>
          <h2>Processing Transaction</h2>
          <p>Your ticket purchase is being processed. Please wait...</p>
          
          <div className="processing-steps">
            {processingSteps.map(step => (
              <div key={step.id} className="processing-step">
                <span className={`step-status ${step.status}`}>
                  {step.status === 'complete' && '✓'}
                  {step.status === 'pending' && '⟳'}
                  {step.status === 'waiting' && '○'}
                  {step.status === 'error' && '✗'}
                </span>
                <span className="step-description">{step.label}</span>
              </div>
            ))}
          </div>
          
          {hasActiveSessionKey ? (
            <p className="session-note">Quick Play is enabled, no wallet confirmation needed.</p>
          ) : (
            <p className="session-note">Check your wallet for confirmation requests.</p>
          )}
          
          {isDevelopmentMode && (
            <div className="dev-mode-note">
              <p>Development Mode: Simulating blockchain transaction.</p>
            </div>
          )}
        </div>
      </div>
    );
  }
  
  // Transaction success view
  if (transactionStatus === 'success') {
    return (
      <div className="transaction-success">
        <div className="success-card">
          <div className="success-icon">✓</div>
          <h2>Purchase Successful!</h2>
          <p>
            You have successfully purchased {quantity} ticket{quantity !== 1 ? 's' : ''} for {lottery.name}.
          </p>
          
          <div className="transaction-details">
            <div className="detail-row">
              <span>Transaction Hash:</span>
              <span className="tx-hash">{txHash}</span>
            </div>
            {isDevelopmentMode && (
              <div className="dev-mode-note">
                <p>Development Mode: This is a simulated transaction.</p>
              </div>
            )}
          </div>
          
          <div className="action-buttons">
            {!isDevelopmentMode && (
              <a 
                href={`https://testnet.neroscan.io/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="explorer-link"
              >
                View in Explorer
              </a>
            )}
            
            <button 
              className="home-button"
              onClick={handleGoBack}
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // Transaction error view
  if (transactionStatus === 'error') {
    return (
      <div className="transaction-error">
        <div className="error-card">
          <div className="error-icon">✗</div>
          <h2>Purchase Failed</h2>
          <p>There was a problem with your ticket purchase.</p>
          
          <div className="error-details">
            <p className="error-message">{errorMessage || purchaseError}</p>
          </div>
          
          <div className="action-buttons">
            <button 
              className="retry-button"
              onClick={() => setTransactionStatus('preparing')}
            >
              Try Again
            </button>
            
            <button 
              className="home-button"
              onClick={handleGoBack}
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // Transaction preparation view (default state)
  return (
    <div className="payment-page">
      <div className="payment-container">
        <div className="back-navigation">
          <button className="back-button" onClick={handleGoBack}>
            ← Back to Lottery
          </button>
        </div>
        
        {/* Show wallet setup alert if needed */}
        {(needsNeroTokens || walletNeedsPrefunding) && !isPrefundModalOpen && (
          <div className="wallet-setup-alert">
            <div className="alert-content">
              <div className="alert-icon">⚠️</div>
              <div className="alert-message">
                <strong>Wallet Setup Required</strong>
                <p>Your smart contract wallet needs to be set up before you can make transactions.</p>
              </div>
              <button 
                className="setup-button"
                onClick={() => setIsPrefundModalOpen(true)}
              >
                Set Up Wallet
              </button>
            </div>
          </div>
        )}
        
        <div className="payment-card">
          <h2>Confirm Ticket Purchase</h2>
          
          <div className="lottery-summary">
            <h3>{lottery.name}</h3>
            <div className="ticket-price">
              ${typeof lottery.ticketPrice === 'string' ? 
                parseFloat(ethers.utils.formatEther(lottery.ticketPrice)).toFixed(2) : 
                lottery.ticketPrice.toFixed(2)} / ticket
            </div>
          </div>
          
          <div className="purchase-summary">
            {/* Purchase summary details here */}
            {/* ... */}
          </div>
          
          <div className="gas-payment-section">
            <h3>Gas Payment Method</h3>
            
            <div className="payment-type-selector">
              <div className="payment-type-option">
                <input 
                  type="radio" 
                  id="payment-type-0" 
                  name="payment-type" 
                  value="0"
                  checked={paymentType === 0}
                  onChange={handlePaymentTypeChange}
                />
                <label htmlFor="payment-type-0">
                  <div className="option-title">Sponsored (Free)</div>
                  <div className="option-description">Developer pays gas for you</div>
                </label>
              </div>
              
              <div className="payment-type-option">
                <input 
                  type="radio" 
                  id="payment-type-1" 
                  name="payment-type" 
                  value="1"
                  checked={paymentType === 1}
                  onChange={handlePaymentTypeChange}
                />
                <label htmlFor="payment-type-1">
                  <div className="option-title">Prepay (ERC20 Token)</div>
                  <div className="option-description">Pay gas with ERC20 tokens upfront</div>
                </label>
              </div>
              
              <div className="payment-type-option">
                <input 
                  type="radio" 
                  id="payment-type-2" 
                  name="payment-type" 
                  value="2"
                  checked={paymentType === 2}
                  onChange={handlePaymentTypeChange}
                />
                <label htmlFor="payment-type-2">
                  <div className="option-title">Postpay (ERC20 Token)</div>
                  <div className="option-description">Pay gas with ERC20 tokens after execution</div>
                </label>
              </div>
            </div>
            
            {/* Token selector here */}
            {/* ... */}
            
            <div className="gas-estimate">
              <span className="estimate-label">Estimated Gas Fee:</span>
              <span className="estimate-value">{calculateEstimatedGas()}</span>
            </div>
            
            {hasActiveSessionKey && (
              <div className="session-key-notice">
                <div className="notice-icon">🔑</div>
                <div className="notice-text">
                  Quick Play is enabled - No wallet confirmation needed!
                </div>
              </div>
            )}
            
            {isDevelopmentMode && (
              <div className="dev-mode-note">
                <p>Development Mode: Transaction will be simulated.</p>
              </div>
            )}
          </div>
          
          <div className="action-buttons">
            <button 
              className="cancel-button"
              onClick={handleGoBack}
            >
              Cancel
            </button>
            
            <button 
              className="confirm-button"
              onClick={handleSubmitTransaction}
              disabled={purchaseLoading}
            >
              {purchaseLoading ? 'Processing...' : 'Confirm Purchase'}
            </button>
          </div>
        </div>
        
        <div className="payment-info-card">
          <h3>About Account Abstraction</h3>
          <p>
            NERO Chain's Account Abstraction allows you to pay gas fees with any token, not just the native currency. Our AI analyzes your tokens to find the most cost-effective option.
          </p>
          
          <h4>Payment Types</h4>
          <ul>
            <li><strong>Sponsored:</strong> Free gas paid by the developer</li>
            <li><strong>Prepay:</strong> Pay with ERC20 tokens upfront</li>
            <li><strong>Postpay:</strong> Pay with ERC20 tokens after execution</li>
          </ul>
          
          <div className="security-note">
            <div className="note-icon">🔒</div>
            <div className="note-text">
              <strong>Security Note:</strong> All transactions are executed on the blockchain with complete transparency. AlpacaLotto never holds your funds.
            </div>
          </div>
        </div>
      </div>
      
      {/* Prefund Modal */}
      {isPrefundModalOpen && (
        <WalletPrefundModal
          isOpen={isPrefundModalOpen}
          onClose={handleClosePrefundModal}
          onComplete={handlePrefundComplete}
        />
      )}
    </div>
  );
};

export default PaymentPage;