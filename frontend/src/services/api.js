// frontend/src/services/api.js

import axios from 'axios';

// API Baseのエンドポイントを取得
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001/api';

// APIクライアントのインスタンスを作成
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10秒タイムアウト
});

// リクエストインターセプター
apiClient.interceptors.request.use(
  (config) => {
    // リクエストの前に実行する処理
    // console.log(`APIリクエスト: ${config.url}`, config);
    return config;
  },
  (error) => {
    // リクエストエラーの処理
    console.error('APIリクエストエラー:', error);
    return Promise.reject(error);
  }
);

// レスポンスインターセプター
apiClient.interceptors.response.use(
  (response) => {
    // レスポンスの前に実行する処理
    // console.log(`APIレスポンス: ${response.config.url}`, response.data);
    return response;
  },
  (error) => {
    // レスポンスエラーの処理
    console.error('APIレスポンスエラー:', error.response || error.message || error);
    return Promise.reject(error);
  }
);

/**
 * バックエンドAPIとの通信を処理するサービス
 */
export const api = {
  /**
   * すべてのロッタリーを取得
   * @returns {Object} - ロッタリーレスポンス
   */
  async getLotteries() {
    try {
      const response = await apiClient.get('/lotteries');
      return response.data;
    } catch (error) {
      console.error('ロッタリー取得エラー:', error);
      throw error.response?.data || error;
    }
  },
  
  /**
   * アクティブなロッタリーを取得
   * @returns {Object} - アクティブなロッタリーレスポンス
   */
  async getActiveLotteries() {
    try {
      const response = await apiClient.get('/lotteries/active');
      return response.data;
    } catch (error) {
      console.error('アクティブなロッタリー取得エラー:', error);
      throw error.response?.data || error;
    }
  },
  
  /**
   * ロッタリーの詳細を取得
   * @param {number} lotteryId - ロッタリーID
   * @returns {Object} - ロッタリー詳細レスポンス
   */
  async getLotteryDetails(lotteryId) {
    try {
      const response = await apiClient.get(`/lottery/${lotteryId}`);
      return response.data;
    } catch (error) {
      console.error(`ロッタリー詳細取得エラー (ID: ${lotteryId}):`, error);
      throw error.response?.data || error;
    }
  },
  
  /**
   * ユーザーのチケットを取得
   * @param {number} lotteryId - ロッタリーID
   * @param {string} address - ユーザーアドレス
   * @returns {Object} - ユーザーチケットレスポンス
   */
  async getUserTickets(lotteryId, address) {
    try {
      const response = await apiClient.get(`/lottery/${lotteryId}/tickets/${address}`);
      return response.data;
    } catch (error) {
      console.error(`ユーザーチケット取得エラー (Lottery: ${lotteryId}, User: ${address}):`, error);
      throw error.response?.data || error;
    }
  },
  
  /**
   * ユーザーが当選者かどうか確認
   * @param {number} lotteryId - ロッタリーID
   * @param {string} address - ユーザーアドレス
   * @returns {Object} - 当選確認レスポンス
   */
  async checkIfWinner(lotteryId, address) {
    try {
      const response = await apiClient.get(`/lottery/${lotteryId}/winner/${address}`);
      return response.data;
    } catch (error) {
      console.error(`当選確認エラー (Lottery: ${lotteryId}, User: ${address}):`, error);
      throw error.response?.data || error;
    }
  },
  
  /**
   * サポートされているトークンを取得
   * @returns {Object} - サポートされているトークンレスポンス
   */
  async getSupportedTokens() {
    try {
      const response = await apiClient.get('/supported-tokens');
      return response.data;
    } catch (error) {
      console.error('サポートされているトークン取得エラー:', error);
      throw error.response?.data || error;
    }
  },
  
  /**
   * 最適なトークンを取得
   * @param {Array} tokens - トークン配列
   * @param {Object} userPreferences - ユーザー設定
   * @returns {Object} - トークン最適化レスポンス
   */
  async optimizeToken(tokens, userPreferences = {}) {
    try {
      const response = await apiClient.post('/optimize-token', {
        tokens,
        userPreferences
      });
      return response.data;
    } catch (error) {
      console.error('トークン最適化エラー:', error);
      throw error.response?.data || error;
    }
  },
  
  /**
   * ロッタリーチケットを購入
   * @param {number} lotteryId - ロッタリーID
   * @param {string} tokenAddress - 支払いトークンのアドレス
   * @param {number} quantity - チケット数
   * @param {string} signature - 署名
   * @returns {Object} - チケット購入レスポンス
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
      console.error(`チケット購入エラー (Lottery: ${lotteryId}):`, error);
      throw error.response?.data || error;
    }
  },
  
  /**
   * 複数のロッタリーでチケットを一括購入
   * @param {Array} selections - 購入選択の配列 [{lotteryId, tokenAddress, quantity}]
   * @param {string} signature - 署名
   * @returns {Object} - バッチチケット購入レスポンス
   */
  async batchPurchaseTickets(selections, signature = null) {
    try {
      const response = await apiClient.post('/batch-purchase-tickets', {
        selections,
        signature
      });
      return response.data;
    } catch (error) {
      console.error('バッチチケット購入エラー:', error);
      throw error.response?.data || error;
    }
  },
  
  /**
   * セッションキーを作成
   * @param {number} duration - 有効期間（秒）
   * @param {string} signature - 署名
   * @returns {Object} - セッションキー作成レスポンス
   */
  async createSessionKey(duration, signature) {
    try {
      const response = await apiClient.post('/create-session-key', {
        duration,
        signature
      });
      return response.data;
    } catch (error) {
      console.error('セッションキー作成エラー:', error);
      throw error.response?.data || error;
    }
  },
  
  /**
   * セッションキーを無効化
   * @param {string} sessionKey - セッションキーアドレス
   * @param {string} signature - 署名
   * @returns {Object} - セッションキー無効化レスポンス
   */
  async revokeSessionKey(sessionKey, signature) {
    try {
      const response = await apiClient.post('/revoke-session-key', {
        sessionKey,
        signature
      });
      return response.data;
    } catch (error) {
      console.error('セッションキー無効化エラー:', error);
      throw error.response?.data || error;
    }
  },
  
  /**
   * 賞金を請求
   * @param {number} lotteryId - ロッタリーID
   * @param {string} signature - 署名
   * @returns {Object} - 賞金請求レスポンス
   */
  async claimPrize(lotteryId, signature) {
    try {
      const response = await apiClient.post('/claim-prize', {
        lotteryId,
        signature
      });
      return response.data;
    } catch (error) {
      console.error(`賞金請求エラー (Lottery: ${lotteryId}):`, error);
      throw error.response?.data || error;
    }
  },
  
  /**
   * サーバーヘルスチェック
   * @returns {Object} - ヘルスチェックレスポンス
   */
  async checkHealth() {
    try {
      const response = await apiClient.get('/health');
      return response.data;
    } catch (error) {
      console.error('ヘルスチェックエラー:', error);
      throw error.response?.data || error;
    }
  }
};

export default api;