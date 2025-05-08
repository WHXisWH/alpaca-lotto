import React from 'react';
import formatUtils from '../utils/formatUtils';

/**
 * Component to display the list of active lotteries.
 * @param {Object} props
 * @param {Array} props.lotteries - Array of lotteries.
 * @param {boolean} props.isLoading - Loading state.
 * @param {Function} props.onSelect - Callback for when a lottery is selected.
 * @param {number} props.selectedId - ID of the selected lottery.
 */
const ActiveLotteries = ({ lotteries = [], isLoading = false, onSelect, selectedId }) => {
  // Display during loading.
  if (isLoading) {
    return (
      <div className="active-lotteries loading">
        <div className="loading-spinner"></div>
        <p>Loading lotteries...</p>
      </div>
    );
  }

  // Display when no lotteries exist.
  if (lotteries.length === 0) {
    return (
      <div className="active-lotteries empty">
        <p>No active lotteries at the moment.</p>
      </div>
    );
  }

  // Format the end time.
  const formatEndTime = (endTime) => {
    if (!endTime) return 'N/A';
    const date = new Date(endTime * 1000);
    return date.toLocaleString();
  };

  // Calculate the timer progress.
  const calculateProgress = (startTime, endTime) => {
    const now = Math.floor(Date.now() / 1000);
    
    // Ensure we have valid numeric values
    const start = typeof startTime === 'number' ? startTime : parseInt(startTime) || 0;
    const end = typeof endTime === 'number' ? endTime : parseInt(endTime) || 0;
    
    const total = end - start;
    const remaining = end - now;
    
    if (remaining <= 0) return 100;
    if (remaining >= total) return 0;
    
    return ((total - remaining) / total) * 100;
  };

  return (
    <div className="active-lotteries">
      <h2>Active Lotteries</h2>
      <div className="lotteries-list">
        {lotteries.map((lottery) => {
          // Safely format ticket price using the utility
          const ticketPrice = formatUtils.formatUnits(lottery.ticketPrice, 18);
          
          // Safely format prize pool using the utility  
          const prizePool = formatUtils.formatUnits(lottery.prizePool, 18);
          
          return (
            <div
              key={lottery.id}
              className={`lottery-card ${selectedId === lottery.id ? 'selected' : ''}`}
              onClick={() => onSelect && onSelect(lottery)}
            >
              <div className="lottery-header">
                <h3>{lottery.name || 'Unnamed Lottery'}</h3>
                {lottery.drawn && <span className="completed-badge">Completed</span>}
              </div>
              
              <div className="lottery-details">
                <div className="detail-row">
                  <span className="detail-label">Ticket Price:</span>
                  <span className="detail-value">
                    {ticketPrice} ETH
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Prize Pool:</span>
                  <span className="prize-amount">
                    {prizePool} ETH
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Tickets Sold:</span>
                  <span className="detail-value">
                    {lottery.totalTickets ? lottery.totalTickets.toString() : '0'}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Ends At:</span>
                  <span className="detail-value">{formatEndTime(lottery.endTime)}</span>
                </div>
              </div>
              
              {!lottery.drawn && (
                <div className="lottery-timer">
                  <div className="timer-bar">
                    <div
                      className="timer-progress"
                      style={{ width: `${calculateProgress(lottery.startTime, lottery.endTime)}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ActiveLotteries;