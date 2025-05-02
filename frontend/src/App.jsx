import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage';
import PaymentPage from './pages/PaymentPage';
import Header from './components/Header';
import WalletConnect from './components/WalletConnect';
import Footer from './components/Footer';
import useWallet from './hooks/useWallet';
import useSessionKeys from './hooks/useSessionKeys';
import './styles/global.css';

/**
 * Root component for the AlpacaLotto application
 * Enhanced with development mode and error handling
 */
const App = () => {
  const { 
    account, 
    isConnecting, 
    connectWallet, 
    aaWalletAddress,
    isDevelopmentMode
  } = useWallet();
  
  const {
    hasActiveSessionKey,
    revokeSessionKey,
    getTimeRemaining,
    isExpiringWithin
  } = useSessionKeys();
  
  const [showSessionWarning, setShowSessionWarning] = useState(false);
  const [showDevBanner, setShowDevBanner] = useState(false);
  
  // Show warning when session key is about to expire
  useEffect(() => {
    if (hasActiveSessionKey && isExpiringWithin(5 * 60)) { // 5 minutes warning
      setShowSessionWarning(true);
    } else {
      setShowSessionWarning(false);
    }
    
    // Check every 30 seconds
    const checkInterval = setInterval(() => {
      if (hasActiveSessionKey && isExpiringWithin(5 * 60)) {
        setShowSessionWarning(true);
      } else {
        setShowSessionWarning(false);
      }
    }, 30 * 1000);
    
    return () => clearInterval(checkInterval);
  }, [hasActiveSessionKey, isExpiringWithin]);
  
  // Show development mode banner
  useEffect(() => {
    if (isDevelopmentMode) {
      setShowDevBanner(true);
    } else {
      setShowDevBanner(false);
    }
  }, [isDevelopmentMode]);
  
  // Close session warning
  const dismissSessionWarning = () => {
    setShowSessionWarning(false);
  };
  
  // Close development banner
  const dismissDevBanner = () => {
    setShowDevBanner(false);
  };
  
  return (
    <Router>
      <div className="app-container">
        {showDevBanner && (
          <div className="dev-mode-banner">
            <div className="banner-content">
              <span className="banner-icon">⚙️</span>
              <span className="banner-text">
                Development Mode: Using mock data and simulated transactions
              </span>
              <button className="banner-close" onClick={dismissDevBanner}>×</button>
            </div>
          </div>
        )}
        
        <Header 
          hasSessionKey={hasActiveSessionKey} 
          onRevokeSessionKey={revokeSessionKey}
          isDevelopmentMode={isDevelopmentMode}
        />
        
        <div className="wallet-bar">
          <WalletConnect 
            account={account} 
            isConnecting={isConnecting} 
            onConnect={connectWallet} 
            aaWalletAddress={aaWalletAddress}
            isDevelopmentMode={isDevelopmentMode}
          />
          {hasActiveSessionKey && (
            <div className="session-key-indicator">
              <span className="indicator-dot"></span>
              <span>Quick Play Enabled</span>
              <span className="time-remaining">
                {Math.floor(getTimeRemaining() / 60)} minutes left
              </span>
            </div>
          )}
        </div>
        
        {showSessionWarning && (
          <div className="session-warning">
            <div className="warning-content">
              <span className="warning-icon">⚠️</span>
              <span className="warning-text">
                Your Quick Play session is about to expire.
                Would you like to create a new session or wait for it to expire?
              </span>
              <div className="warning-actions">
                <button onClick={dismissSessionWarning}>Dismiss</button>
                <button onClick={() => window.location.href = "/#session-create"}>
                  Renew
                </button>
              </div>
            </div>
          </div>
        )}
        
        <main className="app-content">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/payment" element={<PaymentPage />} />
          </Routes>
        </main>
        
        <Footer />
      </div>
    </Router>
  );
};

export default App;