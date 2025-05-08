const { ethers } = require('ethers');
const AlpacaLottoABI = require('../abis/AlpacaLotto.json');

class LotteryService {
  constructor(config = {}) {
    this.rpcUrl = config.rpcUrl || 'https://rpc-testnet.nerochain.io';
    this.contractAddress = config.contractAddress || '0x1234567890123456789012345678901234567890'; // Dummy address
    this.cacheExpiryTime = config.cacheExpiryTime || 60 * 1000; 
    
    // Try to initialize provider
    this.provider = new ethers.providers.JsonRpcProvider(this.rpcUrl, {
      name: 'nero-testnet',
      chainId: 689
    });
    this.contract = new ethers.Contract(this.contractAddress, AlpacaLottoABI, this.provider);
    
    // Cache
    this.lotteriesCache = {
      data: null,
      timestamp: 0
    };
  }

  /**
   * Initialize provider if not already done
   */
  initProvider() {
    if (!this.provider) {
      this.provider = new ethers.providers.JsonRpcProvider(this.rpcUrl, {
        name: 'nero-testnet',
        chainId: 689
      });
      this.contract = new ethers.Contract(this.contractAddress, AlpacaLottoABI, this.provider);
    }
  }

  /**
   * Set signer for contract
   * @param {ethers.Signer} signer 
   */
  setSigner(signer) {
    this.contract = this.contract.connect(signer);
  }

  /**
   * Get all lotteries
   * @returns {Array} - Array of lottery objects
   */
  async getAllLotteries() {
    try {
      // Use cache if available and not expired
      if (
        this.lotteriesCache.data &&
        Date.now() - this.lotteriesCache.timestamp < this.cacheExpiryTime
      ) {
        return this.lotteriesCache.data;
      }

      // Ensure provider is initialized
      this.initProvider();

      // Get lottery count from contract
      const lotteryCounter = await this.contract.lotteryCounter();
      
      // Fetch all lotteries
      const lotteries = [];
      for (let i = 1; i <= lotteryCounter.toNumber(); i++) {
        try {
          console.log(`Fetching lottery ID: ${i}`);
          const lottery = await this.contract.getLottery(i);
          console.log(`Lottery raw:`, lottery);
          console.log(`ID: ${lottery.id}, Name: ${lottery.name}`);
          lotteries.push(this._formatLottery(lottery));
        } catch (err) {
          console.warn(`Error fetching lottery #${i}:`, err);
        }
      }
      
      // Update cache
      this.lotteriesCache = {
        data: lotteries,
        timestamp: Date.now()
      };
      
      return lotteries;
    } catch (error) {
      console.error('Error fetching lotteries:', error);
      return [];
    }
  }
    
  /**
   * Get active lotteries
   * @returns {Array} - Array of active lottery objects
   */
  async getActiveLotteries() {
    try {
      const allLotteries = await this.getAllLotteries();
      const currentTime = Math.floor(Date.now() / 1000);
      
      // Filter active lotteries (start time in past, end time in future)
      return allLotteries.filter(lottery => 
        lottery.startTime <= currentTime && lottery.endTime > currentTime
      );
    } catch (error) {
      console.error('Error fetching active lotteries:', error);  
      return [];
    }
  }

  /**
   * Get specific lottery details
   * @param {number} lotteryId - Lottery ID
   * @returns {Object} - Lottery object
   */
  async getLottery(lotteryId) {
    try {
      // Ensure provider is initialized
      this.initProvider();
      
      const lottery = await this.contract.getLottery(lotteryId);
      return this._formatLottery(lottery);
    } catch (error) {
      console.error(`Error fetching lottery details (ID: ${lotteryId}):`, error);
      return null;
    }
  }

  /**
   * Get user tickets for a lottery
   * @param {string} userAddress - User wallet address
   * @param {number} lotteryId - Lottery ID
   * @returns {Array} - Array of ticket objects
   */
  async getUserTickets(userAddress, lotteryId) {
    try {
      // Ensure provider is initialized
      this.initProvider();
      
      // Get user's ticket numbers from contract
      const ticketNumbers = await this.contract.getUserTickets(userAddress, lotteryId);
      
      // Get details for each ticket
      const tickets = [];
      for (const ticketNumber of ticketNumbers) {
        try {
          const ticket = await this.contract.tickets(lotteryId, ticketNumber);
          tickets.push(this._formatTicket(ticket, ticketNumber));
        } catch (err) {
          console.warn(`Error fetching ticket (ID: ${ticketNumber}):`, err);
        }
      }
      
      return tickets;
    } catch (error) {
      console.error(`Error fetching user tickets (User: ${userAddress}, Lottery: ${lotteryId}):`, error);
      return [];
    }
  }

