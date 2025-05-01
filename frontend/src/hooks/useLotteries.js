// frontend/src/hooks/useLotteries.js

import { useState, useCallback, useEffect } from 'react';
import { api } from '../services/api';
import useWallet from './useWallet';

/**
 * ロッタリー機能とデータ管理のためのカスタムフック
 */
export const useLotteries = () => {
  const { account } = useWallet();
  const [lotteries, setLotteries] = useState([]);
  const [activeLotteries, setActiveLotteries] = useState([]);
  const [pastLotteries, setPastLotteries] = useState([]);
  const [userTickets, setUserTickets] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  /**
   * すべてのロッタリーを取得
   */
  const fetchLotteries = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await api.getLotteries();
      
      if (response.success && response.lotteries) {
        setLotteries(response.lotteries);
        
        // 現在時刻を取得
        const currentTime = Math.floor(Date.now() / 1000);
        
        // アクティブと過去のロッタリーに分類
        const active = response.lotteries.filter(lottery => 
          lottery.endTime > currentTime
        );
        const past = response.lotteries.filter(lottery => 
          lottery.endTime <= currentTime
        );
        
        setActiveLotteries(active);
        setPastLotteries(past);
        
        setIsLoading(false);
        return response.lotteries;
      }
      
      setIsLoading(false);
      return [];
    } catch (err) {
      console.error('ロッタリー取得エラー:', err);
      setError(err.message || 'ロッタリー取得エラー');
      setIsLoading(false);
      return [];
    }
  }, []);
  
  /**
   * アクティブなロッタリーのみを取得
   */
  const fetchActiveLotteries = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await api.getActiveLotteries();
      
      if (response.success && response.lotteries) {
        setActiveLotteries(response.lotteries);
        setIsLoading(false);
        return response.lotteries;
      }
      
      setIsLoading(false);
      return [];
    } catch (err) {
      console.error('アクティブなロッタリー取得エラー:', err);
      setError(err.message || 'アクティブなロッタリー取得エラー');
      setIsLoading(false);
      return [];
    }
  }, []);
  
  /**
   * 特定のロッタリーの詳細を取得
   * @param {number} lotteryId - ロッタリーID
   */
  const fetchLotteryDetails = useCallback(async (lotteryId) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await api.getLotteryDetails(lotteryId);
      
      if (response.success && response.lottery) {
        // 既存のロッタリーリストを更新
        setLotteries(prevLotteries => {
          const updatedLotteries = [...prevLotteries];
          const index = updatedLotteries.findIndex(l => l.id === lotteryId);
          
          if (index !== -1) {
            updatedLotteries[index] = response.lottery;
          } else {
            updatedLotteries.push(response.lottery);
          }
          
          return updatedLotteries;
        });
        
        setIsLoading(false);
        return response.lottery;
      }
      
      setIsLoading(false);
      return null;
    } catch (err) {
      console.error(`ロッタリー詳細取得エラー (ID: ${lotteryId}):`, err);
      setError(err.message || 'ロッタリー詳細取得エラー');
      setIsLoading(false);
      return null;
    }
  }, []);
  
  /**
   * ユーザーのチケットを取得
   * @param {number} lotteryId - ロッタリーID
   */
  const fetchUserTickets = useCallback(async (lotteryId) => {
    if (!account) {
      return [];
    }
    
    setIsLoading(true);
    
    try {
      const response = await api.getUserTickets(lotteryId, account);
      
      if (response.success && response.tickets) {
        // チケットデータを更新
        setUserTickets(prev => ({
          ...prev,
          [lotteryId]: response.tickets
        }));
        
        setIsLoading(false);
        return response.tickets;
      }
      
      setIsLoading(false);
      return [];
    } catch (err) {
      console.error(`ユーザーチケット取得エラー (Lottery: ${lotteryId}, User: ${account}):`, err);
      setIsLoading(false);
      return [];
    }
  }, [account]);
  
  /**
   * すべてのロッタリーのユーザーチケットを取得
   */
  const fetchAllUserTickets = useCallback(async () => {
    if (!account || lotteries.length === 0) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      const promises = lotteries.map(lottery => 
        api.getUserTickets(lottery.id, account)
      );
      
      const results = await Promise.all(promises);
      
      const ticketsByLottery = {};
      results.forEach((response, index) => {
        if (response.success && response.tickets) {
          ticketsByLottery[lotteries[index].id] = response.tickets;
        }
      });
      
      setUserTickets(ticketsByLottery);
      setIsLoading(false);
    } catch (err) {
      console.error('全ユーザーチケット取得エラー:', err);
      setIsLoading(false);
    }
  }, [account, lotteries]);
  
  /**
   * ユーザーがロッタリーの当選者かどうかを確認
   * @param {number} lotteryId - ロッタリーID
   */
  const checkIfWinner = useCallback(async (lotteryId) => {
    if (!account) {
      return false;
    }
    
    try {
      const response = await api.checkIfWinner(lotteryId, account);
      
      if (response.success) {
        return response.isWinner;
      }
      
      return false;
    } catch (err) {
      console.error(`当選確認エラー (Lottery: ${lotteryId}, User: ${account}):`, err);
      return false;
    }
  }, [account]);
  
  /**
   * ロッタリーチケットを購入
   * @param {number} lotteryId - ロッタリーID
   * @param {string} tokenAddress - 支払いトークンのアドレス
   * @param {number} quantity - チケット数
   */
  const purchaseTickets = useCallback(async (lotteryId, tokenAddress, quantity) => {
    if (!account) {
      throw new Error('ウォレットが接続されていません');
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await api.purchaseTickets(lotteryId, tokenAddress, quantity);
      
      if (response.success) {
        // 購入後にチケットを再取得
        await fetchUserTickets(lotteryId);
        
        setIsLoading(false);
        return response;
      }
      
      throw new Error(response.error || 'チケット購入に失敗しました');
    } catch (err) {
      console.error(`チケット購入エラー (Lottery: ${lotteryId}):`, err);
      setError(err.message || 'チケット購入エラー');
      setIsLoading(false);
      throw err;
    }
  }, [account, fetchUserTickets]);
  
  /**
   * 複数のロッタリーで一括チケット購入
   * @param {Array} selections - 購入選択の配列 [{lotteryId, tokenAddress, quantity}]
   */
  const batchPurchaseTickets = useCallback(async (selections) => {
    if (!account) {
      throw new Error('ウォレットが接続されていません');
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await api.batchPurchaseTickets(selections);
      
      if (response.success) {
        // 購入後にすべてのチケットを再取得
        const lotteryIds = [...new Set(selections.map(s => s.lotteryId))];
        await Promise.all(lotteryIds.map(id => fetchUserTickets(id)));
        
        setIsLoading(false);
        return response;
      }
      
      throw new Error(response.error || 'バッチチケット購入に失敗しました');
    } catch (err) {
      console.error('バッチチケット購入エラー:', err);
      setError(err.message || 'バッチチケット購入エラー');
      setIsLoading(false);
      throw err;
    }
  }, [account, fetchUserTickets]);
  
  /**
   * 賞金を請求
   * @param {number} lotteryId - ロッタリーID
   */
  const claimPrize = useCallback(async (lotteryId) => {
    if (!account) {
      throw new Error('ウォレットが接続されていません');
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await api.claimPrize(lotteryId);
      
      if (response.success) {
        setIsLoading(false);
        return response;
      }
      
      throw new Error(response.error || '賞金請求に失敗しました');
    } catch (err) {
      console.error(`賞金請求エラー (Lottery: ${lotteryId}):`, err);
      setError(err.message || '賞金請求エラー');
      setIsLoading(false);
      throw err;
    }
  }, [account]);
  
  // 初期ロード時またはアカウント変更時にロッタリーを取得
  useEffect(() => {
    fetchLotteries();
  }, [fetchLotteries]);
  
  // アカウントが変更されたら、ユーザーのチケットを再取得
  useEffect(() => {
    if (account && lotteries.length > 0) {
      fetchAllUserTickets();
    }
  }, [account, lotteries.length, fetchAllUserTickets]);
  
  return {
    lotteries,
    activeLotteries,
    pastLotteries,
    userTickets,
    isLoading,
    error,
    fetchLotteries,
    fetchActiveLotteries,
    fetchLotteryDetails,
    fetchUserTickets,
    fetchAllUserTickets,
    checkIfWinner,
    purchaseTickets,
    batchPurchaseTickets,
    claimPrize
  };
};

export default useLotteries;