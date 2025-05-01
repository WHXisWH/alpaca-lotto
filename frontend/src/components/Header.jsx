// frontend/src/components/Header.jsx

import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

/**
 * Header component for the application
 * @param {Object} props
 * @param {boolean} props.hasSessionKey - Whether session key is active
 * @param {Function} props.onRevokeSessionKey - Handler for revoking session key
 */
const Header = ({ hasSessionKey, onRevokeSessionKey }) => {
  const location = useLocation();
  const [showMenu, setShowMenu] = useState(false);
  
  // Check if current path is active
  const isActive = (path) => {
    return location.pathname === path;
  };
  
  // Toggle menu display
  const toggleMenu = () => {
    setShowMenu(!showMenu);
  };
  
  // Confirm session key revocation
  const confirmRevokeSessionKey = () => {
    if (window.confirm('Are you sure you want to disable Quick Play?\nYou will need to sign again to re-enable it.')) {
      onRevokeSessionKey();
    }
  };
  
  return (
    <header className="app-header">
      <div className="header-content">
        <div className="logo">
          <Link to="/" className="logo-link">
            <span className="logo-icon">🦙</span>
            <h1 className="logo-text">AlpacaLotto</h1>
          </Link>
        </div>
        
        <button className="menu-button" onClick={toggleMenu}>
          <span className="menu-icon">☰</span>
        </button>
        
        <nav className={`main-nav ${showMenu ? 'mobile-active' : ''}`}>
          <ul>
            <li className={isActive('/') ? 'active' : ''}>
              <Link to="/" onClick={() => setShowMenu(false)}>
                Home
              </Link>
            </li>
            <li className={isActive('/tickets') ? 'active' : ''}>
              <Link to="/tickets" onClick={() => setShowMenu(false)}>
                My Tickets
              </Link>
            </li>
            <li className={isActive('/past-lotteries') ? 'active' : ''}>
              <Link to="/past-lotteries" onClick={() => setShowMenu(false)}>
                Past Lotteries
              </Link>
            </li>
            {hasSessionKey && (
              <li className="session-key-item">
                <button 
                  className="revoke-session-button"
                  onClick={() => {
                    confirmRevokeSessionKey();
                    setShowMenu(false);
                  }}
                >
                  Disable Quick Play
                </button>
              </li>
            )}
          </ul>
        </nav>
      </div>
    </header>
  );
};

export default Header;