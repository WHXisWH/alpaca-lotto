import React from 'react';
import formatUtils from '../utils/formatUtils';

/**
 * Component to display the details of a lottery.
 * @param {Object} props
 * @param {Object} props.lottery - The lottery object.
 * @param {Array} props.userTickets - The user's ticket array.
 */
const LotteryDetails = ({ lottery, userTickets = [] }) => {
  if (!lottery) {
    return (
      <div className="lottery-details-empty">
        <p>Select a lottery to view details</p>
      </div>
    );
  }

  const formatDateTime = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp * 1000).toLocaleString();
  };

  const formatTokenAddress = (address) => {
    return formatUtils.formatAddress(address);
  };

  // Calculate ticket price as ethers using the utility function
  const ticketPrice = lottery?.ticketPrice ? formatUtils.formatUnits(lottery.ticketPrice, 18) : '0';
  
  // Calculate prize pool using the utility function
  const prizePool = lottery.prizePool ? 
  (typeof lottery.prizePool === 'string' ? 
    formatUtils.formatUnits(lottery.prizePool, 18) : 
    lottery.prizePool.toString()) : 
  '0';

  return (
    <div className="lottery-details">
      <div className="details-header">
        <h2>{lottery.name || 'Unnamed Lottery'}</h2>
        {lottery.drawn && <span className="completed-badge">Draw Complete</span>}
      </div>

      <div className="prize-section">
        <div className="prize-amount">{prizePool} ETH</div>
        <div className="prize-label">Total Prize Pool</div>
      </div>

      <div className="details-section">
        <h3>Lottery Information</h3>
        <div className="detail-row">
          <span className="detail-label">Ticket Price:</span>
          <span className="detail-value">
            {ticketPrice} ETH
          </span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Total Tickets:</span>
          <span className="detail-value">{lottery.totalTickets || 0}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Start Time:</span>
          <span className="detail-value">{formatDateTime(lottery.startTime)}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">End Time:</span>
          <span className="detail-value">{formatDateTime(lottery.endTime)}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Draw Time:</span>
          <span className="detail-value">{formatDateTime(lottery.drawTime)}</span>
        </div>
      </div>

      <div className="user-tickets-section">
        <h3>Your Tickets</h3>
        <div className="tickets-count">
          You own {userTickets.length} tickets in this lottery
        </div>
        {userTickets.length > 0 && (
          <div className="tickets-list">
            {userTickets.slice(0, 5).map((ticket, index) => (
              <div key={ticket.ticketNumber || index} className="ticket-item">
                <span className="ticket-number">#{ticket.ticketNumber || index + 1}</span>
                <span className="ticket-token">
                  {ticket.paymentToken ? formatTokenAddress(ticket.paymentToken) : 'Unknown'}
                </span>
              </div>
            ))}
            {userTickets.length > 5 && (
              <div className="more-tickets">
                + {userTickets.length - 5} more tickets
              </div>
            )}
          </div>
        )}
      </div>

      {lottery.drawn && (
        <div className="winner-section">
          <h3>Winning Numbers</h3>
          {lottery.winningTickets && lottery.winningTickets.length > 0 ? (
            <div className="winning-numbers">
              {lottery.winningTickets.map((ticketNumber, index) => (
                <span key={index} className="winning-number">#{ticketNumber}</span>
              ))}
            </div>
          ) : (
            <p>No winning numbers available</p>
          )}
        </div>
      )}

      <div className="supported-tokens-section">
        <h3>Supported Tokens</h3>
        {lottery.supportedTokens && lottery.supportedTokens.length > 0 ? (
          <div className="tokens-list">
            {lottery.supportedTokens.map((token, index) => (
              <span key={index} className="token-tag">
                {formatTokenAddress(token)}
              </span>
            ))}
          </div>
        ) : (
          <p>No information about supported tokens</p>
        )}
      </div>
    </div>
  );
};

export default LotteryDetails;