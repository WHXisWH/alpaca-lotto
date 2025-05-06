import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi'; // Using wagmi's useAccount hook
import ActiveLotteries from '../components/ActiveLotteries';
import LotteryDetails from '../components/LotteryDetails';
import TicketPurchase from '../components/TicketPurchase';
import SessionKeyModal from '../components/SessionKeyModal';
import useWagmiWallet from '../hooks/useWagmiWallet'; // Using our new wagmi wallet hook
import useTokens from '../hooks/useTokens';
import useLotteries from '../hooks/useLotteries';
import useSessionKeys from '../hooks/useSessionKeys';
import { api } from '../services/api';

/**
 * Home page of the application
 * Updated to use wagmi hooks
 */
const HomePage = () => {
  const navigate = useNavigate();
  
  // Using wagmi hooks
  const { address, isConnected } = useAccount();
  const { isDevelopmentMode } = useWagmiWallet();
  
  // Using other custom hooks
  const { 
    lotteries, 
    activeLotteries, 
    pastLotteries, 
    userTickets, 
    isLoading: lotteriesLoading, 
    error: lotteriesError,
    fetchLotteries, 
    fetchUserTickets
  } = useLotteries();
  
  const {
    tokens,
    isLoading: tokensLoading,
    error: tokensError,
    recommendation,
    getRecommendation
  } = useTokens();
  
  const {
    hasActiveSessionKey,
    createSessionKey,
    isLoading: sessionKeyLoading,
    error: sessionKeyError
  } = useSessionKeys();
  
  // Local state
  const [selectedLottery, setSelectedLottery] = useState(null);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [isSessionKeyModalOpen, setIsSessionKeyModalOpen] = useState(false);
  const [ticketQuantity, setTicketQuantity] = useState(1);
  const [error, setError] = useState(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [fallbackLotteries, setFallbackLotteries] = useState<Lottery[]>([]);
  
  // Log component mount and lottery state
  useEffect(() => {
    console.log('HomePage mounted, lottery state:');
    console.log('activeLotteries:', activeLotteries);
    console.log('selectedLottery:', selectedLottery);
  }, []);
  
  // Select first lottery when lottery list changes
  useEffect(() => {
    if (activeLotteries && activeLotteries.length > 0 && !selectedLottery) {
      console.log('Setting selected lottery to first active lottery');
      setSelectedLottery(activeLotteries[0]);
    }
  }, [activeLotteries, selectedLottery]);

  useEffect(() => {
  if (activeLotteries.length === 0 && lotteries.length > 0) {
    const currentTime = Math.floor(Date.now() / 1000);
    const forced = lotteries.slice(0, 3).map(lottery => ({
      ...lottery,
      startTime: currentTime - 3600,
      endTime: currentTime + 86400,
    }));
    setFallbackLotteries(forced);

    if (!selectedLottery) {
      setSelectedLottery(forced[0]);
    }
  }
}, [activeLotteries, lotteries, selectedLottery]);
 
  // Update recommendation when token list and selected lottery change
  useEffect(() => {
    const getTokenRecommendation = async () => {
      try {
        if (tokens.length > 0 && selectedLottery) {
          await getRecommendation(tokens, selectedLottery.ticketPrice);
        }
      } catch (err) {
        console.error('Error getting token recommendation:', err);
      }
    };
    
    getTokenRecommendation();
  }, [tokens, selectedLottery, getRecommendation]);
  
  // Combine errors from different hooks
  useEffect(() => {
    const currentError = lotteriesError || tokensError || sessionKeyError;
    if (currentError) {
      setError(currentError);
    } else {
      setError(null);
    }
  }, [lotteriesError, tokensError, sessionKeyError]);
  
  /**
   * Select a lottery
   * @param {Object} lottery - The lottery to select
   */
  const handleSelectLottery = (lottery) => {
    setSelectedLottery(lottery);
  };
  
  /**
   * Open ticket purchase modal
   */
  const handleOpenTicketModal = () => {
    setIsTicketModalOpen(true);
  };
  
  /**
   * Close ticket purchase modal
   */
  const handleCloseTicketModal = () => {
    setIsTicketModalOpen(false);
    setTicketQuantity(1);
  };
  
  /**
   * Open session key modal
   */
  const handleOpenSessionKeyModal = () => {
    setIsSessionKeyModalOpen(true);
  };
  
  /**
   * Close session key modal
   */
  const handleCloseSessionKeyModal = () => {
    setIsSessionKeyModalOpen(false);
  };
  
  /**
   * Change ticket quantity
   * @param {number} quantity - New ticket quantity
   */
  const handleTicketQuantityChange = (quantity) => {
    setTicketQuantity(quantity);
  };
  
  /**
   * Purchase tickets
   * @param {Object} token - Token to use for payment
   */
  const handlePurchaseTickets = async (token) => {
    // Navigate to PaymentPage to start ticket purchase flow
    navigate('/payment', {
      state: {
        lottery: selectedLottery,
        token,
        quantity: ticketQuantity,
        recommendation
      }
    });
    
    // Close the modal
    handleCloseTicketModal();
  };
  
  /**
   * Create session key
   * @param {number} duration - Duration in seconds
   */
  const handleCreateSessionKey = async (duration) => {
    try {
      await createSessionKey(duration);
      handleCloseSessionKeyModal();
    } catch (err) {
      setError('Failed to create session key: ' + err.message);
    }
  };
  
  /**
   * Retry loading data
   */
  const handleRetry = async () => {
    console.log('Retrying data load...');
    setError(null);
    setIsDataLoaded(false);
    try {
      await fetchLotteries();
    } catch (err) {
      setError(err.message || 'Failed to reload data');
    }
  };

 console.log("Fallback lotteries:", fallbackLotteries);
 console.log("Selected lottery:", selectedLottery);
  
  // Display error state
  if (error) {
    return (
      <div className="error-display">
        <h3>Error Loading Data</h3>
        <p>There was a problem loading the lottery data:</p>
        <div className="error-message">{error}</div>
        <button className="error-retry" onClick={handleRetry}>
          Retry
        </button>
      </div>
    );
  }
  
  // Landing page when wallet is not connected
  if (!isConnected && !isDevelopmentMode) {
    return (
      <div className="home-landing">
        <div className="landing-content">
          <h1>Welcome to AlpacaLotto!</h1>
          <p className="landing-subtitle">
            Next-generation blockchain lottery app where you can participate with any token
          </p>
          
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">🎟️</div>
              <h3>Multi-Token Lottery</h3>
              <p>Purchase tickets with ANY token in your wallet</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🤖</div>
              <h3>AI-Powered Token Optimization</h3>
              <p>AI automatically selects tokens with lowest gas costs</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔑</div>
              <h3>Session Keys</h3>
              <p>Play multiple times with a single signature</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h3>Batched Operations</h3>
              <p>Buy multiple tickets across different lotteries in one transaction</p>
            </div>
          </div>
          
          <div className="landing-cta">
            <p>Connect your wallet to get started</p>
          </div>
        </div>
      </div>
    );
  }
  
  // Loading display
  if (lotteriesLoading && activeLotteries.length === 0) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading lotteries...</p>
      </div>
    );
  }
  
