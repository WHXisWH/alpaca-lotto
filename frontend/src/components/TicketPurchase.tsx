import React from 'react';
import PaymentOptimizer from './PaymentOptimizer';
import formatUtils from '../utils/formatUtils';

/**
 * Ticket purchase modal component.
 * @param {Object} props
 * @param {Object} props.lottery - Lottery object.
 * @param {Array} props.tokens - Array of available tokens.
 * @param {Object} props.recommendation - AI recommendation info.
 * @param {boolean} props.isLoading - Loading state.
 * @param {number} props.quantity - Number of tickets.
 * @param {Function} props.onQuantityChange - Handler for quantity change.
 * @param {Function} props.onPurchase - Handler for purchase execution.
 * @param {Function} props.onClose - Handler for closing the modal.
 * @param {boolean} props.hasSessionKey - Whether a session key exists.
 */
const TicketPurchase = ({
  lottery,
  tokens = [],
  recommendation,
  isLoading = false,
  quantity = 1,
  onQuantityChange,
  onPurchase,
  onClose,
  hasSessionKey = false
}) => {
  const [selectedToken, setSelectedToken] = React.useState(null);

  // Update selected token when recommendation or tokens change
  React.useEffect(() => {
    if (recommendation?.recommendedToken) {
      setSelectedToken(recommendation.recommendedToken);
    } else if (tokens.length > 0) {
      // Only set if no token is selected yet
      setSelectedToken((prev) => prev ?? tokens[0]);
    }
  }, [recommendation, tokens]); // Removed selectedToken from dependencies to prevent infinite loops

  // Return null if lottery data is missing
  if (!lottery) {
    return null;
  }

  // Format ticket price using the utility function
  const ticketPrice = formatUtils.formatUnits(lottery.ticketPrice, 18);

  // Calculate the total amount.
  const calculateTotal = () => {
    // Parse ticket price and handle BigNumber
    let price;
    try {
      // Try to convert to a number safely
      price = parseFloat(ticketPrice);
      if (isNaN(price)) {
        price = 0;
      }
    } catch (e) {
      console.error("Error parsing ticket price:", e);
      price = 0;
    }
    
    return (price * quantity).toFixed(2);
  };

  // Handlers for increasing/decreasing quantity.
  const handleIncrease = () => {
    if (onQuantityChange) {
      onQuantityChange(quantity + 1);
    }
  };

  const handleDecrease = () => {
    if (quantity > 1 && onQuantityChange) {
      onQuantityChange(quantity - 1);
    }
  };

  // Handler for executing the purchase.
  const handlePurchase = () => {
    if (selectedToken && onPurchase) {
      onPurchase(selectedToken);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="ticket-purchase-modal">
        <div className="modal-header">
          <h2>Purchase Tickets</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-content">
          <div className="lottery-info">
            <h3>{lottery.name}</h3>
            <div className="ticket-price">
              Ticket Price: {ticketPrice} ETH
            </div>
          </div>

          <div className="quantity-section">
            <label>Number of Tickets:</label>
            <div className="quantity-controls">
              <button 
                className="quantity-button"
                onClick={handleDecrease}
                disabled={quantity <= 1}
              >
                -
              </button>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => {
                  const newQuantity = parseInt(e.target.value, 10);
                  if (!isNaN(newQuantity) && newQuantity > 0 && onQuantityChange) {
                    onQuantityChange(newQuantity);
                  }
                }}
              />
              <button 
                className="quantity-button"
                onClick={handleIncrease}
              >
                +
              </button>
            </div>
          </div>

          <PaymentOptimizer
           onSelect={(opt) => setSelectedToken(opt.token)}
           autoSelectRecommended={true}
          />

          <div className="purchase-summary">
            <h3>Purchase Summary</h3>
            <div className="summary-row">
              <span>Tickets:</span>
              <span>{quantity}</span>
            </div>
            <div className="summary-row">
              <span>Price per ticket:</span>
              <span>{ticketPrice} ETH</span>
            </div>
            <div className="summary-row total">
              <span>Total:</span>
              <span>{calculateTotal()} ETH</span>
            </div>
            {selectedToken && (
              <div className="summary-row">
                <span>Payment Token:</span>
                <span className="token-value">
                  <span className="token-icon">{selectedToken.symbol.charAt(0)}</span>
                  {selectedToken.symbol}
                  {recommendation && recommendation.recommendedToken.address === selectedToken.address && (
                    <span className="ai-badge">AI Recommended</span>
                  )}
                </span>
              </div>
            )}
          </div>

          {hasSessionKey && (
            <div className="quick-play-notice">
              <span className="notice-icon">🔑</span>
              <span className="notice-text">
                Quick Play is enabled - No wallet confirmation needed!
              </span>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button 
            className="cancel-button"
            onClick={onClose}
          >
            Cancel
          </button>
          <button 
            className="purchase-button"
            onClick={handlePurchase}
            disabled={!selectedToken || isLoading}
          >
            {isLoading ? 'Processing...' : 'Purchase Tickets'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TicketPurchase;