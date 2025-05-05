import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import useSessionKeys from '../hooks/useSessionKeys';
import useUserOp from '../hooks/useUserOp';
import useTokens from '../hooks/useTokens';
import useWagmiWallet from '../hooks/useWagmiWallet';

/**
 * QuickPlay Component
 * 
 * This component demonstrates NERO Chain's Session Key Account Abstraction feature,
 * allowing users to purchase multiple lottery tickets with a single signature.
 * 
 * @param {Object} props
 * @param {Object} props.lottery - Lottery data
 * @param {Function} props.onPurchaseComplete - Callback after purchase
 */
const QuickPlay = ({ lottery, onPurchaseComplete }) => {
  const { address, isConnected } = useAccount();
  const { isDevelopmentMode } = useWagmiWallet();
  
  const {
    hasActiveSessionKey,
    sessionKeyDetails,
    isLoading: sessionKeyLoading,
    error: sessionKeyError,
    createSessionKey,
    revokeSessionKey,
    getTimeRemaining,
  } = useSessionKeys();
  
  const {
    executeTicketPurchase,
    isLoading: userOpLoading,
    error: userOpError
  } = useUserOp();
  
  const { tokens } = useTokens();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sessionDuration, setSessionDuration] = useState(30); // 30 minutes by default
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseHistory, setPurchaseHistory] = useState([]);
  const [selectedToken, setSelectedToken] = useState(null);
  const [purchaseQuantity, setPurchaseQuantity] = useState(1);
  const [error, setError] = useState(null);
  
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
  
  // Format time remaining in minutes:seconds
  const formatTimeRemaining = () => {
    const seconds = getTimeRemaining();
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  // Open session key creation modal
  const handleOpenModal = () => {
    setIsModalOpen(true);
    setError(null);
  };
  
  // Close session key creation modal
  const handleCloseModal = () => {
    setIsModalOpen(false);
  };
  
  // Create session key
  const handleCreateSessionKey = async () => {
    if (!isConnected && !isDevelopmentMode) {
      setError('Wallet not connected');
      return;
    }
    
    setIsCreatingKey(true);
    setError(null);
    
    try {
      // Convert minutes to seconds
      const durationInSeconds = sessionDuration * 60;
      
      // Create session key
      const success = await createSessionKey(durationInSeconds);
      
      if (success) {
        setIsModalOpen(false);
      } else {
        setError('Failed to create session key');
      }
    } catch (err) {
      console.error('Session key creation error:', err);
      setError(err.message || 'Error creating session key');
    } finally {
      setIsCreatingKey(false);
    }
  };
  
  // Purchase tickets using session key
  const handlePurchaseTickets = async () => {
    if (!lottery || !selectedToken) {
      setError('Missing lottery or token information');
      return;
    }
    
    if (!hasActiveSessionKey && !isDevelopmentMode) {
      setError('No active session key. Please enable Quick Play first.');
      return;
    }
    
    setIsPurchasing(true);
    setError(null);
    
    try {
      // Execute ticket purchase with session key
      const txHash = await executeTicketPurchase({
        lotteryId: lottery.id,
        tokenAddress: selectedToken.address,
        quantity: purchaseQuantity,
        paymentType: 0, // Use sponsored gas for simplicity
        useSessionKey: hasActiveSessionKey
      });
      
      // Add to purchase history
      setPurchaseHistory([
        ...purchaseHistory,
        {
          timestamp: Date.now(),
          lotteryId: lottery.id,
          quantity: purchaseQuantity,
          token: selectedToken.symbol,
          txHash
        }
      ]);
      
      // Reset quantity
      setPurchaseQuantity(1);
      
      // Callback if provided
      if (onPurchaseComplete) {
        onPurchaseComplete(txHash);
      }
      
      // Success notification
      console.log('Ticket purchase successful:', txHash);
    } catch (err) {
      console.error('Ticket purchase error:', err);
      setError(err.message || 'Error purchasing tickets');
    } finally {
      setIsPurchasing(false);
    }
  };
  
  // Handle token selection
  const handleTokenChange = (event) => {
    const tokenAddress = event.target.value;
    const token = tokens.find(t => t.address === tokenAddress);
    setSelectedToken(token);
  };
  
  // Handle quantity change
  const handleQuantityChange = (value) => {
    const newQuantity = Math.max(1, value);
    setPurchaseQuantity(newQuantity);
  };
  
  // Token selector component
  const renderTokenSelector = () => {
    if (tokens.length === 0) {
      return <div className="no-tokens">No tokens available</div>;
    }
    
    return (
      <select 
        value={selectedToken?.address} 
        onChange={handleTokenChange}
        disabled={isPurchasing}
        className="token-selector"
      >
        {tokens.map(token => (
          <option key={token.address} value={token.address}>
            {token.symbol} ({parseFloat(token.balance).toFixed(2)})
          </option>
        ))}
      </select>
    );
  };
  
  // Quantity controls component
  const renderQuantityControls = () => {
    return (
      <div className="quantity-controls">
        <button 
          onClick={() => handleQuantityChange(purchaseQuantity - 1)}
          disabled={purchaseQuantity <= 1 || isPurchasing}
          className="quantity-button"
        >
          -
        </button>
        <input
          type="number"
          min="1"
          value={purchaseQuantity}
          onChange={(e) => handleQuantityChange(parseInt(e.target.value))}
          disabled={isPurchasing}
          className="quantity-input"
        />
        <button 
          onClick={() => handleQuantityChange(purchaseQuantity + 1)}
          disabled={isPurchasing}
          className="quantity-button"
        >
          +
        </button>
      </div>
    );
  };
  
  // Session key modal component
  const renderSessionKeyModal = () => {
    if (!isModalOpen) return null;
    
    return (
      <div className="modal-overlay">
        <div className="session-key-modal">
          <div className="modal-header">
            <h3>Enable Quick Play</h3>
            <button 
              className="close-button"
              onClick={handleCloseModal}
              disabled={isCreatingKey}
            >
              ×
            </button>
          </div>
          
          <div className="modal-content">
            <div className="info-section">
              <div className="info-icon">🔑</div>
              <p>
                Quick Play allows you to purchase multiple lottery tickets without having to
                sign each transaction separately. You'll sign once to create a temporary
                session key that's valid for a limited time.
              </p>
            </div>
            
            <div className="duration-section">
              <label>Session Duration:</label>
              <div className="duration-input">
                <input 
                  type="number" 
                  min="5" 
                  max="120" 
                  value={sessionDuration}
                  onChange={(e) => setSessionDuration(parseInt(e.target.value))}
                  disabled={isCreatingKey}
                />
                <span className="input-label">minutes</span>
              </div>
              
              <div className="duration-presets">
                <button 
                  onClick={() => setSessionDuration(15)}
                  className={sessionDuration === 15 ? 'active' : ''}
                  disabled={isCreatingKey}
                >
                  15m
                </button>
                <button 
                  onClick={() => setSessionDuration(30)}
                  className={sessionDuration === 30 ? 'active' : ''}
                  disabled={isCreatingKey}
                >
                  30m
                </button>
                <button 
                  onClick={() => setSessionDuration(60)}
                  className={sessionDuration === 60 ? 'active' : ''}
                  disabled={isCreatingKey}
                >
                  1h
                </button>
                <button 
                  onClick={() => setSessionDuration(120)}
                  className={sessionDuration === 120 ? 'active' : ''}
                  disabled={isCreatingKey}
                >
                  2h
                </button>
              </div>
            </div>
            
            <div className="security-note">
              <div className="note-icon">🔒</div>
              <div className="note-text">
                <strong>Security Note:</strong> Session keys can only be used for lottery ticket purchases
                and expire automatically. You can revoke them at any time.
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
              className="cancel-button"
              onClick={handleCloseModal}
              disabled={isCreatingKey}
            >
              Cancel
            </button>
            <button 
              className="create-button"
              onClick={handleCreateSessionKey}
              disabled={isCreatingKey}
            >
              {isCreatingKey ? 'Creating...' : 'Enable Quick Play'}
            </button>
          </div>
        </div>
      </div>
    );
  };
  
  // Purchase history component
  const renderPurchaseHistory = () => {
    if (purchaseHistory.length === 0) return null;
    
    return (
      <div className="purchase-history">
        <h4>Recent Quick Play Purchases</h4>
        <div className="history-list">
          {purchaseHistory.map((purchase, index) => (
            <div key={index} className="history-item">
              <div className="history-time">
                {new Date(purchase.timestamp).toLocaleTimeString()}
              </div>
              <div className="history-details">
                {purchase.quantity} ticket(s) for Lottery #{purchase.lotteryId}
              </div>
              <div className="history-token">
                {purchase.token}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };
  
  return (
    <div className="quick-play-container">
      <div className="quick-play-header">
        <h3>Quick Play</h3>
        {hasActiveSessionKey && (
          <div className="session-indicator">
            <span className="active-dot"></span>
            <span className="time-remaining">
              {formatTimeRemaining()} remaining
            </span>
          </div>
        )}
      </div>
      
      {!hasActiveSessionKey ? (
        <div className="enable-quick-play">
          <p>
            Enable Quick Play to purchase multiple tickets with a single signature.
          </p>
          <button 
            className="enable-button"
            onClick={handleOpenModal}
            disabled={sessionKeyLoading}
          >
            {sessionKeyLoading ? 'Enabling...' : 'Enable Quick Play'}
          </button>
          
          {sessionKeyError && (
            <div className="error-message">
              {sessionKeyError}
            </div>
          )}
        </div>
      ) : (
        <div className="quick-play-active">
          <div className="purchase-form">
            <div className="form-row">
              <label>Token:</label>
              {renderTokenSelector()}
            </div>
            
            <div className="form-row">
              <label>Tickets:</label>
              {renderQuantityControls()}
            </div>
            
            <div className="form-row total-row">
              <label>Total:</label>
              <div className="total-amount">
                {selectedToken && (
                  <span>
                    {(lottery.ticketPrice * purchaseQuantity).toFixed(2)} USD
                    ({(lottery.ticketPrice * purchaseQuantity / (selectedToken.usdPrice || 1)).toFixed(4)} {selectedToken.symbol})
                  </span>
                )}
              </div>
            </div>
            
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}
            
            <button 
              className="purchase-button"
              onClick={handlePurchaseTickets}
              disabled={isPurchasing || !selectedToken}
            >
              {isPurchasing ? 'Purchasing...' : `Buy ${purchaseQuantity} Ticket${purchaseQuantity !== 1 ? 's' : ''}`}
            </button>
            
            <div className="gas-note">
              <strong>Note:</strong> Gas fees are sponsored for Quick Play purchases.
            </div>
          </div>
          
          {renderPurchaseHistory()}
          
          <div className="quick-play-footer">
            <button 
              className="revoke-button"
              onClick={revokeSessionKey}
              disabled={sessionKeyLoading}
            >
              Disable Quick Play
            </button>
          </div>
        </div>
      )}
      
      {renderSessionKeyModal()}
    </div>
  );
};

export default QuickPlay;