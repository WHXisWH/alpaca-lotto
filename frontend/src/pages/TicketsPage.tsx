import React, { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import useLotteries from '../hooks/useLotteries';
import useWagmiWallet from '../hooks/useWagmiWallet';
import { Link } from 'react-router-dom';
import formatUtils from '../utils/formatUtils';

const TicketsPage = () => {
  const { address, isConnected } = useAccount();
  const { isDevelopmentMode } = useWagmiWallet();
  const { lotteries, userTickets, fetchLotteries, fetchAllUserTickets, isLoading } = useLotteries();
  const [ticketsLoaded, setTicketsLoaded] = useState(false);

  // 初期ロード時に全チケットを取得
  useEffect(() => {
    const loadData = async () => {
      try {
        if (lotteries.length === 0) {
          await fetchLotteries();
        }
        await fetchAllUserTickets();
        setTicketsLoaded(true);
      } catch (err) {
        console.error('Error loading tickets data:', err);
      }
    };

    if ((isConnected || isDevelopmentMode) && !ticketsLoaded) {
      loadData();
    }
  }, [isConnected, isDevelopmentMode, lotteries.length, fetchLotteries, fetchAllUserTickets, ticketsLoaded]);

  // ユーザーが所有する全チケットを集計
  const getAllTickets = () => {
    const allTickets = [];
    Object.entries(userTickets).forEach(([lotteryId, tickets]) => {
      const lottery = lotteries.find(l => l.id === parseInt(lotteryId));
      if (lottery && tickets && tickets.length > 0) {
        tickets.forEach(ticket => {
          allTickets.push({
            ...ticket,
            lotteryName: lottery.name,
            lotteryDrawn: lottery.drawn
          });
        });
      }
    });
    return allTickets;
  };

  const allUserTickets = getAllTickets();

  if (!isConnected && !isDevelopmentMode) {
    return (
      <div className="tickets-page-empty">
        <h2>My Tickets</h2>
        <p>Please connect your wallet to view your tickets.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading your tickets...</p>
      </div>
    );
  }

  return (
    <div className="tickets-page">
      <h2>My Tickets</h2>
      
      {allUserTickets.length === 0 ? (
        <div className="no-tickets">
          <p>You don't have any tickets yet.</p>
          <Link to="/" className="buy-tickets-link">Buy Tickets</Link>
        </div>
      ) : (
        <div className="tickets-list">
          {allUserTickets.map((ticket, index) => (
            <div key={`${ticket.lotteryId}-${ticket.ticketNumber}-${index}`} className="ticket-card">
              <div className="ticket-header">
                <span className="ticket-number">Ticket #{ticket.ticketNumber}</span>
                <span className={`ticket-status ${ticket.lotteryDrawn ? 'drawn' : 'active'}`}>
                  {ticket.lotteryDrawn ? 'Drawn' : 'Active'}
                </span>
              </div>
              
              <div className="ticket-details">
                <div className="detail-row">
                  <span className="detail-label">Lottery:</span>
                  <span className="detail-value">{ticket.lotteryName}</span>
                </div>
                
                <div className="detail-row">
                  <span className="detail-label">Payment:</span>
                  <span className="detail-value">
                    {formatUtils.formatTokenAmount(ticket.amountPaid, 18)}
                  </span>
                </div>
                
                <div className="detail-row">
                  <span className="detail-label">Token:</span>
                  <span className="detail-value">
                    {formatUtils.formatAddress(ticket.paymentToken)}
                  </span>
                </div>
              </div>
              
              <div className="ticket-actions">
                <Link to={`/?lottery=${ticket.lotteryId}`} className="view-lottery-link">
                  View Lottery
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TicketsPage;