// No active lotteries
if (activeLotteries.length === 0 && fallbackLotteries.length > 0 && selectedLottery) {
  return (
    <div className="lottery-container">
      <div className="dev-mode-notice">
        <p>Fallback: Displaying forced active lotteries since none are active.</p>
        <button className="retry-button" onClick={handleRetry}>
          Retry Loading
        </button>
      </div>
      <div className="lottery-grid">
        <div className="lottery-list-panel">
          <ActiveLotteries 
            lotteries={fallbackLotteries}
            isLoading={false}
            onSelect={handleSelectLottery}
            selectedId={selectedLottery.id}
          />
        </div>
        <div className="lottery-details-panel">
          <LotteryDetails 
            lottery={selectedLottery}
            userTickets={userTickets[selectedLottery.id] || []}
          />
          <div className="action-buttons">
            <button className="primary-button" onClick={handleOpenTicketModal}>
              Purchase Tickets
            </button>
            {!hasActiveSessionKey && (
              <button className="secondary-button" onClick={handleOpenSessionKeyModal}>
                Enable Quick Play
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
  // Regular display with active lotteries
  return (
    <div className="home-page">
      <div className="lottery-container">
        <div className="lottery-grid">
          <div className="lottery-list-panel">
            <ActiveLotteries 
              lotteries={activeLotteries}
              isLoading={lotteriesLoading}
              onSelect={handleSelectLottery}
              selectedId={selectedLottery?.id}
            />
          </div>
          
          {selectedLottery && (
            <div className="lottery-details-panel">
              <LotteryDetails 
                lottery={selectedLottery}
                userTickets={userTickets[selectedLottery.id] || []}
              />
              
              <div className="action-buttons">
                <button
                  className="primary-button"
                  onClick={handleOpenTicketModal}
                >
                  Purchase Tickets
                </button>
                
                {!hasActiveSessionKey && (
                  <button
                    className="secondary-button"
                    onClick={handleOpenSessionKeyModal}
                  >
                    Enable Quick Play
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Modals */}
      {isTicketModalOpen && selectedLottery && (
        <TicketPurchase
          lottery={selectedLottery}
          tokens={tokens}
          recommendation={recommendation}
          isLoading={tokensLoading}
          quantity={ticketQuantity}
          onQuantityChange={handleTicketQuantityChange}
          onPurchase={handlePurchaseTickets}
          onClose={handleCloseTicketModal}
          hasSessionKey={hasActiveSessionKey}
          isDevelopmentMode={isDevelopmentMode}
        />
      )}
      
      {isSessionKeyModalOpen && (
        <SessionKeyModal
          onCreate={handleCreateSessionKey}
          onClose={handleCloseSessionKeyModal}
          isLoading={sessionKeyLoading}
          isDevelopmentMode={isDevelopmentMode}
        />
      )}
    </div>
  );
};

export default HomePage;
