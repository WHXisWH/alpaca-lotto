import { ethers } from 'ethers';
import { AlpacaLottoAbi } from '../constants/abi';

class ContractService {
  constructor() {
    this.provider = null;
    this.lottoContract = null;
    this.initialized = false;
  }

  async init() {
    try {
      // Use environment variables for RPC URL and contract address
      const rpcUrl = import.meta.env.VITE_NERO_RPC_URL || 'https://rpc-testnet.nerochain.io';
      const contractAddress = import.meta.env.VITE_LOTTERY_CONTRACT_ADDRESS;
      
      if (!contractAddress) {
        console.error('Contract address not found in environment variables');
        return false;
      }
      
      console.log('Initializing contract service with:', {
        rpcUrl,
        contractAddress
      });
      
      // Create provider and contract instance
      this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);
      this.lottoContract = new ethers.Contract(
        contractAddress,
        AlpacaLottoAbi,
        this.provider
      );
      
      // Test connection with a simple call
      const lotteryCounter = await this.lottoContract.lotteryCounter();
      console.log('Successfully connected to lottery contract. Counter:', lotteryCounter.toString());
      
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Error initializing contract service:', error);
      return false;
    }
  }

  async getLotteryCount() {
    if (!this.initialized) {
      await this.init();
    }
    
    try {
      const count = await this.lottoContract.lotteryCounter();
      return count.toNumber();
    } catch (error) {
      console.error('Error getting lottery count:', error);
      throw error;
    }
  }

  async getLotteryDetails(lotteryId) {
    if (!this.initialized) {
      await this.init();
    }
    
    try {
      const lottery = await this.lottoContract.getLottery(lotteryId);
      
      // Format the response to match expected structure
      return {
        id: lottery.id.toNumber(),
        name: lottery.name,
        ticketPrice: lottery.ticketPrice.toNumber(),
        startTime: lottery.startTime.toNumber(),
        endTime: lottery.endTime.toNumber(),
        drawTime: lottery.drawTime.toNumber(),
        supportedTokens: lottery.supportedTokens,
        totalTickets: lottery.totalTickets.toNumber(),
        prizePool: lottery.prizePool.toNumber(),
        drawn: lottery.drawn,
        winners: lottery.winners,
        winningTickets: lottery.winningTickets.map(ticket => ticket.toNumber())
      };
    } catch (error) {
      console.error(`Error getting lottery details for ID ${lotteryId}:`, error);
      throw error;
    }
  }

  async getAllLotteries() {
    if (!this.initialized) {
      await this.init();
    }
    
    try {
      const count = await this.getLotteryCount();
      const lotteries = [];
      
      // Fetch all lotteries
      for (let i = 1; i <= count; i++) {
        try {
          const lottery = await this.getLotteryDetails(i);
          lotteries.push(lottery);
        } catch (err) {
          console.warn(`Error fetching lottery ${i}:`, err);
          // Continue even if one lottery fails
        }
      }
      
      return lotteries;
    } catch (error) {
      console.error('Error getting all lotteries:', error);
      throw error;
    }
  }

  async getUserTickets(lotteryId, userAddress) {
    if (!this.initialized) {
      await this.init();
    }
    
    try {
      const ticketIndices = await this.lottoContract.getUserTickets(userAddress, lotteryId);
      const tickets = [];
      
      // Get details for each ticket
      for (const index of ticketIndices) {
        const ticketNumber = index.toNumber();
        const ticket = await this.lottoContract.tickets(lotteryId, ticketNumber);
        
        tickets.push({
          lotteryId: ticket.lotteryId.toNumber(),
          ticketNumber: ticket.ticketNumber.toNumber(),
          user: ticket.user,
          paymentToken: ticket.paymentToken,
          amountPaid: ticket.amountPaid.toString()
        });
      }
      
      return tickets;
    } catch (error) {
      console.error(`Error getting user tickets for lottery ${lotteryId} and user ${userAddress}:`, error);
      throw error;
    }
  }

  async isWinner(lotteryId, userAddress) {
    if (!this.initialized) {
      await this.init();
    }
    
    try {
      return await this.lottoContract.isWinner(userAddress, lotteryId);
    } catch (error) {
      console.error(`Error checking winner status for lottery ${lotteryId} and user ${userAddress}:`, error);
      throw error;
    }
  }
}

export default new ContractService();