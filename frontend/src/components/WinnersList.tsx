import React from 'react';

/**
 * Component to display the list of winners.
 * @param {Object} props
 * @param {Object} props.lottery - The lottery object.
 */
const WinnersList = ({ lottery }) => {
  if (!lottery || !lottery.drawn) {
    return null;
  }

  const formatAddress = (address) => {
    if (!address) return 'Unknown';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const calculatePrizeAmount = (winners) => {
    if (!winners || winners.length === 0) return 0;
    return lottery.prizePool / winners.length;
  };

  return (
    <div className="winners-list">
      <h2>Winners</h2>
      
      {!lottery.winners || lottery.winners.length === 0 ? (
        <div className="no-winners">
          <p>No winners have been determined yet.</p>
        </div>
      ) : (
        <>
          <div className="prize-info">
            <div className="total-prize">
              <span className="label">Total Prize Pool:</span>
              <span className="amount">${lottery.prizePool || 0}</span>
            </div>
            <div className="prize-per-winner">
              <span className="label">Prize per Winner:</span>
              <span className="amount">${calculatePrizeAmount(lottery.winners).toFixed(2)}</span>
            </div>
          </div>

          <div className="winners-table">
            <div className="table-header">
              <div className="column">Rank</div>
              <div className="column">Address</div>
              <div className="column">Winning Ticket</div>
              <div className="column">Prize</div>
            </div>
            
            {lottery.winners.map((winner, index) => (
              <div key={`${winner}-${index}`} className="winner-row">
                <div className="column rank">#{index + 1}</div>
                <div className="column address">{formatAddress(winner)}</div>
                <div className="column ticket">
                  #{lottery.winningTickets && lottery.winningTickets[index] 
                    ? lottery.winningTickets[index]
                    : 'N/A'}
                </div>
                <div className="column prize">
                  ${calculatePrizeAmount(lottery.winners).toFixed(2)}
                </div>
              </div>
            ))}
          </div>

          <div className="claim-info">
            <p>Winners have {lottery.timeUntilClaim || '7 days'} to claim their prizes.</p>
          </div>
        </>
      )}
    </div>
  );
};

export default WinnersList;