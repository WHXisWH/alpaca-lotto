// frontend/src/components/Footer.jsx

import React from 'react';

/**
 * Footer component for the application
 */
const Footer = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="app-footer">
      <div className="footer-content">
        <div className="footer-section">
          <div className="footer-logo">
            <span className="footer-logo-icon">🦙</span>
            <span className="footer-logo-text">AlpacaLotto</span>
          </div>
          <p className="footer-tagline">
            Next-generation lottery dApp using NERO Chain's Account Abstraction
          </p>
        </div>
        
        <div className="footer-section">
          <h3>Features</h3>
          <ul>
            <li>Multi-token lottery participation</li>
            <li>AI-optimized token selection</li>
            <li>Quick Play with session keys</li>
            <li>Gas-efficient batch operations</li>
          </ul>
        </div>
        
        <div className="footer-section">
          <h3>Links</h3>
          <ul>
            <li><a href="https://docs.nerochain.io/" target="_blank" rel="noopener noreferrer">NERO Chain Documentation</a></li>
            <li><a href="https://nerochain.io/" target="_blank" rel="noopener noreferrer">NERO Chain Website</a></li>
            <li><a href="https://github.com/" target="_blank" rel="noopener noreferrer">GitHub</a></li>
          </ul>
        </div>
      </div>
      
      <div className="footer-bottom">
        <p>&copy; {currentYear} AlpacaLotto | Powered by NERO Chain</p>
        <p className="disclaimer">
          This is a demo application that works on testnet only. Do not use real assets.
        </p>
      </div>
    </footer>
  );
};

export default Footer;