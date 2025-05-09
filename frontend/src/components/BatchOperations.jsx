import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import useUserOp from '../hooks/useUserOp';
import useTokens from '../hooks/useTokens';
import useWagmiWallet from '../hooks/useWagmiWallet';
import useSessionKeys from '../hooks/useSessionKeys';

/**
 * BatchOperations Component
 * 
 * This component demonstrates NERO Chain's Account Abstraction batch operation capabilities,
 * allowing users to execute multiple transactions in a single UserOperation.
 * 
 * Updated to show all payment types with appropriate guidance
 */
const BatchOperations = ({ lotteries = [], onBatchComplete }) => {
  const { address, isConnected } = useAccount();
  const { isDevelopmentMode } = useWagmiWallet();
  const { hasActiveSessionKey } = useSessionKeys();
  
  const {
    aaWalletAddress,
    isDeployed,
    executeBatchPurchase,
    deployAAWallet,
    isLoading: userOpLoading,
    error: userOpError
  } = useUserOp();
  
  const { tokens, getSupportedTokensOnly } = useTokens();
  
  const [selections, setSelections] = useState([]);
  const [selectedToken, setSelectedToken] = useState(null);
  const [paymentType, setPaymentType] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [totalCost, setTotalCost] = useState(0);
  const [isDeployingWallet, setIsDeployingWallet] = useState(false);
  const [showSponsoredWarning, setShowSponsoredWarning] = useState(false);
  
  // Update total cost when selections change
  useEffect(() => {
    if (lotteries.length === 0) return;
    
    let cost = 0;
    selections.forEach(selection => {
      const lottery = lotteries.find(l => l.id === selection.lotteryId);
      if (lottery) {
        cost += lottery.ticketPrice * selection.quantity;
      }
    });
    
    setTotalCost(cost);
  }, [selections, lotteries]);
  
  // Set default token if available
  useEffect(() => {
    if (tokens.length > 0 && !selectedToken) {
      // Select first DAI/USDC/USDT if available, otherwise first token
      const stablecoin = tokens.find(t => 
        ['DAI', 'USDC', 'USDT'].includes(t.symbol)
      );
      
      setSelectedToken(stablecoin || tokens[0]);
    }
  }, [tokens, selectedToken]);
  
  // Update warning when payment type changes
  useEffect(() => {
    setShowSponsoredWarning(paymentType === 0);
  }, [paymentType]);
  
  // Handle adding a lottery selection
  const handleAddSelection = (lotteryId, quantity = 1) => {
    // Check if lottery is already selected
    const existingIndex = selections.findIndex(s => s.lotteryId === lotteryId);
    
    if (existingIndex >= 0) {
      // Update existing selection
      const updatedSelections = [...selections];
      updatedSelections[existingIndex] = {
        ...updatedSelections[existingIndex],
        quantity: updatedSelections[existingIndex].quantity + quantity
      };
      setSelections(updatedSelections);
    } else {
      // Add new selection
      setSelections([
        ...selections,
        {
          lotteryId,
          tokenAddress: selectedToken?.address,
          quantity
        }
      ]);
    }
  };
  
  // Handle removing a lottery selection
  const handleRemoveSelection = (index) => {
    const updatedSelections = [...selections];
    updatedSelections.splice(index, 1);
    setSelections(updatedSelections);
  };
  
  // Handle updating a selection quantity
  const handleUpdateQuantity = (index, quantity) => {
    const newQuantity = Math.max(1, quantity);
    const updatedSelections = [...selections];
    updatedSelections[index] = {
      ...updatedSelections[index],
      quantity: newQuantity
    };
    setSelections(updatedSelections);
  };
  
  // Handle token selection
  const handleTokenChange = (event) => {
    const tokenAddress = event.target.value;
    const token = tokens.find(t => t.address === tokenAddress);
    setSelectedToken(token);
    
    // Update token address in all selections
    if (token) {
      const updatedSelections = selections.map(selection => ({
        ...selection,
        tokenAddress: token.address
      }));
      setSelections(updatedSelections);
    }
  };
  
  // Handle payment type selection
  const handlePaymentTypeChange = (type) => {
    setPaymentType(type);
  };

  // Handle wallet deployment
  const handleDeployWallet = async () => {
    if (!isConnected && !isDevelopmentMode) {
      setError('Wallet not connected');
      return;
    }

    try {
      setIsDeployingWallet(true);
      setError(null);

      // This function will be implemented in your useUserOp hook
      // It should handle the deployment of the AA wallet
      await deployAAWallet();
      
      setError('Smart contract wallet deployed successfully! You can now proceed with your batch purchase.');
    } catch (err) {
      console.error('Error deploying wallet:', err);
      setError(err.message || 'Failed to deploy wallet. Please try again later.');
    } finally {
      setIsDeployingWallet(false);
    }
  };
  
  // Execute batch operation
  const handleExecuteBatch = async () => {
    if (!isConnected && !isDevelopmentMode) {
      setError('Wallet not connected');
      return;
    }
    
    if (selections.length === 0) {
      setError('No selections made');
      return;
    }
    
    if ((paymentType === 1 || paymentType === 2) && !selectedToken) {
      setError('Please select a token for gas payment');
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    
    try {
      // If not deployed and trying to use Type 0, warn and encourage wallet deployment
      if (!isDeployed && !isDevelopmentMode && paymentType === 0) {
        // Try with Type 1 instead but inform the user
        setError('Sponsored transactions require a deployed wallet. Trying with token payment instead.');
        
        // Execute with Type 1 instead
        const txHash = await executeBatchPurchase({
          selections,
          paymentType: 1,
          paymentToken: selectedToken.address,
          useSessionKey: hasActiveSessionKey
        });
        
        // Handle successful transaction
        if (txHash) {
          // Success notification
          setError(null);
          
          // Clear selections after successful purchase
          setSelections([]);
          
          // Trigger callback
          if (onBatchComplete) {
            onBatchComplete(txHash);
          }
        }
        
        return;
      }
    
      // Execute batch purchase with selected payment options
      const txHash = await executeBatchPurchase({
        selections,
        paymentType,
        paymentToken: (paymentType === 1 || paymentType === 2) ? selectedToken.address : null,
        useSessionKey: hasActiveSessionKey
      });
      
      // Handle successful transaction
      if (txHash) {
        // Success notification
        setError(null);
        
        // Clear selections after successful purchase
        setSelections([]);
        
        // Trigger callback
        if (onBatchComplete) {
          onBatchComplete(txHash);
        }
      }
    } catch (err) {
      console.error('Batch operation error:', err);
      
      let errorMsg = err.message || 'Error executing batch operation';
      
      // Show specific error message if wallet is not deployed
      if (errorMsg.includes('account not deployed') || 
          errorMsg.includes('AA20') || 
          errorMsg.includes('deploy')) {
        
        // If wallet not deployed, suggest deploying first
        if (!isDeployed && !isDevelopmentMode) {
          setError('Your smart contract wallet is not deployed yet. Please deploy it first using the button below.');
          return;
        }
      }
      
      // Check for specific paymaster errors
      if (errorMsg.includes('Gas-free model is not supported') || 
          errorMsg.includes('sponsored transactions are currently disabled')) {
        
        // For Type 0 errors, try to switch to Type 1
        if (paymentType === 0 && selectedToken) {
          setError('Sponsored transactions are currently not supported. Trying with token payment instead...');
          
          try {
            // Try again with Type 1
            const txHash = await executeBatchPurchase({
              selections,
              paymentType: 1,
              paymentToken: selectedToken.address,
              useSessionKey: hasActiveSessionKey
            });
            
            if (txHash) {
              // Success notification
              setError(null);
              
              // Clear selections after successful purchase
              setSelections([]);
              
              // Update payment type for future transactions
              setPaymentType(1);
              
              // Trigger callback
              if (onBatchComplete) {
                onBatchComplete(txHash);
              }
              
              return;
            }
          } catch (fallbackErr) {
            // If fallback also fails, show both errors
            console.error('Fallback transaction error:', fallbackErr);
            errorMsg = 'Sponsored transaction failed, and fallback to token payment also failed.';
          }
        } else {
          errorMsg = 'Sponsored transactions are currently disabled. Please select a token payment type.';
        }
        
        // Store this information for future reference
        localStorage.setItem('sponsoredPaymentsDisabled', 'true');
      } else if (errorMsg.includes('insufficient allowance')) {
        errorMsg = 'Insufficient token allowance for the selected token.';
      } else if (errorMsg.includes('insufficient balance')) {
        errorMsg = 'Insufficient token balance for gas payment.';
      }
      
      setError(errorMsg);
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Batch summary component
  const renderBatchSummary = () => {
    if (selections.length === 0) {
      return (
        <div className="empty-batch">
          <p>Add lottery tickets to your batch to create a combined transaction.</p>
        </div>
      );
    }
    
    return (
      <div className="batch-summary">
        <h4>Batch Transaction Summary</h4>
        
        <div className="selections-list">
          {selections.map((selection, index) => {
            const lottery = lotteries.find(l => l.id === selection.lotteryId);
            
            return (
              <div key={index} className="selection-item">
                <div className="selection-info">
                  <div className="lottery-name">
                    {lottery?.name || `Lottery #${selection.lotteryId}`}
                  </div>
                  <div className="selection-price">
                    ${lottery ? (lottery.ticketPrice * selection.quantity).toFixed(2) : 'N/A'}
                  </div>
                </div>
                
                <div className="selection-quantity">
                  <button 
                    className="quantity-btn"
                    onClick={() => handleUpdateQuantity(index, selection.quantity - 1)}
                    disabled={selection.quantity <= 1 || isProcessing}
                  >
                    -
                  </button>
                  <span className="quantity-value">{selection.quantity}</span>
                  <button 
                    className="quantity-btn"
                    onClick={() => handleUpdateQuantity(index, selection.quantity + 1)}
                    disabled={isProcessing}
                  >
                    +
                  </button>
                </div>
                
                <button 
                  className="remove-btn"
                  onClick={() => handleRemoveSelection(index)}
                  disabled={isProcessing}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
        
        <div className="batch-total">
          <span className="total-label">Total:</span>
          <span className="total-value">${totalCost.toFixed(2)}</span>
        </div>
        
        {selectedToken && paymentType !== 0 && (
          <div className="token-total">
            <span className="total-label">Token Amount:</span>
            <span className="total-value">
              {(totalCost / (selectedToken.usdPrice || 1)).toFixed(4)} {selectedToken.symbol}
            </span>
          </div>
        )}
      </div>
    );
  };
  
  // Payment options component
  const renderPaymentOptions = () => {
    return (
      <div className="payment-options">
        <h4>Payment Method</h4>
        
        <div className="payment-types">
          {/* Type 0 is now included as an option */}
          <div 
            className={`payment-type ${paymentType === 0 ? 'selected' : ''}`}
            onClick={() => handlePaymentTypeChange(0)}
          >
            <div className="radio-button">
              <div className={`radio-inner ${paymentType === 0 ? 'selected' : ''}`}></div>
            </div>
            <div className="payment-type-info">
              <div className="payment-type-name">Sponsored (Free)</div>
              <div className="payment-type-desc">Developer pays gas for you</div>
            </div>
          </div>
          
          <div 
            className={`payment-type ${paymentType === 1 ? 'selected' : ''}`}
            onClick={() => handlePaymentTypeChange(1)}
          >
            <div className="radio-button">
              <div className={`radio-inner ${paymentType === 1 ? 'selected' : ''}`}></div>
            </div>
            <div className="payment-type-info">
              <div className="payment-type-name">ERC20 Token (Prepay)</div>
              <div className="payment-type-desc">Pay gas with token upfront</div>
            </div>
          </div>
          
          <div 
            className={`payment-type ${paymentType === 2 ? 'selected' : ''}`}
            onClick={() => handlePaymentTypeChange(2)}
          >
            <div className="radio-button">
              <div className={`radio-inner ${paymentType === 2 ? 'selected' : ''}`}></div>
            </div>
            <div className="payment-type-info">
              <div className="payment-type-name">ERC20 Token (Postpay)</div>
              <div className="payment-type-desc">Pay gas with token after execution</div>
            </div>
          </div>
        </div>
        
        {/* Warning for Type 0 */}
        {showSponsoredWarning && (
          <div className="payment-type-warning">
            <div className="warning-icon">⚠️</div>
            <div className="warning-text">
              Sponsored transactions may not be available on testnet. If this fails, your transaction will automatically try using token payment instead.
            </div>
          </div>
        )}
        
        {/* Token selection for non-zero payment types */}
        {(paymentType === 1 || paymentType === 2) && (
          <div className="token-selection">
            <label>Select Token for Gas:</label>
            <select 
              value={selectedToken?.address} 
              onChange={handleTokenChange}
              disabled={isProcessing}
            >
              {tokens.map(token => (
                <option key={token.address} value={token.address}>
                  {token.symbol} ({parseFloat(token.balance).toFixed(2)})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    );
  };
  
  // Available lotteries component
  const renderAvailableLotteries = () => {
    if (lotteries.length === 0) {
      return (
        <div className="no-lotteries">
          <p>No active lotteries available.</p>
        </div>
      );
    }
    
    return (
      <div className="available-lotteries">
        <h4>Available Lotteries</h4>
        
        <div className="lotteries-list">
          {lotteries.map(lottery => (
            <div key={lottery.id} className="lottery-item">
              <div className="lottery-info">
                <div className="lottery-name">{lottery.name}</div>
                <div className="lottery-price">${lottery.ticketPrice}</div>
              </div>
              
              <div className="lottery-actions">
                <button 
                  className="add-btn"
                  onClick={() => handleAddSelection(lottery.id, 1)}
                  disabled={isProcessing}
                >
                  Add 1
                </button>
                <button 
                  className="add-btn"
                  onClick={() => handleAddSelection(lottery.id, 5)}
                  disabled={isProcessing}
                >
                  Add 5
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };
  
  // Batch execution button component
  const renderExecuteButton = () => {
    // If wallet is not deployed, show deploy button
    if (aaWalletAddress && !isDeployed && !isDevelopmentMode) {
      return (
        <div className="deploy-wallet-section">
          <div className="warning-message">
            Your smart contract wallet needs to be deployed for the best experience. This is a one-time setup.
          </div>
          <button 
            className="deploy-button"
            onClick={handleDeployWallet}
            disabled={isDeployingWallet}
          >
            {isDeployingWallet ? 'Deploying Wallet...' : 'Deploy Wallet First'}
          </button>
          <div className="deploy-note">
            <div className="note-icon">ℹ️</div>
            <div className="note-text">
              This one-time setup requires a small amount of NERO tokens.
            </div>
          </div>
          
          <button 
            className="execute-button continue-anyway"
            onClick={handleExecuteBatch}
            disabled={isProcessing || selections.length === 0}
          >
            Continue Without Deploying
          </button>
        </div>
      );
    }
    
    return (
      <div className="execute-section">
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
        
        <button 
          className="execute-button"
          onClick={handleExecuteBatch}
          disabled={isProcessing || selections.length === 0}
        >
          {isProcessing ? 'Processing...' : `Execute Batch (${selections.length} operations)`}
        </button>
        
        <div className="batch-note">
          <div className="note-icon">ℹ️</div>
          <div className="note-text">
            Batch transactions save gas and allow executing multiple operations in a single transaction.
            {hasActiveSessionKey && ' Using Quick Play for faster execution.'}
          </div>
        </div>
      </div>
    );
  };
  
  return (
    <div className="batch-operations-container">
      <div className="batch-operations-header">
        <h3>Batch Operations</h3>
        <div className="batch-subtitle">
          Execute multiple lottery ticket purchases in a single transaction
        </div>
      </div>
      
      <div className="batch-content">
        <div className="batch-column">
          {renderAvailableLotteries()}
        </div>
        
        <div className="batch-column">
          {renderBatchSummary()}
          
          {selections.length > 0 && (
            <>
              {renderPaymentOptions()}
              {renderExecuteButton()}
            </>
          )}
        </div>
      </div>
      
      <div className="batch-footer">
        <div className="aa-logo">
          <span className="aa-icon">⚡</span>
          <span className="aa-text">Powered by NERO Chain Account Abstraction</span>
        </div>
      </div>
    </div>
  );
};

export default BatchOperations;