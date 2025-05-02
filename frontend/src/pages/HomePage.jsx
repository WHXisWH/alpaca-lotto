import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ActiveLotteries from '../components/ActiveLotteries';
import LotteryDetails from '../components/LotteryDetails';
import TicketPurchase from '../components/TicketPurchase';
import SessionKeyModal from '../components/SessionKeyModal';
import useWallet from '../hooks/useWallet';
import useTokens from '../hooks/useTokens';
import useLotteries from '../hooks/useLotteries';
import useSessionKeys from '../hooks/useSessionKeys';

/**
 * Home page of the application
 * Enhanced with error handling and development mode support
 */
const HomePage = () => {
  const navigate = useNavigate();
  
  // Using custom hooks
  const { account, isDevelopmentMode } = useWallet();
  const { 
    lotteries, 
    activeLotteries, 
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
  
  // Fetch lotteries when wallet is connected
  useEffect(() => {
    const loadLotteries = async () => {
      try {
        await fetchLotteries();
      } catch (err) {
        setError(err.message || 'Failed to load lotteries');
      }
    };
    
    if (account || isDevelopmentMode) {
      loadLotteries();
    }
  }, [account, fetchLotteries, isDevelopmentMode]);
  
  // Fetch user tickets when lottery is selected
  useEffect(() => {
    const loadTickets = async () => {
      try {
        if (selectedLottery) {
          await fetchUserTickets(selectedLottery.id);
        }
      } catch (err) {
        console.error('Error fetching user tickets:', err);
      }
    };
    
    if ((account || isDevelopmentMode) && selectedLottery) {
      loadTickets();
    }
  }, [account, selectedLottery, fetchUserTickets, isDevelopmentMode]);
  
  // Select first lottery when lottery list changes
  useEffect(() => {
    if (activeLotteries && activeLotteries.length > 0 && !selectedLottery) {
      setSelectedLottery(activeLotteries[0]);
    }
  }, [activeLotteries, selectedLottery]);
  
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
    setError(null);
    try {
      await fetchLotteries();
      if (tokens.length === 0) {
        // No need to handle this error as it will be captured in the tokensError
        getRecommendation();
      }
    } catch (err) {
      setError(err.message || 'Failed to reload data');
    }
  };
  
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
  if (!account && !isDevelopmentMode) {
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
  if (activeLotteries.length === 0) {
    return (
      <div className="no-lotteries">
        <h2>No active lotteries</h2>
        <p>There are no lotteries currently in progress. Please try again later.</p>
        {isDevelopmentMode && (
          <div className="dev-mode-note">
            <p>In development mode, you should see mock lotteries. If not, check the console for errors.</p>
            <button className="retry-button" onClick={handleRetry}>
              Retry Loading
            </button>
          </div>
        )}
      </div>
    );
  }
  
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