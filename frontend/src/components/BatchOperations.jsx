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
 */
const BatchOperations = ({ lotteries = [], onBatchComplete }) => {
  const { address, isConnected } = useAccount();
  const { hasActiveSessionKey } = useSessionKeys();
  
  const {
    aaWalletAddress,
    isDeployed,
    needsNeroTokens,
    executeBatchPurchase,
    deployOrWarn,
    checkTokenApproval,
    isLoading: userOpLoading,
    error: userOpError
  } = useUserOp();
  
  const { tokens, getSupportedTokensOnly } = useTokens();
  
  const [selections, setSelections] = useState([]);
  const [selectedToken, setSelectedToken] = useState(null);
  const [paymentType, setPaymentType] = useState(0); // Default to sponsored (Type 0)
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [totalCost, setTotalCost] = useState(0);
  const [skipTokenApproval, setSkipTokenApproval] = useState(false);
  const [txHash, setTxHash] = useState(null);
  const [deploymentSuccess, setDeploymentSuccess] = useState(false);
  
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
    // Check if token approval should be skipped based on wallet deployment
    const checkApprovalRequirement = async () => {
      if (selectedToken && !isDeployed && (paymentType === 1 || paymentType === 2)) {
        try {
          const isApproved = await checkTokenApproval(selectedToken.address);
          setSkipTokenApproval(!isApproved && !isDeployed);
        } catch (err) {
          console.warn("Error checking token approval:", err);
          setSkipTokenApproval(true);
        }
      } else {
        setSkipTokenApproval(false);
      }
    };
    
    checkApprovalRequirement();
  }, [paymentType, isDeployed, selectedToken, checkTokenApproval]);
  
  // Reset deployment success message after 5 seconds
  useEffect(() => {
    if (deploymentSuccess) {
      const timer = setTimeout(() => {
        setDeploymentSuccess(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [deploymentSuccess]);
  
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

  // Handle deployment
  const handleDeployWallet = async () => {
    try {
      await deployOrWarn();
      setDeploymentSuccess(true);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to deploy wallet');
    }
  };
  
  // Execute batch operation with deployment check
  const handleExecuteBatch = async () => {
    if (!isConnected) {
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
      // Use executeBatchPurchase with proper paymentType and paymentToken
      const txHash = await executeBatchPurchase({
        selections,
        paymentType,  // User-selected payment type
        paymentToken: selectedToken?.address, // Token for gas payment (if needed)
        useSessionKey: hasActiveSessionKey
      });
        
      setTxHash(txHash);
      setError(null);
      setSelections([]);
        
      if (onBatchComplete) {
        onBatchComplete(txHash);
      }
        
      setIsProcessing(false);
    } catch (err) {
      console.error('Batch operation error:', err);
        
      let errorMsg = err.message || 'Error executing batch operation';
      setError(errorMsg);
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
          {/* Type 0 - Sponsored (Free) */}
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
          
          {/* Type 1 - Prepay with ERC20 */}
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
          
          {/* Type 2 - Postpay with ERC20 */}
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
        
        {/* Token selection for Type 1 & 2 */}
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
  
  // Batch execution button component with deploy option
  const renderExecuteButton = () => {
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