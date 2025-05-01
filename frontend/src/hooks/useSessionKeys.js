// frontend/src/hooks/useSessionKeys.js

import { useState, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';
import { api } from '../services/api';
import useWallet from './useWallet';

/**
 * セッションキー機能のためのカスタムフック
 * クイックプレイ機能のためのセッションキーを管理します
 */
export const useSessionKeys = () => {
  const { account, signer } = useWallet();
  const [hasActiveSessionKey, setHasActiveSessionKey] = useState(false);
  const [sessionKeyDetails, setSessionKeyDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // ローカルストレージからセッションキー情報をロード
  const loadSessionKeyFromStorage = useCallback(() => {
    if (!account) return null;
    
    try {
      const storedData = localStorage.getItem(`sessionKey_${account.toLowerCase()}`);
      if (!storedData) return null;
      
      const sessionData = JSON.parse(storedData);
      
      // 有効期限をチェック
      if (sessionData.expiresAt && sessionData.expiresAt > Date.now() / 1000) {
        setHasActiveSessionKey(true);
        setSessionKeyDetails(sessionData);
        return sessionData;
      } else {
        // 期限切れの場合は削除
        localStorage.removeItem(`sessionKey_${account.toLowerCase()}`);
        setHasActiveSessionKey(false);
        setSessionKeyDetails(null);
        return null;
      }
    } catch (err) {
      console.error('セッションキー読み込みエラー:', err);
      setHasActiveSessionKey(false);
      setSessionKeyDetails(null);
      return null;
    }
  }, [account]);
  
  // セッションキーをローカルストレージに保存
  const saveSessionKeyToStorage = useCallback((sessionData) => {
    if (!account) return;
    
    try {
      localStorage.setItem(
        `sessionKey_${account.toLowerCase()}`,
        JSON.stringify(sessionData)
      );
    } catch (err) {
      console.error('セッションキー保存エラー:', err);
    }
  }, [account]);
  
  // ランダムなセッションキーの生成
  const generateSessionKey = useCallback(() => {
    const wallet = ethers.Wallet.createRandom();
    return {
      address: wallet.address,
      privateKey: wallet.privateKey
    };
  }, []);
  
  /**
   * セッションキーを作成
   * @param {number} duration - 有効期間（秒）
   */
  const createSessionKey = useCallback(async (duration) => {
    if (!account || !signer) {
      throw new Error('ウォレットが接続されていません');
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // ランダムなセッションキーを生成
      const newSessionKey = generateSessionKey();
      
      // 必要なデータ構造を作成
      const currentTime = Math.floor(Date.now() / 1000);
      const expiresAt = currentTime + duration;
      
      // APIを呼び出してセッションキーを登録
      const message = `AlpacaLotto: セッションキー ${newSessionKey.address} を ${expiresAt} まで有効化します。`;
      const signature = await signer.signMessage(message);
      
      const response = await api.createSessionKey(duration, signature);
      
      if (response.success) {
        // セッションキー詳細を設定
        const sessionData = {
          key: newSessionKey,
          expiresAt: expiresAt,
          createdAt: currentTime,
          message,
          signature
        };
        
        // ステートとストレージを更新
        setSessionKeyDetails(sessionData);
        setHasActiveSessionKey(true);
        saveSessionKeyToStorage(sessionData);
        
        setIsLoading(false);
        return sessionData;
      }
      
      throw new Error(response.error || 'セッションキー作成に失敗しました');
    } catch (err) {
      console.error('セッションキー作成エラー:', err);
      setError(err.message || 'セッションキー作成エラー');
      setIsLoading(false);
      throw err;
    }
  }, [account, signer, generateSessionKey, saveSessionKeyToStorage]);
  
  /**
   * セッションキーを無効化
   */
  const revokeSessionKey = useCallback(async () => {
    if (!account || !signer) {
      throw new Error('ウォレットが接続されていません');
    }
    
    if (!sessionKeyDetails) {
      throw new Error('アクティブなセッションキーがありません');
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // メッセージに署名
      const message = `AlpacaLotto: セッションキー ${sessionKeyDetails.key.address} を無効化します。`;
      const signature = await signer.signMessage(message);
      
      // APIを呼び出してセッションキーを無効化
      const response = await api.revokeSessionKey(
        sessionKeyDetails.key.address, 
        signature
      );
      
      if (response.success) {
        // ステートとストレージをクリア
        setSessionKeyDetails(null);
        setHasActiveSessionKey(false);
        localStorage.removeItem(`sessionKey_${account.toLowerCase()}`);
        
        setIsLoading(false);
        return true;
      }
      
      throw new Error(response.error || 'セッションキー無効化に失敗しました');
    } catch (err) {
      console.error('セッションキー無効化エラー:', err);
      setError(err.message || 'セッションキー無効化エラー');
      setIsLoading(false);
      throw err;
    }
  }, [account, signer, sessionKeyDetails]);
  
  /**
   * セッションキーの残り時間（秒）を取得
   */
  const getTimeRemaining = useCallback(() => {
    if (!hasActiveSessionKey || !sessionKeyDetails) {
      return 0;
    }
    
    const currentTime = Math.floor(Date.now() / 1000);
    const remaining = sessionKeyDetails.expiresAt - currentTime;
    
    return Math.max(0, remaining);
  }, [hasActiveSessionKey, sessionKeyDetails]);
  
  /**
   * セッションキーが特定の時間内に期限切れになるかどうかをチェック
   * @param {number} withinSeconds - チェックする期間（秒）
   */
  const isExpiringWithin = useCallback((withinSeconds) => {
    const remaining = getTimeRemaining();
    return remaining > 0 && remaining <= withinSeconds;
  }, [getTimeRemaining]);
  
  // マウント時およびアカウント変更時にセッションキーをロード
  useEffect(() => {
    if (account) {
      loadSessionKeyFromStorage();
    }
  }, [account, loadSessionKeyFromStorage]);
  
  // 1分ごとにセッションキーの有効期限をチェック
  useEffect(() => {
    if (!hasActiveSessionKey) return;
    
    const checkInterval = setInterval(() => {
      const remaining = getTimeRemaining();
      
      if (remaining <= 0) {
        // 期限切れになったらステートとストレージをクリア
        setSessionKeyDetails(null);
        setHasActiveSessionKey(false);
        localStorage.removeItem(`sessionKey_${account?.toLowerCase()}`);
      }
    }, 60 * 1000); // 1分ごと
    
    return () => clearInterval(checkInterval);
  }, [account, hasActiveSessionKey, getTimeRemaining]);
  
  return {
    hasActiveSessionKey,
    sessionKeyDetails,
    isLoading,
    error,
    createSessionKey,
    revokeSessionKey,
    getTimeRemaining,
    isExpiringWithin
  };
};

export default useSessionKeys;