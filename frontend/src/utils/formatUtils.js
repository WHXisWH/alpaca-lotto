// frontend/src/utils/formatUtils.js

import { ethers } from 'ethers';

/**
 * Utility functions for safely formatting and parsing values for ethers.js
 */
const formatUtils = {
  /**
   * Safely formats a BigNumber or string to a human-readable string with specified decimals
   * @param {string|BigNumber} value - The value to format
   * @param {number} decimals - Number of decimals
   * @returns {string} - Formatted string
   */
  formatUnits: (value, decimals = 18) => {
    if (!value) return '0';
    
    try {
      // Handle BigNumber objects
      if (typeof value === 'object' && value._isBigNumber) {
        return ethers.utils.formatUnits(value, decimals);
      }
      
      // Handle string values that may be decimal or hex
      if (typeof value === 'string') {
        // Check if it's already a decimal string with a decimal point
        if (value.includes('.')) {
          return value;
        }
        
        return ethers.utils.formatUnits(value, decimals);
      }
      
      // Handle numbers
      if (typeof value === 'number') {
        return value.toString();
      }
      
      return '0';
    } catch (error) {
      console.error('Error formatting units:', error);
      return '0';
    }
  },
  
  /**
   * Safely parses a user input value to a BigNumber compatible string
   * @param {string|number} value - The value to parse
   * @param {number} decimals - Number of decimals
   * @returns {string} - Parsed value as string
   */
  parseUnits: (value, decimals = 18) => {
    if (!value) return '0';
    
    try {
      // Convert input to string and trim whitespace
      const stringValue = String(value).trim();
      
      // If empty after trim, return 0
      if (stringValue === '') return '0';
      
      // Parse the value to ethers.js compatible format
      return ethers.utils.parseUnits(stringValue, decimals).toString();
    } catch (error) {
      console.error('Error parsing units:', error);
      return '0';
    }
  },
  
  /**
   * Safely formats a token amount for display with symbol
   * @param {string|BigNumber} amount - Token amount
   * @param {number} decimals - Token decimals
   * @param {string} symbol - Token symbol
   * @returns {string} - Formatted amount with symbol
   */
  formatTokenAmount: (amount, decimals = 18, symbol = '') => {
    if (!amount) return `0 ${symbol}`;
    
    try {
      const formatted = formatUtils.formatUnits(amount, decimals);
      return `${formatted}${symbol ? ' ' + symbol : ''}`;
    } catch (error) {
      console.error('Error formatting token amount:', error);
      return `0 ${symbol}`;
    }
  },
  
  /**
   * Safely formats a price value for display
   * @param {string|number} price - Price value
   * @returns {string} - Formatted price
   */
  formatPrice: (price) => {
    if (!price) return '$0.00';
    
    try {
      const numericPrice = typeof price === 'string' ? parseFloat(price) : price;
      return `$${numericPrice.toFixed(2)}`;
    } catch (error) {
      console.error('Error formatting price:', error);
      return '$0.00';
    }
  },
  
  /**
   * Formats an address for display
   * @param {string} address - Ethereum address
   * @returns {string} - Formatted address
   */
  formatAddress: (address) => {
    if (!address) return '';
    if (typeof address !== 'string') return '';
    
    try {
      return `${address.slice(0, 6)}...${address.slice(-4)}`;
    } catch (error) {
      console.error('Error formatting address:', error);
      return '';
    }
  }
};

export default formatUtils;