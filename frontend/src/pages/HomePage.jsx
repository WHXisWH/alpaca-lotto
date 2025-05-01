// frontend/src/pages/HomePage.jsx

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
 * Shows active lotteries list and ticket purchase interface
 */
const HomePage = () => {
  const navigate = useNavigate();
  
  // Using custom hooks
  const { account } = useWallet();
  const { 
    lotteries, 
    activeLotteries, 
    userTickets, 
    isLoading: lotteriesLoading, 
    fetchLotteries, 
    fetchUserTickets
  } = useLotteries();
  
  const {
    tokens,
    isLoading: tokensLoading,
    recommendation,
    getRecommendation
  } = useTokens();
  
  const {
    hasActiveSessionKey,
    createSessionKey,
    isLoading: sessionKeyLoading
  } = useSessionKeys();
  
  // Local state
  const [selectedLottery, setSelectedLottery] = useState(null);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [isSessionKeyModalOpen, setIsSessionKeyModalOpen] = useState(false);
  const [ticketQuantity, setTicketQuantity] = useState(1);
  
  // Fetch lotteries when wallet is connected
  useEffect(() => {
    if (account) {
      fetchLotteries();
    }
  }, [account, fetchLotteries]);
  
  // Fetch user tickets when lottery is selected
  useEffect(() => {
    if (account && selectedLottery) {
      fetchUserTickets(selectedLottery.id);
    }
  }, [account, selectedLottery, fetchUserTickets]);
  
  // Select first lottery when lottery list changes
  useEffect(() => {
    if (activeLotteries && activeLotteries.length > 0 && !selectedLottery) {
      setSelectedLottery(activeLotteries[0]);
    }
  }, [activeLotteries, selectedLottery]);
  
  // Update recommendation when token list and selected lottery change
  useEffect(() => {
    if (tokens.length > 0 && selectedLottery) {
      getRecommendation(tokens, selectedLottery.ticketPrice);
    }
  }, [tokens, selectedLottery, getRecommendation]);
  
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
    } catch (error) {
      console.error('Session key creation error:', error);
    }
  };
  
  // Landing page when wallet is not connected
  if (!account) {
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
              <p>Purchase tickets with any token in your wallet</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🤖</div>
              <h3>AI Optimization</h3>
              <p>AI automatically selects tokens with lowest gas costs</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔑</div>
              <h3>Session Keys</h3>
              <p>Play multiple times with a single signature</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h3>Batch Purchases</h3>
              <p>Buy multiple tickets in a single transaction</p>
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
        />
      )}
      
      {isSessionKeyModalOpen && (
        <SessionKeyModal
          onCreate={handleCreateSessionKey}
          onClose={handleCloseSessionKeyModal}
          isLoading={sessionKeyLoading}
        />
      )}
    </div>
  );
};

export default HomePage;