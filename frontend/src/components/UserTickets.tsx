import React from 'react';

/**
 * Component to display the user's ticket list.
 * @param {Object} props
 * @param {Array} props.tickets - Ticket array.
 * @param {Object} props.lottery - Lottery object.
 */
const UserTickets = ({ tickets = [], lottery }) => {
  if (!lottery) {
    return null;
  }

  const formatTokenAddress = (address) => {
    if (!address) return 'Unknown';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  return (
    <div className="user-tickets">
      <div className="tickets-header">
        <h3>Your Tickets</h3>
        <span className="tickets-count">{tickets.length} tickets</span>
      </div>

      {tickets.length === 0 ? (
        <div className="no-tickets">
          <p>You don't have any tickets for this lottery yet.</p>
        </div>
      ) : (
        <div className="tickets-list">
          {tickets.map((ticket, index) => (
            <div key={ticket.ticketNumber || index} className="ticket-item">
              <div className="ticket-number">
                #{ticket.ticketNumber || index + 1}
              </div>
              <div className="ticket-details">
                <div className="detail-row">
                  <span>Lottery:</span>
                  <span>{lottery.name}</span>
                </div>
                <div className="detail-row">
                  <span>Payment Token:</span>
                  <span>{formatTokenAddress(ticket.paymentToken)}</span>
                </div>
                {ticket.amountPaid && (
                  <div className="detail-row">
                    <span>Amount Paid:</span>
                    <span>{ticket.amountPaid}</span>
                  </div>
                )}
                {ticket.purchaseDate && (
                  <div className="detail-row">
                    <span>Purchase Date:</span>
                    <span>{formatDate(ticket.purchaseDate)}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tickets.length > 0 && lottery.drawn && (
        <div className="ticket-status">
          {lottery.winningTickets && 
           tickets.some(ticket => lottery.winningTickets.includes(ticket.ticketNumber)) ? (
            <div className="winning-status">
              <span className="status-icon">🎉</span>
              <span>You have winning tickets!</span>
            </div>
          ) : (
            <div className="losing-status">
              <span className="status-icon">😔</span>
              <span>None of your tickets won this time.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UserTickets;