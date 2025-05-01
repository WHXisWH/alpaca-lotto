// backend/services/lotteryService.js

const { ethers } = require('ethers');
const AlpacaLottoABI = require('../abis/AlpacaLotto.json');

/**
 * Lottery Service
 * 
 * AlpacaLottoスマートコントラクトと通信し、ロッタリー情報の取得や
 * チケット購入などの操作を行うサービス
 */
class LotteryService {
  constructor(config = {}) {
    // 設定パラメータ
    this.rpcUrl = config.rpcUrl || 'https://rpc-testnet.nerochain.io';
    this.contractAddress = config.contractAddress || '0x1234567890123456789012345678901234567890'; // ダミーアドレス
    this.cacheExpiryTime = config.cacheExpiryTime || 60 * 1000; // 1分間のキャッシュ
    
    // プロバイダとコントラクトの初期化
    this.provider = new ethers.providers.JsonRpcProvider(this.rpcUrl);
    this.contract = new ethers.Contract(this.contractAddress, AlpacaLottoABI, this.provider);
    
    // キャッシュ
    this.lotteriesCache = {
      data: null,
      timestamp: 0
    };
  }

  /**
   * プロバイダを初期化
   */
  initProvider() {
    if (!this.provider) {
      this.provider = new ethers.providers.JsonRpcProvider(this.rpcUrl);
      this.contract = new ethers.Contract(this.contractAddress, AlpacaLottoABI, this.provider);
    }
  }

  /**
   * 署名者を設定
   * @param {ethers.Signer} signer - トランザクション署名用の署名者
   */
  setSigner(signer) {
    this.contract = this.contract.connect(signer);
  }

  /**
   * すべてのロッタリーを取得
   * @returns {Array} - ロッタリーオブジェクトの配列
   */
  async getAllLotteries() {
    try {
      // キャッシュをチェック
      if (
        this.lotteriesCache.data &&
        Date.now() - this.lotteriesCache.timestamp < this.cacheExpiryTime
      ) {
        return this.lotteriesCache.data;
      }

      // プロバイダを確認
      this.initProvider();

      // ロッタリーカウンターを取得（総ロッタリー数）
      const lotteryCounter = await this.contract.lotteryCounter();
      
      // 各ロッタリーの詳細を取得
      const lotteries = [];
      for (let i = 1; i <= lotteryCounter.toNumber(); i++) {
        const lottery = await this.contract.getLottery(i);
        lotteries.push(this._formatLottery(lottery));
      }
      
      // キャッシュを更新
      this.lotteriesCache = {
        data: lotteries,
        timestamp: Date.now()
      };
      
      return lotteries;
    } catch (error) {
      console.error('ロッタリー取得エラー:', error);
      return [];
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
   * @param {string} sessionKeyAddress - セッションキーのアドレス
   * @returns {Object} - トランザクション結果
   */
  async revokeSessionKey(sessionKeyAddress) {
    try {
      // 署名者が設定されているか確認
      if (!this.contract.signer) {
        throw new Error('署名者が設定されていません');
      }
      
      // セッションキー無効化のトランザクションを送信
      const tx = await this.contract.revokeSessionKey(
        sessionKeyAddress
      );
      
      // トランザクションの確認を待つ
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
   * 賞金を請求
   * @param {number} lotteryId - ロッタリーID
   * @returns {Object} - トランザクション結果
   */
  async claimPrize(lotteryId) {
    try {
      // 署名者が設定されているか確認
      if (!this.contract.signer) {
        throw new Error('署名者が設定されていません');
      }
      
      // 賞金請求のトランザクションを送信
      const tx = await this.contract.claimPrize(lotteryId);
      
      // トランザクションの確認を待つ
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

  /**
   * コントラクトからのチケットデータをフォーマット
   * @param {Object} ticketData - コントラクトから取得したチケットデータ
   * @param {number} ticketNumber - チケット番号
   * @returns {Object} - フォーマットされたチケットオブジェクト
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
   * モックデータを使用してテスト用のロッタリーを生成
   * @returns {Array} - モックロッタリーの配列
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
        startTime: currentTime - 86400, // 昨日開始
        endTime: currentTime + 518400,   // 6日後終了
        drawTime: currentTime + 604800,  // 7日後抽選
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
        startTime: currentTime - 3600,   // 1時間前開始
        endTime: currentTime + 82800,    // 23時間後終了
        drawTime: currentTime + 86400,   // 24時間後抽選
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
        startTime: currentTime - 1800,   // 30分前開始
        endTime: currentTime + 1800,     // 30分後終了
        drawTime: currentTime + 3600,    // 1時間後抽選
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
        startTime: currentTime - 172800, // 2日前開始
        endTime: currentTime - 86400,    // 1日前終了
        drawTime: currentTime - 82800,   // 23時間前抽選
        supportedTokens: mockTokens,
        totalTickets: 100,
        prizePool: 500,
        drawn: true,
        winners: ['0x1234567890123456789012345678901234567890'],
        winningTickets: [42]
      }
    ];
  }
}

module.exports = LotteryService;