// backend/routes/api.js

const express = require('express');
const router = express.Router();
const TokenOptimizer = require('../services/tokenOptimizer');
const LotteryService = require('../services/lotteryService');

// Create service instances
const tokenOptimizer = new TokenOptimizer();
const lotteryService = new LotteryService({
  rpcUrl: process.env.NERO_RPC_URL,
  contractAddress: process.env.LOTTERY_CONTRACT_ADDRESS
});

/**
 * @route   GET /api/lotteries
 * @desc    Get all lotteries
 * @access  Public
 */
router.get('/lotteries', async (req, res) => {
  try {
    try {
      const lotteries = await lotteryService.getAllLotteries();
      res.json({ success: true, lotteries });
    } catch (serviceError) {
      console.error('Error with lottery service, falling back to mock data:', serviceError);
      const mockLotteries = lotteryService._generateMockLotteries ? 
        lotteryService._generateMockLotteries() : [];
      res.json({ success: true, lotteries: mockLotteries });
    }
  } catch (error) {
    console.error('Error fetching lotteries:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   GET /api/lotteries/active
 * @desc    Get active lotteries
 * @access  Public
 */
router.get('/lotteries/active', async (req, res) => {
  try {
    const lotteries = await lotteryService.getActiveLotteries();
    res.json({ success: true, lotteries });
  } catch (error) {
    console.error('Error fetching active lotteries:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   GET /api/lottery/:id
 * @desc    Get lottery details
 * @access  Public
 */
router.get('/lottery/:id', async (req, res) => {
  try {
    const lotteryId = parseInt(req.params.id);
    if (isNaN(lotteryId)) {
      return res.status(400).json({ success: false, error: 'Invalid lottery ID' });
    }

    const lottery = await lotteryService.getLottery(lotteryId);
    if (!lottery) {
      return res.status(404).json({ success: false, error: 'Lottery not found' });
    }

    res.json({ success: true, lottery });
  } catch (error) {
    console.error(`Error fetching lottery details (ID: ${req.params.id}):`, error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   GET /api/lottery/:id/tickets/:address
 * @desc    Get user tickets
 * @access  Public
 */
router.get('/lottery/:id/tickets/:address', async (req, res) => {
  try {
    const lotteryId = parseInt(req.params.id);
    const userAddress = req.params.address;

    if (isNaN(lotteryId)) {
      return res.status(400).json({ success: false, error: 'Invalid lottery ID' });
    }

    if (!ethers.utils.isAddress(userAddress)) {
      return res.status(400).json({ success: false, error: 'Invalid address' });
    }

    const tickets = await lotteryService.getUserTickets(userAddress, lotteryId);
    res.json({ success: true, tickets });
  } catch (error) {
    console.error(`Error fetching user tickets (Lottery: ${req.params.id}, User: ${req.params.address}):`, error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   GET /api/lottery/:id/winner/:address
 * @desc    Check if user is a winner
 * @access  Public
 */
router.get('/lottery/:id/winner/:address', async (req, res) => {
  try {
    const lotteryId = parseInt(req.params.id);
    const userAddress = req.params.address;

    if (isNaN(lotteryId)) {
      return res.status(400).json({ success: false, error: 'Invalid lottery ID' });
    }

    if (!ethers.utils.isAddress(userAddress)) {
      return res.status(400).json({ success: false, error: 'Invalid address' });
    }

    const isWinner = await lotteryService.isWinner(userAddress, lotteryId);
    res.json({ success: true, isWinner });
  } catch (error) {
    console.error(`Error checking winner status (Lottery: ${req.params.id}, User: ${req.params.address}):`, error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   POST /api/optimize-token
 * @desc    Find optimal token for gas payment
 * @access  Public
 */
router.post('/optimize-token', async (req, res) => {
  try {
    const { tokens, userPreferences } = req.body;

    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      return res.status(400).json({ success: false, error: 'Token list is required' });
    }

    const result = await tokenOptimizer.findOptimalToken(tokens, userPreferences || {});
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error optimizing token:', error);
    res.status(500).json({ success: false, error: error.message || 'Server error' });
  }
});

/**
 * @route   POST /api/purchase-tickets
 * @desc    Purchase lottery tickets
 * @access  Public
 */
router.post('/purchase-tickets', async (req, res) => {
  try {
    const { lotteryId, tokenAddress, quantity, signature } = req.body;

    if (!lotteryId || !tokenAddress || !quantity) {
      return res.status(400).json({ success: false, error: 'Please provide all required fields' });
    }

    // Note: In a real implementation, signature verification and wallet connection would be required
    // This is a simplified endpoint for demonstration purposes

    const result = { success: true, message: 'Ticket purchase request accepted' };
    res.json(result);
  } catch (error) {
    console.error('Error purchasing tickets:', error);
    res.status(500).json({ success: false, error: error.message || 'Server error' });
  }
});

/**
 * @route   POST /api/create-session-key
 * @desc    Create a session key
 * @access  Public
 */
router.post('/create-session-key', async (req, res) => {
  try {
    const { duration, signature } = req.body;

    if (!duration) {
      return res.status(400).json({ success: false, error: 'Duration is required' });
    }

    // Note: In a real implementation, signature verification and wallet connection would be required
    // This is a simplified endpoint for demonstration purposes

    const result = { 
      success: true, 
      message: 'Session key creation request accepted',
      expiresAt: Math.floor(Date.now() / 1000) + duration
    };
    res.json(result);
  } catch (error) {
    console.error('Error creating session key:', error);
    res.status(500).json({ success: false, error: error.message || 'Server error' });
  }
});

/**
 * @route   POST /api/revoke-session-key
 * @desc    Revoke a session key
 * @access  Public
 */
router.post('/revoke-session-key', async (req, res) => {
  try {
    const { signature } = req.body;

    // Note: In a real implementation, signature verification and wallet connection would be required
    // This is a simplified endpoint for demonstration purposes

    const result = { success: true, message: 'Session key successfully revoked' };
    res.json(result);
  } catch (error) {
    console.error('Error revoking session key:', error);
    res.status(500).json({ success: false, error: error.message || 'Server error' });
  }
});

/**
 * @route   POST /api/claim-prize
 * @desc    Claim prize
 * @access  Public
 */
router.post('/claim-prize', async (req, res) => {
  try {
    const { lotteryId, signature } = req.body;

    if (!lotteryId) {
      return res.status(400).json({ success: false, error: 'Lottery ID is required' });
    }

    // Note: In a real implementation, signature verification and wallet connection would be required
    // This is a simplified endpoint for demonstration purposes

    const result = { success: true, message: 'Prize claim request accepted' };
    res.json(result);
  } catch (error) {
    console.error('Error claiming prize:', error);
    res.status(500).json({ success: false, error: error.message || 'Server error' });
  }
});

/**
 * @route   GET /api/health
 * @desc    Health check endpoint
 * @access  Public
 */
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;