import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import ActiveLotteries from '../components/ActiveLotteries';
import LotteryDetails from '../components/LotteryDetails';
import TicketPurchase from '../components/TicketPurchase';
import SessionKeyModal from '../components/SessionKeyModal';
import AAWalletStatus from '../components/AAWalletStatus';
import useWagmiWallet from '../hooks/useWagmiWallet';
import useUserOp from '../hooks/useUserOp'; 
import useTokens from '../hooks/useTokens';
import useLotteries from '../hooks/useLotteries';
import useSessionKeys from '../hooks/useSessionKeys';

/**
 * Home page of the application
 * Updated with simplified wallet deployment flow
 */
const HomePage = () => {
  const navigate = useNavigate();
  
  // Using wagmi hooks
  const { address, isConnected } = useAccount();
  const { isDevelopmentMode } = useWagmiWallet();
  
  // Using user operation hook
  const { 
    aaWalletAddress, 
    isDeployed,
    needsNeroTokens,
    executeTicketPurchase,
    deployOrWarn
  } = useUserOp();
  
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
  const [deploymentSuccess, setDeploymentSuccess] = useState(false);
  
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

  // Combine errors from different hooks
  useEffect(() => {
    const currentError = lotteriesError || tokensError || sessionKeyError;
    if (currentError) {
      setError(currentError);
    } else {
      setError(null);
    }
  }, [lotteriesError, tokensError, sessionKeyError]);
  
  // Reset deployment success message after 5 seconds
  useEffect(() => {
    if (deploymentSuccess) {
      const timer = setTimeout(() => {
        setDeploymentSuccess(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [deploymentSuccess]);
  
  /**
   * Select a lottery
   */
  const handleSelectLottery = (lottery) => {
    setSelectedLottery(lottery);
  };
  
  /**
   * Open ticket purchase modal
   * First check if wallet is deployed
   */
  const handleOpenTicketModal = async () => {
    try {
      // Check if wallet is deployed and deploy if needed
      if (!isDeployed) {
        if (window.confirm('Smart contract wallet is not deployed. Would you like to deploy it first?')) {
          await deployOrWarn();
          setDeploymentSuccess(true);
        }
      }
      setIsTicketModalOpen(true);
    } catch (err) {
      setError(err.message || 'Failed to deploy wallet');
    }
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
   * First check if wallet is deployed
   */
  const handleOpenSessionKeyModal = async () => {
    try {
      // Check if wallet is deployed and deploy if needed
      if (!isDeployed) {
        if (window.confirm('Smart contract wallet is not deployed. Would you like to deploy it first?')) {
          await deployOrWarn();
          setDeploymentSuccess(true);
        }
      }
      setIsSessionKeyModalOpen(true);
    } catch (err) {
      setError(err.message || 'Failed to deploy wallet');
    }
  };
  
  /**
   * Close session key modal
   */
  const handleCloseSessionKeyModal = () => {
    setIsSessionKeyModalOpen(false);
  };
  
  /**
   * Change ticket quantity
   */
  const handleTicketQuantityChange = (quantity) => {
    setTicketQuantity(quantity);
  };
  
  /**
   * Purchase tickets
   */
  const handlePurchaseTickets = async ({ token, paymentType }) => {
    try {
      // Try to purchase tickets, deployOrWarn will be called internally
      const txHash = await executeTicketPurchase({
        lotteryId: selectedLottery.id,
        tokenAddress: token.address,
        quantity: ticketQuantity,
        paymentType,
        paymentToken: token.address,
        useSessionKey: hasActiveSessionKey
      });
      
      navigate('/payment', {
        state: {
          lottery: selectedLottery,
          token,
          paymentType,
          quantity: ticketQuantity,
          txHash
        },
      });
      handleCloseTicketModal();
    } catch (err) {
      console.error('Purchase error:', err);
      setError(err.message || 'Failed to purchase tickets');
    }
  };
  
  /**
   * Create session key
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
  
  // Regular display with active lotteries
  return (
    <div className="home-page">
      {/* Display AA wallet status banner if not deployed */}
      {!isDeployed && <AAWalletStatus minimal className="wallet-status-banner" />}
      
      {/* Show success message after deployment */}
      {deploymentSuccess && (
        <div className="deployment-success">
          <div className="success-icon">✓</div>
          <div className="success-message">
            Smart contract wallet deployed successfully!
          </div>
        </div>
      )}
      
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
              
              {/* Show AA wallet status in details panel if not deployed */}
              {!isDeployed && (
                <div className="wallet-status-panel">
                  <AAWalletStatus />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Modals */}
      {isTicketModalOpen && selectedLottery && (
        <TicketPurchase
          lottery={selectedLottery}
          tokens={tokens}
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