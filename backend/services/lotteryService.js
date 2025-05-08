const { ethers } = require('ethers');
const AlpacaLottoABI = require('../abis/AlpacaLotto.json');


class LotteryService {
  constructor(config = {}) {

    this.rpcUrl = config.rpcUrl || 'https://rpc-testnet.nerochain.io';
    this.contractAddress = config.contractAddress || '0x1234567890123456789012345678901234567890'; // ダミーアドレス
    this.cacheExpiryTime = config.cacheExpiryTime || 60 * 1000; 
    
   
    this.provider = new ethers.providers.JsonRpcProvider(this.rpcUrl, {
      name: 'nero-testnet',
      chainId: 689
    });
    this.contract = new ethers.Contract(this.contractAddress, AlpacaLottoABI, this.provider);
    
   
    this.lotteriesCache = {
      data: null,
      timestamp: 0
    };
  }

  
  initProvider() {
    if (!this.provider) {
      this.provider = new ethers.providers.JsonRpcProvider(this.rpcUrl, {
        name: 'nero-testnet',
        chainId: 689
      });
      this.contract = new ethers.Contract(this.contractAddress, AlpacaLottoABI, this.provider);
    }
  }

  /*
   * @param {ethers.Signer} signer 
   */
  setSigner(signer) {
    this.contract = this.contract.connect(signer);
  }

  /*
   * @returns {Array} 
   */
  async getAllLotteries() {
    try {
      if (
        this.lotteriesCache.data &&
        Date.now() - this.lotteriesCache.timestamp < this.cacheExpiryTime
      ) {
        console.log('[lotteryService] ✅ Using cached lottery data');
        return this.lotteriesCache.data;
      }
  
      if (!this.initialized) {
        console.log('[lotteryService] ⚠️ Not initialized. Initializing...');
        const initResult = await this.init();
        if (!initResult) {
          console.warn('[lotteryService] ❌ Initialization failed. Returning mock data');
          return this._generateMockLotteries();
        }
      }
  
      console.log('[lotteryService] 📦 Fetching lotteryCounter from contract...');
      const lotteryCounter = await this.contract.lotteryCounter();
      const counterValue = lotteryCounter.toNumber();
      console.log(`[lotteryService] 🎯 Lottery counter: ${counterValue}`);
  
      if (counterValue === 0) {
        console.warn('[lotteryService] ⚠️ Lottery counter is 0. No lotteries available.');
        return [];
      }
  
      const lotteries = [];
      for (let i = 1; i <= counterValue; i++) {
        try {
          console.log(`[lotteryService] 🔍 Fetching lottery #${i}`);
          const rawLottery = await this.contract.getLottery(i);
          console.log(`[lotteryService] ✅ Lottery #${i} fetched`, rawLottery);
          lotteries.push(this._formatLottery(rawLottery));
        } catch (err) {
          console.warn(`[lotteryService] ❌ Error fetching lottery #${i}:`, err.message || err);
        }
      }
  
      console.log(`[lotteryService] ✅ Successfully fetched ${lotteries.length} lotteries`);
      this.lotteriesCache = {
        data: lotteries,
        timestamp: Date.now()
      };
  
      return lotteries;
    } catch (error) {
      console.error('[lotteryService] 💥 Error in getAllLotteries():', error);
      return this._generateMockLotteries();
    }
  }
  
    
 /**
   * アクティブなロッタリーを取得
   * @returns {Array} - アクティブなロッタリーオブジェクトの配列
   */
  async getActiveLotteries() {
    try {
      const allLotteries = await this.getAllLotteries();
      const currentTime = Math.floor(Date.now() / 1000);
      
      // 開始時間が過去で、終了時間が未来のロッタリーをフィルタリング
      return allLotteries.filter(lottery => 
        lottery.startTime <= currentTime && lottery.endTime > currentTime
      );
    } catch (error) {
      console.error('アクティブなロッタリー取得エラー:', error);  
      return [];
    }
  }

  /**
   * 特定のロッタリーを取得
   * @param {number} lotteryId - ロッタリーID
   * @returns {Object} - ロッタリーオブジェクト
   */
  async getLottery(lotteryId) {
    try {
      // プロバイダを確認
      this.initProvider();
      
      const lottery = await this.contract.getLottery(lotteryId);
      return this._formatLottery(lottery);
    } catch (error) {
      console.error(`ロッタリー取得エラー (ID: ${lotteryId}):`, error);
      return null;
    }
  }

