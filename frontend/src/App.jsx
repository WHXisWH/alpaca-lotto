// frontend/src/App.jsx

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
 */
const App = () => {
  const { 
    account, 
    isConnecting, 
    connectWallet, 
    aaWalletAddress 
  } = useWallet();
  
  const {
    hasActiveSessionKey,
    revokeSessionKey,
    getTimeRemaining,
    isExpiringWithin
  } = useSessionKeys();
  
  const [showSessionWarning, setShowSessionWarning] = useState(false);
  
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
  
  // Close session warning
  const dismissSessionWarning = () => {
    setShowSessionWarning(false);
  };
  
  return (
    <Router>
      <div className="app-container">
        <Header 
          hasSessionKey={hasActiveSessionKey} 
          onRevokeSessionKey={revokeSessionKey}
        />
        
        <div className="wallet-bar">
          <WalletConnect 
            account={account} 
            isConnecting={isConnecting} 
            onConnect={connectWallet} 
            aaWalletAddress={aaWalletAddress}
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