  /**
   * Check if user is a winner
   * @param {string} userAddress - User wallet address
   * @param {number} lotteryId - Lottery ID
   * @returns {boolean} - Winner status
   */
  async isWinner(userAddress, lotteryId) {
    try {
      // Ensure provider is initialized
      this.initProvider();
      
      return await this.contract.isWinner(userAddress, lotteryId);
    } catch (error) {
      console.error(`Error checking winner status (User: ${userAddress}, Lottery: ${lotteryId}):`, error);
      return false;
    }
  }

  /**
   * Purchase lottery tickets
   * @param {number} lotteryId - Lottery ID
   * @param {string} tokenAddress - Payment token address
   * @param {number} quantity - Number of tickets
   * @returns {Object} - Transaction result
   */
  async purchaseTickets(lotteryId, tokenAddress, quantity) {
    try {
      // Check for signer
      if (!this.contract.signer) {
        throw new Error('No signer set');
      }
      
      // Send transaction to contract
      const tx = await this.contract.purchaseTickets(
        lotteryId,
        tokenAddress,
        quantity
      );
      
      // Wait for transaction to be confirmed
      const receipt = await tx.wait();
      
      return {
        success: true,
        transactionHash: receipt.transactionHash,
        tickets: quantity
      };
    } catch (error) {
      console.error(`Error purchasing tickets (Lottery: ${lotteryId}, Token: ${tokenAddress}):`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Purchase tickets in batch
   * @param {Array} selections - Array of purchase selections (lotteryId, tokenAddress, quantity)
   * @returns {Object} - Transaction result
   */
  async batchPurchaseTickets(selections) {
    try {
      // Check for signer
      if (!this.contract.signer) {
        throw new Error('No signer set');
      }
      
      // Prepare batch parameters
      const lotteryIds = selections.map(s => s.lotteryId);
      const tokenAddresses = selections.map(s => s.tokenAddress);
      const quantities = selections.map(s => s.quantity);
      
      // Send batch transaction
      const tx = await this.contract.batchPurchaseTickets(
        lotteryIds,
        tokenAddresses,
        quantities
      );
      
      // Wait for transaction to be confirmed
      const receipt = await tx.wait();
      
      return {
        success: true,
        transactionHash: receipt.transactionHash,
        selections
      };
    } catch (error) {
      console.error('Error batch purchasing tickets:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Purchase tickets using session key
   * @param {string} userAddress - User wallet address
   * @param {number} lotteryId - Lottery ID
   * @param {string} tokenAddress - Payment token address
   * @param {number} quantity - Number of tickets
   * @returns {Object} - Transaction result
   */
  async purchaseTicketsWithSessionKey(userAddress, lotteryId, tokenAddress, quantity) {
    try {
      // Check for signer
      if (!this.contract.signer) {
        throw new Error('No signer set');
      }
      
      // Send transaction using session key
      const tx = await this.contract.purchaseTicketsFor(
        userAddress,
        lotteryId,
        tokenAddress,
        quantity
      );
      
      // Wait for transaction to be confirmed
      const receipt = await tx.wait();
      
      return {
        success: true,
        transactionHash: receipt.transactionHash,
        tickets: quantity
      };
    } catch (error) {
      console.error(`Error purchasing tickets with session key (User: ${userAddress}, Lottery: ${lotteryId}):`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create session key
   * @param {string} sessionKeyAddress - Session key address
   * @param {number} validDuration - Valid duration in seconds
   * @param {string} operationsHash - Operations hash
   * @returns {Object} - Transaction result
   */
  async createSessionKey(sessionKeyAddress, validDuration, operationsHash) {
    try {
      // Check for signer
      if (!this.contract.signer) {
        throw new Error('No signer set');
      }
      
      // Calculate expiration time
      const currentTime = Math.floor(Date.now() / 1000);
      const validUntil = currentTime + validDuration;
      
      // Send transaction to create session key
      const tx = await this.contract.createSessionKey(
        sessionKeyAddress,
        validUntil,
        operationsHash
      );
      
      // Wait for transaction to be confirmed
      const receipt = await tx.wait();
      
      return {
        success: true,
        transactionHash: receipt.transactionHash,
        sessionKey: sessionKeyAddress,
        validUntil
      };
    } catch (error) {
      console.error(`Error creating session key:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Revoke session key
   * @param {string} sessionKeyAddress - Session key address
   * @returns {Object} - Transaction result
   */
  async revokeSessionKey(sessionKeyAddress) {
    try {
      // Check for signer
      if (!this.contract.signer) {
        throw new Error('No signer set');
      }
      
      // Send transaction to revoke session key
      const tx = await this.contract.revokeSessionKey(
        sessionKeyAddress
      );
      
      // Wait for transaction to be confirmed
      const receipt = await tx.wait();
      
      return {
        success: true,
        transactionHash: receipt.transactionHash,
        sessionKey: sessionKeyAddress
      };
    } catch (error) {
      console.error(`Error revoking session key:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Claim prize
   * @param {number} lotteryId - Lottery ID
   * @returns {Object} - Transaction result
   */
  async claimPrize(lotteryId) {
    try {
      // Check for signer
      if (!this.contract.signer) {
        throw new Error('No signer set');
      }
      
      // Send transaction to claim prize
      const tx = await this.contract.claimPrize(lotteryId);
      
      // Wait for transaction to be confirmed
      const receipt = await tx.wait();
      
      return {
        success: true,
        transactionHash: receipt.transactionHash,
        lotteryId
      };
    } catch (error) {
      console.error(`Error claiming prize (Lottery: ${lotteryId}):`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Format lottery data from contract
   * @param {Object} lotteryData - Contract lottery data
   * @returns {Object} - Formatted lottery object
   * @private
   */
  _formatLottery(lotteryData) {
    // Ensure we handle BigNumber values properly and avoid conversion to floating point
    return {
      id: lotteryData.id.toNumber(),
      name: lotteryData.name,
      // Keep as BigNumber or string to prevent float conversion issues
      ticketPrice: lotteryData.ticketPrice.toString(),
      startTime: lotteryData.startTime.toNumber(),
      endTime: lotteryData.endTime.toNumber(),
      drawTime: lotteryData.drawTime.toNumber(),
      supportedTokens: lotteryData.supportedTokens,
      totalTickets: lotteryData.totalTickets.toNumber(),
      // Keep as BigNumber or string to prevent float conversion issues
      prizePool: lotteryData.prizePool.toString(),
      drawn: lotteryData.drawn,
      winners: lotteryData.winners || [],
      winningTickets: lotteryData.winningTickets ?
        lotteryData.winningTickets.map(t => t.toNumber()) : []
    };
  }

  /**
   * Format ticket data from contract
   * @param {Object} ticketData - Contract ticket data
   * @param {BigNumber} ticketNumber - Ticket number
   * @returns {Object} - Formatted ticket object
   * @private
   */
  _formatTicket(ticketData, ticketNumber) {
    return {
      lotteryId: ticketData.lotteryId.toNumber(),
      ticketNumber: ticketNumber.toNumber(),
      user: ticketData.user,
      paymentToken: ticketData.paymentToken,
      amountPaid: ticketData.amountPaid.toString()
    };
  }

  /**
   * Generate mock lotteries for development
   * @returns {Array} - Mock lottery objects
   */
  _generateMockLotteries() {
    const mockData = require('../mock/mockLotteries');
    return mockData.generateMockLotteries();
  }

  /**
   * Get active mock lotteries for development
   * @returns {Array} - Mock active lottery objects
   */
  _getActiveMockLotteries() {
    const mockData = require('../mock/mockLotteries');
    return mockData.getActiveMockLotteries();
  }

  /**
   * Generate mock tickets for development
   * @param {number} lotteryId - Lottery ID
   * @returns {Array} - Mock ticket objects
   */
  _generateMockTickets(lotteryId) {
    const mockData = require('../mock/mockLotteries');
    return mockData.generateMockTickets(lotteryId);
  }
}