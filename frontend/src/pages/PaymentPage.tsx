import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { ethers } from 'ethers';
import useWagmiWallet from '../hooks/useWagmiWallet';
import useUserOp from '../hooks/useUserOp';
import useLotteries from '../hooks/useLotteries';
import useSessionKeys from '../hooks/useSessionKeys';
import AAWalletStatus from '../components/AAWalletStatus';
import { ENTRYPOINT_ADDRESS, TOKEN_PAYMASTER_ADDRESS } from '../constants/config';

/**
 * Payment processing page
 */
const PaymentPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { lottery, token, quantity, paymentType: initialPaymentType, txHash: initialTxHash } = location.state || {};
  
  // Using wagmi hooks
  const { address, isConnected } = useAccount();
  const { connectWallet } = useWagmiWallet();
  
  const { 
    fetchUserTickets,
    fetchLotteryDetails,
    fetchAllUserTickets
  } = useLotteries();
  
  // Custom hooks with integrated deployment features
  const { 
    executeTicketPurchase,
    prefundAAWallet, 
    isLoading: purchaseLoading, 
    error: purchaseError, 
    txHash: hookTxHash,
    isDeployed,
    deployOrWarn
  } = useUserOp();
  
  const { hasActiveSessionKey } = useSessionKeys();
  
  // State
  const [paymentType, setPaymentType] = useState(initialPaymentType || 0);
  const [paymentToken, setPaymentToken] = useState(token);
  const [transactionStatus, setTransactionStatus] = useState(
    initialTxHash ? 'success' : 'preparing'
  );
  const [errorMessage, setErrorMessage] = useState('');
  const [deploymentSuccess, setDeploymentSuccess] = useState(false);
  const [txHash, setTxHash] = useState(initialTxHash || hookTxHash);
  const [processingSteps, setProcessingSteps] = useState([
    { id: 'preparing', label: 'Preparing transaction', status: 'pending' },
    { id: 'submitting', label: 'Submitting to blockchain', status: 'waiting' },
    { id: 'confirming', label: 'Confirming transaction', status: 'waiting' },
    { id: 'finalizing', label: 'Finalizing purchase', status: 'waiting' }
  ]);
  
  // Helper to update processing step
  const updateProcessingStep = (stepId, status) => {
    setProcessingSteps(prevSteps => 
      prevSteps.map(step => 
        step.id === stepId ? { ...step, status } : step
      )
    );
  };
  
  // Reset deployment success message after 5 seconds
  useEffect(() => {
    if (deploymentSuccess) {
      const timer = setTimeout(() => {
        setDeploymentSuccess(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [deploymentSuccess]);
  
  // Navigate back to home if lottery or token is missing
  useEffect(() => {
    if (!lottery || !token) {
      navigate('/');
    }
  }, [lottery, token, navigate]);
  
  // Connect wallet if not connected
  useEffect(() => {
    if (!isConnected) {
      connectWallet();
    }
  }, [isConnected, connectWallet]);
  
  // Payment type change handler
  const handlePaymentTypeChange = (e) => {
    setPaymentType(parseInt(e.target.value));
  };
  
  // Handle wallet deployment
  const handleDeployWallet = async () => {
    try {
      await deployOrWarn();
      setDeploymentSuccess(true);
      setErrorMessage('');
    } catch (err) {
      if (err.message?.includes('AA21') || err.message?.includes('funds')) {
        setErrorMessage('Not enough NERO balance to deploy. Please add funds first.');
      } else {
        setErrorMessage(err.message || 'Failed to deploy wallet');
      }
    }
  };
  
  // Transaction submission handler
  const handleSubmitTransaction = async () => {
    if (!isConnected || !lottery || !token) {
      setErrorMessage('Wallet not connected or missing required information');
      return;
    }
    
    // Check if wallet is deployed
    if (!isDeployed) {
      if (window.confirm('Smart contract wallet not deployed. Deploy it now?')) {
        try {
          await deployOrWarn();
          setDeploymentSuccess(true);
        } catch (err) {
          if (err.message?.includes('AA21') || err.message?.includes('funds')) {
            setErrorMessage('Not enough NERO balance to deploy. Please add funds first.');
          } else {
            setErrorMessage(err.message || 'Failed to deploy wallet');
          }
          return;
        }
      } else {
        setErrorMessage('Smart contract wallet needs to be deployed for successful transactions');
        return;
      }
    }
    
    setTransactionStatus('processing');
    updateProcessingStep('preparing', 'complete');
    updateProcessingStep('submitting', 'pending');
    
    try {
      // Send the transaction using the user-selected payment type
      // KEY FIX: Pass the payment type and token to executeTicketPurchase
      // This will be used by setPaymasterOptions inside the function
      const txHash = await executeTicketPurchase({
        lotteryId: lottery.id,
        tokenAddress: token.address,
        quantity,
        paymentType, // User selected payment type
        paymentToken: paymentToken?.address || token.address, // Selected payment token
        useSessionKey: hasActiveSessionKey
      });
      
      updateProcessingStep('submitting', 'complete');
      updateProcessingStep('confirming', 'pending');
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      updateProcessingStep('confirming', 'complete');
      updateProcessingStep('finalizing', 'pending');
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      updateProcessingStep('finalizing', 'complete');
      
      setTxHash(txHash);
      setTransactionStatus('success');
    } catch (err) {
      console.error('Transaction error:', err);
      
      const currentStep = processingSteps.find(step => step.status === 'pending');
      if (currentStep) {
        updateProcessingStep(currentStep.id, 'error');
      }
      
      let errorMsg = err.message || 'Transaction failed';
      
      if (errorMsg.includes('token not supported') || errorMsg.includes('price error')) {
        errorMsg = 'The selected token is not supported. Please try a different token.';
      } else if (errorMsg.includes('insufficient allowance')) {
        errorMsg = 'Insufficient token allowance for gas payment. Please approve the token first.';
      } else if (errorMsg.includes('insufficient balance')) {
        errorMsg = 'Insufficient token balance for gas payment.';
      } else if (errorMsg.includes('wallet') || errorMsg.includes('deploy')) {
        errorMsg = 'Smart contract wallet not deployed. Please deploy your wallet first.';
      }
      
      setErrorMessage(errorMsg);
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
          </div>
          
          <div className="action-buttons">
            <a 
              href={`https://testnet.neroscan.io/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="explorer-link"
            >
              View in Explorer
            </a>
            
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
        
        {/* Show deployment success message if needed */}
        {deploymentSuccess && (
          <div className="deployment-success">
            <div className="success-icon">✓</div>
            <div className="success-message">
              Smart contract wallet deployed successfully!
            </div>
          </div>
        )}
        
        {/* Show wallet status if not deployed */}
        {!isDeployed && (
          <AAWalletStatus minimal className="wallet-status-banner" />
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
            <div className="summary-row">
              <span className="summary-label">Tickets:</span>
              <span className="summary-value">{quantity}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Total Cost:</span>
              <span className="summary-value">{calculateTotalCost()} {token.symbol}</span>
            </div>
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
          </div>
          
          <div className="action-buttons">
            <button 
              className="cancel-button"
              onClick={handleGoBack}
            >
              Cancel
            </button>
            
            {!isDeployed ? (
              <button 
                className="deploy-button"
                onClick={handleDeployWallet}
                disabled={purchaseLoading}
              >
                Deploy Wallet First
              </button>
            ) : (
              <button 
                className="confirm-button"
                onClick={handleSubmitTransaction}
                disabled={purchaseLoading}
              >
                {purchaseLoading ? 'Processing...' : 'Confirm Purchase'}
              </button>
            )}
          </div>
          
          {errorMessage && (
            <div className="error-message">
              {errorMessage}
            </div>
          )}
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
    </div>
  );
};

export default PaymentPage;