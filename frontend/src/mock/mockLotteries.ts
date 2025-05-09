/**
 * Static mock lottery data for development mode
 */
export const generateMockLotteries = () => {
  const currentTime = Math.floor(Date.now() / 1000);
  
  // Mock token addresses that are consistent
  const mockTokens = [
    '0x6b175474e89094c44da98b954eedeac495271d0f', // DAI
    '0xC86Fed58edF0981e927160C50ecB8a8B05B32fed', // USDC
    '0xdac17f958d2ee523a2206206994597c13d831ec7'  // USDT
  ];
  
  // Always create consistent mock lotteries
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
      startTime: currentTime - 1800,   // 30 min ago (ALWAYS ACTIVE)
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
      endTime: currentTime - 86400,    // 1 day ago (ALWAYS INACTIVE)
      drawTime: currentTime - 82800,   // 23 hours ago
      supportedTokens: mockTokens,
      totalTickets: 100,
      prizePool: 500,
      drawn: true,
      winners: ['0x1234567890123456789012345678901234567890'],
      winningTickets: [42]
    }
  ];
};

/**
 * Create active mock lotteries (first 3 from mock data)
 */
export const getActiveMockLotteries = () => {
  const currentTime = Math.floor(Date.now() / 1000);
  const mockLotteries = generateMockLotteries();
  
  // Always make the first 3 lotteries active
  return mockLotteries.slice(0, 3).map(lottery => ({
    ...lottery,
    startTime: currentTime - 3600, // 1 hour ago
    endTime: currentTime + 86400   // 24 hours later
  }));
};

/**
 * Generate mock tickets for a lottery
 */
export const generateMockTickets = (lotteryId) => {
  const quantity = Math.floor(Math.random() * 5) + 1;
  const tickets = [];
  
  for (let i = 0; i < quantity; i++) {
    tickets.push({
      lotteryId: lotteryId,
      ticketNumber: Math.floor(Math.random() * 100) + 1,
      user: '0x1234567890123456789012345678901234567890',
      paymentToken: '0xC86Fed58edF0981e927160C50ecB8a8B05B32fed', // USDC
      amountPaid: '5000000' // 5 USDC with 6 decimals
    });
  }
  
  return tickets;
};

export default {
  generateMockLotteries,
  getActiveMockLotteries,
  generateMockTickets
};
