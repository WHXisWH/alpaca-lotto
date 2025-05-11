// NEW FILE: frontend/src/utils/testModeUtils.js

/**
 * Utilities for managing test mode across the application
 */
const testModeUtils = {
    /**
     * Check if test mode is enabled
     */
    isTestModeEnabled: () => {
      return localStorage.getItem('devModeEnabled') === 'true' || 
             window.location.search.includes('devMode=true');
    },
    
    /**
     * Enable test mode with a reason
     * @param {string} reason - Reason for enabling test mode
     */
    enableTestMode: (reason = 'user_choice') => {
      localStorage.setItem('devModeEnabled', 'true');
      localStorage.setItem('testModeReason', reason);
      localStorage.setItem('autoFallbackEnabled', 'true');
      
      // Reload page to apply test mode
      if (!window.location.search.includes('devMode=true')) {
        window.location.search = window.location.search ? 
          window.location.search + '&devMode=true' : 
          'devMode=true';
      }
      
      return true;
    },
    
    /**
     * Disable test mode
     */
    disableTestMode: () => {
      localStorage.removeItem('devModeEnabled');
      localStorage.removeItem('testModeReason');
      localStorage.removeItem('autoFallbackEnabled');
      
      // Reload page to exit test mode
      if (window.location.search.includes('devMode=true')) {
        window.location.search = window.location.search.replace(/[?&]devMode=true/, '');
      }
      
      return false;
    },
    
    /**
     * Get the reason for test mode
     */
    getTestModeReason: () => {
      return localStorage.getItem('testModeReason') || 'unknown';
    }
  };
  
  export default testModeUtils;