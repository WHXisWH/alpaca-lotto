// frontend/src/hooks/useTokens.js

import { useState, useCallback, useEffect } from 'react';
import { api } from '../services/api';
import useWallet from './useWallet';

// 一般的なトークンのアドレス（テスト/デモ用）
const COMMON_TOKENS = [
  // ステーブルコイン
  '0x6b175474e89094c44da98b954eedeac495271d0f', // DAI
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
  '0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT
  '0x853d955acef822db058eb8505911ed77f175b99e', // FRAX
  
  // 主要暗号資産
  '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', // WBTC
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH
  
  // DeFiトークン
  '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984', // UNI
  '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9', // AAVE
];

/**
 * @typedef {Object} Token
 * @property {string} address - トークンのアドレス
 * @property {string} symbol - トークンのシンボル
 * @property {string} name - トークンの名前
 * @property {number} decimals - トークンの小数点以下桁数
 * @property {string} balance - トークンの残高（文字列表記）
 * @property {string} rawBalance - トークンの生の残高（文字列表記）
 * @property {number} [usdBalance] - トークンのUSD残高
 * @property {number} [score] - トークンのスコア
 * @property {boolean} [recommended] - 推奨トークンかどうか
 * @property {string[]} [reasons] - 推奨理由の配列
 */

/**
 * @typedef {Object} Recommendation
 * @property {Token} recommendedToken - 推奨トークン
 * @property {Token[]} allScores - すべてのトークンとそのスコア
 * @property {number} supportedCount - サポートされているトークンの数
 */

/**
 * トークン管理と推奨のためのカスタムフック
 */
export const useTokens = () => {
  const { account, aaWalletAddress, getTokens: fetchWalletTokens } = useWallet();
  const [tokens, setTokens] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [supportedTokens, setSupportedTokens] = useState([]);
  const [recommendation, setRecommendation] = useState(null);
  
  /**
   * ウォレットからトークンを取得
   */
  const getTokens = useCallback(async () => {
    if (!account && !aaWalletAddress) {
      setError('ウォレットが接続されていません');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // ウォレットからトークンを取得
      const walletTokens = await fetchWalletTokens(COMMON_TOKENS);
      setTokens(walletTokens);
      
      // サポートされているトークンのリストを取得
      await getSupportedTokens();
      
      setIsLoading(false);
      return walletTokens;
    } catch (err) {
      console.error('トークン取得エラー:', err);
      setError(err.message || 'トークン取得エラー');
      setIsLoading(false);
    }
  }, [account, aaWalletAddress, fetchWalletTokens]);
  
  /**
   * Paymasterがサポートするトークンを取得
   */
  const getSupportedTokens = useCallback(async () => {
    try {
      const response = await api.getSupportedTokens();
      
      if (response.success && response.tokens) {
        // サポートされているトークンのアドレスを抽出
        const addresses = response.tokens.map((token) => 
          token.address.toLowerCase()
        );
        
        setSupportedTokens(addresses);
        return addresses;
      }
      
      return [];
    } catch (err) {
      console.error('サポートされているトークン取得エラー:', err);
      return [];
    }
  }, []);
  
  /**
   * APIからトークン推奨を取得
   * @param {Array} targetTokens - 推奨を取得するトークン配列（指定しない場合は現在のトークンを使用）
   * @param {number} [ticketPrice] - チケット価格（USD）- これにより推奨が調整される場合がある
   */
  const getRecommendation = useCallback(async (targetTokens = null, ticketPrice = null) => {
    const tokensToUse = targetTokens || tokens;
    
    if (tokensToUse.length === 0) {
      setError('トークンが見つかりません');
      return null;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // ユーザー設定 - チケット価格に基づいて重みを調整できる
      const userPreferences = {};
      if (ticketPrice) {
        // 高額チケットの場合は残高の重みを増やす
        if (ticketPrice >= 50) {
          userPreferences.weights = {
            balance: 0.5,      // 50% weight for balance
            volatility: 0.25,  // 25% weight for volatility
            slippage: 0.25     // 25% weight for slippage
          };
        }
      }
      
      const response = await api.optimizeToken(tokensToUse, userPreferences);
      
      if (response.success && response.recommendedToken) {
        setRecommendation(response);
        
        // トークンリストで推奨トークンをマーク
        const updatedTokens = tokensToUse.map(token => {
          if (token.address.toLowerCase() === response.recommendedToken.address.toLowerCase()) {
            return {
              ...token,
              ...response.recommendedToken,
              recommended: true
            };
          }
          
          // allScoresで一致するトークンを見つけてスコア情報を取得
          const scoreInfo = response.allScores.find(
            (t) => t.address.toLowerCase() === token.address.toLowerCase()
          );
          
          if (scoreInfo) {
            return {
              ...token,
              ...scoreInfo,
              recommended: false
            };
          }
          
          return token;
        });
        
        setTokens(updatedTokens);
        setIsLoading(false);
        return response;
      }
      
      setIsLoading(false);
      return null;
    } catch (err) {
      console.error('トークン推奨取得エラー:', err);
      setError(err.message || 'トークン推奨取得エラー');
      setIsLoading(false);
      return null;
    }
  }, [tokens]);
  
  /**
   * トークンがPaymasterでサポートされているかをチェック
   * @param {string} tokenAddress - チェックするトークンのアドレス
   * @returns {boolean} - トークンがサポートされているかどうか
   */
  const isTokenSupported = useCallback((tokenAddress) => {
    if (!tokenAddress || supportedTokens.length === 0) {
      return false;
    }
    
    return supportedTokens.includes(tokenAddress.toLowerCase());
  }, [supportedTokens]);
  
  /**
   * サポートされているトークンのみをフィルタリング
   * @returns {Array} - サポートされているトークンの配列
   */
  const getSupportedTokensOnly = useCallback(() => {
    return tokens.filter(token => 
      isTokenSupported(token.address)
    );
  }, [tokens, isTokenSupported]);
  
  // ウォレットが接続されたらトークンをロード
  useEffect(() => {
    if (account || aaWalletAddress) {
      getTokens();
    }
  }, [account, aaWalletAddress, getTokens]);
  
  return {
    tokens,
    isLoading,
    error,
    supportedTokens,
    recommendation,
    getTokens,
    getSupportedTokens,
    getRecommendation,
    isTokenSupported,
    getSupportedTokensOnly
  };
};

export default useTokens;