  /**
   * ユーザーのチケットを取得
   * @param {string} userAddress - ユーザーのウォレットアドレス
   * @param {number} lotteryId - ロッタリーID
   * @returns {Array} - チケットオブジェクトの配列
   */
  async getUserTickets(userAddress, lotteryId) {
    try {
      // プロバイダを確認
      this.initProvider();
      
      // ユーザーのチケット番号を取得
      const ticketNumbers = await this.contract.getUserTickets(userAddress, lotteryId);
      
      // 各チケットの詳細を取得
      const tickets = [];
      for (const ticketNumber of ticketNumbers) {
        try {
          // コントラクトの構造に応じて適切なメソッドが必要
          // このAPIは実装によっては異なる可能性があります
          const ticket = await this.contract.tickets(lotteryId, ticketNumber);
          tickets.push(this._formatTicket(ticket, ticketNumber));
        } catch (err) {
          console.warn(`チケット取得エラー (ID: ${ticketNumber}):`, err);
        }
      }
      
      return tickets;
    } catch (error) {
      console.error(`ユーザーチケット取得エラー (User: ${userAddress}, Lottery: ${lotteryId}):`, error);
      return [];
    }
  }

  /**
   * ユーザーがロッタリーの当選者かどうかを確認
   * @param {string} userAddress - ユーザーのウォレットアドレス
   * @param {number} lotteryId - ロッタリーID
   * @returns {boolean} - 当選者かどうか
   */
  async isWinner(userAddress, lotteryId) {
    try {
      // プロバイダを確認
      this.initProvider();
      
      return await this.contract.isWinner(userAddress, lotteryId);
    } catch (error) {
      console.error(`当選確認エラー (User: ${userAddress}, Lottery: ${lotteryId}):`, error);
      return false;
    }
  }

