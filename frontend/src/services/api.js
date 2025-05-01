// frontend/src/services/api.js

import axios from 'axios';

// Get API Base Endpoint
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001/api';

// Create API client instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 second timeout
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    // Processing before request
    // console.log(`API Request: ${config.url}`, config);
    return config;
  },
  (error) => {
    // Request error handling
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.code === 'ERR_NETWORK') {
      console.error('Network error: CORS or server not responding');
      console.error('Check if backend server is running and CORS is configured properly');
    } else if (error.response?.status === 404) {
      console.error('API endpoint not found:', error.config?.url);
    } else {
      console.error('API Response Error:', error.response || error.message || error);
    }
    return Promise.reject(error);
  }
);

/**
 * Service to handle communication with the backend API.
 */
export const api = {
  /**
   * Get all lotteries.
   * @returns {Object} - Lottery response.
   */
  async getLotteries() {
    try {
      const response = await apiClient.get('/lotteries');
      return response.data;
    } catch (error) {
      console.error('Lottery fetch error:', error);
      
      if (error.code === 'ERR_NETWORK' || (error.response && error.response.status === 404)) {
        console.log('Using mock data...');
        return {
          success: true,
          lotteries: this._generateMockLotteries()
        };
      }
      
      throw error.response?.data || error;
    }
  },
  
  /**
   * Get active lotteries.
   * @returns {Object} - Active lotteries response.
   */
  async getActiveLotteries() {
    try {
      const response = await apiClient.get('/lotteries/active');
      return response.data;
    } catch (error) {
      console.error('Error fetching active lotteries:', error);
      throw error.response?.data || error;
    }
  },
  
  /**
   * Get lottery details.
   * @param {number} lotteryId - Lottery ID.
   * @returns {Object} - Lottery details response.
   */
  async getLotteryDetails(lotteryId) {
    try {
      const response = await apiClient.get(`/lottery/${lotteryId}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching lottery details (ID: ${lotteryId}):`, error);
      throw error.response?.data || error;
    }
  },
  
  /**
   * Get user tickets.
   * @param {number} lotteryId - Lottery ID.
   * @param {string} address - User address.
   * @returns {Object} - User tickets response.
   */
  async getUserTickets(lotteryId, address) {
    try {
      const response = await apiClient.get(`/lottery/${lotteryId}/tickets/${address}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching user tickets (Lottery: ${lotteryId}, User: ${address}):`, error);
      throw error.response?.data || error;
    }
  },
  
  /**
   * Check if the user is a winner.
   * @param {number} lotteryId - Lottery ID.
   * @param {string} address - User address.
   * @returns {Object} - Winner check response.
   */
  async checkIfWinner(lotteryId, address) {
    try {
      const response = await apiClient.get(`/lottery/${lotteryId}/winner/${address}`);
      return response.data;
    } catch (error) {
      console.error(`Error checking winner (Lottery: ${lotteryId}, User: ${address}):`, error);
      throw error.response?.data || error;
    }
  },
  
  /**
   * Get supported tokens.
   * @returns {Object} - Supported tokens response.
   */
  async getSupportedTokens() {
    try {
      const response = await apiClient.get('/supported-tokens');
      return response.data;
    } catch (error) {
      console.error('Error fetching supported tokens:', error);
      throw error.response?.data || error;
    }
  },
  
  /**
   * Get the optimal token.
   * @param {Array} tokens - Array of tokens.
   * @param {Object} userPreferences - User preferences.
   * @returns {Object} - Token optimization response.
   */
  async optimizeToken(tokens, userPreferences = {}) {
    try {
      const response = await apiClient.post('/optimize-token', {
        tokens,
        userPreferences
      });
      return response.data;
    } catch (error) {
      console.error('Error optimizing token:', error);
      throw error.response?.data || error;
    }
  },
  
  /**
   * Purchase lottery tickets.
   * @param {number} lotteryId - Lottery ID.
   * @param {string} tokenAddress - Address of the payment token.
   * @param {number} quantity - Number of tickets.
   * @param {string} signature - Signature.
   * @returns {Object} - Ticket purchase response.
   */
  async purchaseTickets(lotteryId, tokenAddress, quantity, signature = null) {
    try {
      const response = await apiClient.post('/purchase-tickets', {
        lotteryId,
        tokenAddress,
        quantity,
        signature
      });
      return response.data;
    } catch (error) {
      console.error(`Error purchasing tickets (Lottery: ${lotteryId}):`, error);
      throw error.response?.data || error;
    }
  },
  
  /**
   * Batch purchase tickets for multiple lotteries.
   * @param {Array} selections - Array of purchase selections [{lotteryId, tokenAddress, quantity}].
   * @param {string} signature - Signature.
   * @returns {Object} - Batch ticket purchase response.
   */
  async batchPurchaseTickets(selections, signature = null) {
    try {
      const response = await apiClient.post('/batch-purchase-tickets', {
        selections,
        signature
      });
      return response.data;
    } catch (error) {
      console.error('Error batch purchasing tickets:', error);
      throw error.response?.data || error;
    }
  },
  
  /**
   * Create a session key.
   * @param {number} duration - Validity duration (seconds).
   * @param {string} signature - Signature.
   * @returns {Object} - Session key creation response.
   */
  async createSessionKey(duration, signature) {
    try {
      const response = await apiClient.post('/create-session-key', {
        duration,
        signature
      });
      return response.data;
    } catch (error) {
      console.error('Error creating session key:', error);
      throw error.response?.data || error;
    }
  },
  
  /**
   * Revoke a session key.
   * @param {string} sessionKey - Session key address.
   * @param {string} signature - Signature.
   * @returns {Object} - Session key revocation response.
   */
  async revokeSessionKey(sessionKey, signature) {
    try {
      const response = await apiClient.post('/revoke-session-key', {
        sessionKey,
        signature
      });
      return response.data;
    } catch (error) {
      console.error('Error revoking session key:', error);
      throw error.response?.data || error;
    }
  },
  
  /**
   * Claim prize money.
   * @param {number} lotteryId - Lottery ID.
   * @param {string} signature - Signature.
   * @returns {Object} - Prize claim response.
   */
  async claimPrize(lotteryId, signature) {
    try {
      const response = await apiClient.post('/claim-prize', {
        lotteryId,
        signature
      });
      return response.data;
    } catch (error) {
      console.error(`Error claiming prize (Lottery: ${lotteryId}):`, error);
      throw error.response?.data || error;
    }
  },
  
  /**
   * Server health check.
   * @returns {Object} - Health check response.
   */
  async checkHealth() {
    try {
      const response = await apiClient.get('/health');
      return response.data;
    } catch (error) {
      console.error('Health check error:', error);
      throw error.response?.data || error;
    }
  }
};

export default api;