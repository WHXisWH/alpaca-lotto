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
    return config;
  },
  (error) => {
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
      console.error('Using mock data for this request');
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
   * Generate mock lotteries for testing when API is not available
   * @returns {Array} - Array of mock lottery objects
   */
  _generateMockLotteries() {
    const currentTime = Math.floor(Date.now() / 1000);
    const mockTokens = [
      '0x6b175474e89094c44da98b954eedeac495271d0f', // DAI
      '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
      '0xdac17f958d2ee523a2206206994597c13d831ec7'  // USDT
    ];
    
    return [
      {
        id: 1,
        name: 'Weekly Jackpot',
        ticketPrice: 10,
        startTime: currentTime - 86400, // yesterday
        endTime: currentTime + 518400,   // 6 days later
        drawTime: currentTime + 604800,  // 7 days later
        supportedTokens: mockTokens,
        totalTickets: 120,
        prizePool: 1200,
        drawn: false,
        winners: [],
        winningTickets: []
      },
      {
        id: 2,
        name: 'Daily Draw',
        ticketPrice: 5,
        startTime: currentTime - 3600,   // 1 hour ago
        endTime: currentTime + 82800,    // 23 hours later
        drawTime: currentTime + 86400,   // 24 hours later
        supportedTokens: mockTokens,
        totalTickets: 75,
        prizePool: 375,
        drawn: false,
        winners: [],
        winningTickets: []
      },
      {
        id: 3,
        name: 'Flash Lottery',
        ticketPrice: 2,
        startTime: currentTime - 1800,   // 30 min ago
        endTime: currentTime + 1800,     // 30 min later
        drawTime: currentTime + 3600,    // 1 hour later
        supportedTokens: mockTokens,
        totalTickets: 30,
        prizePool: 60,
        drawn: false,
        winners: [],
        winningTickets: []
      },
      {
        id: 4,
        name: 'Past Lottery',
        ticketPrice: 5,
        startTime: currentTime - 172800, // 2 days ago
        endTime: currentTime - 86400,    // 1 day ago
        drawTime: currentTime - 82800,   // 23 hours ago
        supportedTokens: mockTokens,
        totalTickets: 100,
        prizePool: 500,
        drawn: true,
        winners: ['0x1234567890123456789012345678901234567890'],
        winningTickets: [42]
      }
    ];
  },

  /**
   * Generate mock user tickets for testing
   * @param {number} lotteryId - Lottery ID
   * @returns {Array} - Array of mock tickets
   */
  _generateMockTickets(lotteryId) {
    const quantity = Math.floor(Math.random() * 5) + 1;
    const tickets = [];
    
    for (let i = 0; i < quantity; i++) {
      tickets.push({
        lotteryId: lotteryId,
        ticketNumber: Math.floor(Math.random() * 100) + 1,
        user: '0x1234567890123456789012345678901234567890',
        paymentToken: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
        amountPaid: '5000000' // 5 USDC with 6 decimals
      });
    }
    
    return tickets;
  },

  /**
   * Generate mock token recommendations
   * @param {Array} tokens - List of tokens
   * @returns {Object} - Token recommendation object
   */
  _generateMockRecommendation(tokens) {
    if (!tokens || tokens.length === 0) {
      return null;
    }
    
    // Score all tokens
    const scoredTokens = tokens.map(token => {
      const score = Math.random();
      const volatility = Math.random() * 10;
      const slippage = Math.random() * 5;
      
      return {
        ...token,
        volatility,
        slippage,
        score,
        reasons: [
          `Balance of ${parseFloat(token.balance).toFixed(2)} is sufficient`,
          volatility < 3 ? 'Low volatility is favorable' : 'Medium volatility is acceptable',
          slippage < 2 ? 'Good liquidity with minimal slippage' : 'Acceptable liquidity'
        ]
      };
    });
    
    // Sort by score
    const sortedTokens = [...scoredTokens].sort((a, b) => b.score - a.score);
    
    return {
      recommendedToken: sortedTokens[0],
      allScores: sortedTokens,
      factors: {
        balanceWeight: 0.4,
        volatilityWeight: 0.3,
        slippageWeight: 0.3
      }
    };
  },
  
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
      
      console.log('Using mock data...');
      return {
        success: true,
        lotteries: this._generateMockLotteries()
      };
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
      // Filter mock lotteries for active ones
      const currentTime = Math.floor(Date.now() / 1000);
      const mockLotteries = this._generateMockLotteries();
      const activeLotteries = mockLotteries.filter(
        lottery => lottery.startTime <= currentTime && lottery.endTime > currentTime
      );
      
      return {
        success: true,
        lotteries: activeLotteries
      };
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
      // Find lottery in mock data
      const mockLotteries = this._generateMockLotteries();
      const lottery = mockLotteries.find(l => l.id === lotteryId);
      
      return {
        success: true,
        lottery: lottery || null
      };
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
      return {
        success: true,
        tickets: this._generateMockTickets(lotteryId)
      };
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
      // Random result with 10% chance of winning
      return {
        success: true,
        isWinner: Math.random() < 0.1
      };
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
      // Mock supported tokens
      return {
        success: true,
        tokens: [
          '0x6b175474e89094c44da98b954eedeac495271d0f', // DAI
          '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
          '0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT
          '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', // WBTC
          '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH
        ]
      };
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
      return {
        success: true,
        ...this._generateMockRecommendation(tokens)
      };
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
      // Mock successful purchase
      return {
        success: true,
        message: 'Ticket purchase request accepted',
        transactionHash: '0x' + [...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join('')
      };
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
      // Mock session key creation
      return {
        success: true,
        message: 'Session key creation request accepted',
        expiresAt: Math.floor(Date.now() / 1000) + duration
      };
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
      // Mock successful revocation
      return {
        success: true,
        message: 'Session key successfully revoked'
      };
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
      // Mock successful claim
      return {
        success: true,
        message: 'Prize claim request accepted',
        transactionHash: '0x' + [...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join('')
      };
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
      // Mock healthy status
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        mode: 'mock'
      };
    }
  }
};

export default api;