  /**
   * ロッタリーチケットを購入
   * @param {number} lotteryId - ロッタリーID
   * @param {string} tokenAddress - 支払いトークンのアドレス
   * @param {number} quantity - チケット数量
   * @returns {Object} - トランザクション結果
   */
  async purchaseTickets(lotteryId, tokenAddress, quantity) {
    try {
      // 署名者が設定されているか確認
      if (!this.contract.signer) {
        throw new Error('署名者が設定されていません');
      }
      
      // トークンコントラクトからの支払い承認が必要
      // この処理は呼び出し側で行う必要があります
      
      // チケット購入トランザクションを送信
      const tx = await this.contract.purchaseTickets(
        lotteryId,
        tokenAddress,
        quantity
      );
      
      // トランザクションの確認を待つ
      const receipt = await tx.wait();
      
      return {
        success: true,
        transactionHash: receipt.transactionHash,
        tickets: quantity
      };
    } catch (error) {
      console.error(`チケット購入エラー (Lottery: ${lotteryId}, Token: ${tokenAddress}):`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 複数のロッタリーに一括でチケットを購入
   * @param {Array} selections - 購入選択の配列 [{lotteryId, tokenAddress, quantity}]
   * @returns {Object} - トランザクション結果
   */
  async batchPurchaseTickets(selections) {
    try {
      // 署名者が設定されているか確認
      if (!this.contract.signer) {
        throw new Error('署名者が設定されていません');
      }
      
      // バッチ購入用のパラメータを準備
      const lotteryIds = selections.map(s => s.lotteryId);
      const tokenAddresses = selections.map(s => s.tokenAddress);
      const quantities = selections.map(s => s.quantity);
      
      // バッチ購入トランザクションを送信
      const tx = await this.contract.batchPurchaseTickets(
        lotteryIds,
        tokenAddresses,
        quantities
      );
      
      // トランザクションの確認を待つ
      const receipt = await tx.wait();
      
      return {
        success: true,
        transactionHash: receipt.transactionHash,
        selections
      };
    } catch (error) {
      console.error('バッチチケット購入エラー:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * セッションキーを使用してチケットを購入
   * @param {string} userAddress - ユーザーのウォレットアドレス
   * @param {number} lotteryId - ロッタリーID
   * @param {string} tokenAddress - 支払いトークンのアドレス
   * @param {number} quantity - チケット数量
   * @returns {Object} - トランザクション結果
   */
  async purchaseTicketsWithSessionKey(userAddress, lotteryId, tokenAddress, quantity) {
    try {
      // 署名者が設定されているか確認
      if (!this.contract.signer) {
        throw new Error('署名者が設定されていません');
      }
      
      // セッションキーを使用した購入のトランザクションを送信
      const tx = await this.contract.purchaseTicketsFor(
        userAddress,
        lotteryId,
        tokenAddress,
        quantity
      );
      
      // トランザクションの確認を待つ
      const receipt = await tx.wait();
      
      return {
        success: true,
        transactionHash: receipt.transactionHash,
        tickets: quantity
      };
    } catch (error) {
      console.error(`セッションキーでのチケット購入エラー (User: ${userAddress}, Lottery: ${lotteryId}):`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * セッションキーを作成
   * @param {string} sessionKeyAddress - セッションキーのアドレス
   * @param {number} validDuration - 有効期間（秒）
   * @param {string} operationsHash - 許可された操作のハッシュ
   * @returns {Object} - トランザクション結果
   */
  async createSessionKey(sessionKeyAddress, validDuration, operationsHash) {
    try {
      // 署名者が設定されているか確認
      if (!this.contract.signer) {
        throw new Error('署名者が設定されていません');
      }
      
      // 現在のタイムスタンプを取得
      const currentTime = Math.floor(Date.now() / 1000);
      const validUntil = currentTime + validDuration;
      
      // セッションキー作成のトランザクションを送信
      const tx = await this.contract.createSessionKey(
        sessionKeyAddress,
        validUntil,
        operationsHash
      );
      
      // トランザクションの確認を待つ
      const receipt = await tx.wait();
      
      return {
        success: true,
        transactionHash: receipt.transactionHash,
        sessionKey: sessionKeyAddress,
        validUntil
      };
    } catch (error) {
      console.error(`セッションキー作成エラー:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * セッションキーを無効化
   * @param {string} sessionKeyAddress 
   * @returns {Object} 
   */
  async revokeSessionKey(sessionKeyAddress) {
    try {
      
      if (!this.contract.signer) {
        throw new Error('署名者が設定されていません');
      }
      
  
      const tx = await this.contract.revokeSessionKey(
        sessionKeyAddress
      );
      
 
      const receipt = await tx.wait();
      
      return {
        success: true,
        transactionHash: receipt.transactionHash,
        sessionKey: sessionKeyAddress
      };
    } catch (error) {
      console.error(`セッションキー無効化エラー:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * @param {number} lotteryId - ロッタリーID
   * @returns {Object} - トランザクション結果
   */
  async claimPrize(lotteryId) {
    try {
      // 署名者が設定されているか確認
      if (!this.contract.signer) {
        throw new Error('署名者が設定されていません');
      }
      

      const tx = await this.contract.claimPrize(lotteryId);
      

      const receipt = await tx.wait();
      
      return {
        success: true,
        transactionHash: receipt.transactionHash,
        lotteryId
      };
    } catch (error) {
      console.error(`賞金請求エラー (Lottery: ${lotteryId}):`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * コントラクトからのロッタリーデータをフォーマット
   * @param {Object} lotteryData - コントラクトから取得したロッタリーデータ
   * @returns {Object} - フォーマットされたロッタリーオブジェクト
   */
  _formatLottery(lotteryData) {
    return {
      id: lotteryData.id.toNumber(),
      name: lotteryData.name,
      ticketPrice: lotteryData.ticketPrice.toNumber(),
      startTime: lotteryData.startTime.toNumber(),
      endTime: lotteryData.endTime.toNumber(),
      drawTime: lotteryData.drawTime.toNumber(),
      supportedTokens: lotteryData.supportedTokens,
      totalTickets: lotteryData.totalTickets.toNumber(),
      prizePool: lotteryData.prizePool.toNumber(),
      drawn: lotteryData.drawn,
      winners: lotteryData.winners || [],
      winningTickets: lotteryData.winningTickets ?
        lotteryData.winningTickets.map(t => t.toNumber()) : []
    };
  }

  /* 
   * @param {Object} ticketData 
   * @param {number} ticketNumber 
   * @returns {Object} 
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

  _generateMockLotteries() {
    const mockData = require('../mock/mockLotteries');
    return mockData.generateMockLotteries();
  }

  _getActiveMockLotteries() {
    const mockData = require('../mock/mockLotteries');
    return mockData.getActiveMockLotteries();
  }

  _generateMockTickets(lotteryId) {
    const mockData = require('../mock/mockLotteries');
    return mockData.generateMockTickets(lotteryId);
  }
}

module.exports = LotteryService;
