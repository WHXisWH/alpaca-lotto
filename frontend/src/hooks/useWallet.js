// frontend/src/hooks/useWallet.js

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import useUserOp from './useUserOp';

// ERC20トークン操作用のABI
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function transfer(address to, uint amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)'
];

/**
 * ウォレット接続と管理のためのカスタムフック
 * @returns {Object} ウォレット関連の状態と関数
 */
export const useWallet = () => {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [chainId, setChainId] = useState(null);
  
  // UserOpフックを使用
  const { aaWalletAddress, initClient } = useUserOp();
  
  /**
   * MetaMaskウォレットに接続
   */
  const connectWallet = useCallback(async () => {
    setIsConnecting(true);
    setConnectionError(null);
    
    try {
      // MetaMaskがインストールされているか確認
      if (!window.ethereum) {
        throw new Error('MetaMaskがインストールされていません。MetaMaskをインストールしてこのアプリを使用してください。');
      }
      
      // アカウントアクセスをリクエスト
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      // 最初のアカウントを取得
      const account = accounts[0];
      setAccount(account);
      
      // ethersプロバイダーと署名者を作成
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      setProvider(provider);
      
      const signer = provider.getSigner();
      setSigner(signer);
      
      // チェーンIDを取得
      const network = await provider.getNetwork();
      setChainId(network.chainId);
      
      // AAクライアントを初期化し、AAウォレットアドレスを取得
      if (signer) {
        await initClient(signer);
      }
      
      setIsConnecting(false);
      
      return { account, provider, signer };
    } catch (err) {
      console.error('ウォレット接続エラー:', err);
      setConnectionError(err.message || 'ウォレット接続エラー');
      setIsConnecting(false);
      throw err;
    }
  }, [initClient]);
  
  /**
   * ウォレットを切断
   */
  const disconnectWallet = useCallback(() => {
    setAccount(null);
    setProvider(null);
    setSigner(null);
    setChainId(null);
  }, []);
  
  /**
   * ウォレット内のトークンを取得
   * @param {Array} tokenAddresses - 確認するトークンアドレスの配列
   * @returns {Array} - トークンオブジェクトの配列（残高とメタデータ付き）
   */
  const getTokens = useCallback(async (tokenAddresses) => {
    if (!provider || !account) {
      throw new Error('ウォレットが接続されていません');
    }
    
    // 残高をチェックするアドレス - EOAまたはAAウォレット
    const targetAddress = aaWalletAddress || account;
    
    try {
      const tokenPromises = tokenAddresses.map(async (address) => {
        // トークンコントラクトのインスタンスを作成
        const tokenContract = new ethers.Contract(address, ERC20_ABI, provider);
        
        // トークンの詳細を取得
        const [balance, decimals, symbol, name] = await Promise.all([
          tokenContract.balanceOf(targetAddress),
          tokenContract.decimals(),
          tokenContract.symbol(),
          tokenContract.name()
        ]);
        
        // 残高をフォーマット
        const formattedBalance = ethers.utils.formatUnits(balance, decimals);
        
        return {
          address,
          symbol,
          name,
          decimals,
          balance: formattedBalance,
          rawBalance: balance.toString()
        };
      });
      
      // すべてのトークンデータを取得
      const tokens = await Promise.all(tokenPromises);
      
      // ゼロ残高のトークンを除外
      return tokens.filter(token => parseFloat(token.balance) > 0);
    } catch (err) {
      console.error('トークン取得エラー:', err);
      throw err;
    }
  }, [provider, account, aaWalletAddress]);
  
  /**
   * NERO Chainに切り替え
   */
  const switchToNeroChain = useCallback(async () => {
    if (!window.ethereum) {
      throw new Error('MetaMaskがインストールされていません');
    }
    
    try {
      // NERO Chainの詳細
      const neroChainId = '0x555503'; // NERO TestnetのチェーンID（16進数）
      
      // NERO Chainに切り替え
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: neroChainId }]
      });
      
      // 切り替え後にchainIdを更新
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const network = await provider.getNetwork();
      setChainId(network.chainId);
    } catch (err) {
      // このエラーコードは、チェーンがMetaMaskに追加されていないことを示す
      if (err.code === 4902) {
        await addNeroChain();
      } else {
        console.error('NERO Chainへの切り替えエラー:', err);
        throw err;
      }
    }
  }, []);
  
  /**
   * NERO ChainをMetaMaskに追加
   */
  const addNeroChain = useCallback(async () => {
    if (!window.ethereum) {
      throw new Error('MetaMaskがインストールされていません');
    }
    
    try {
      // NERO Chainの詳細
      const neroChainParams = {
        chainId: '0x555503', // NERO TestnetのチェーンID（16進数）
        chainName: 'NERO Chain Testnet',
        nativeCurrency: {
          name: 'NERO',
          symbol: 'NERO',
          decimals: 18
        },
        rpcUrls: ['https://rpc-testnet.nerochain.io'],
        blockExplorerUrls: ['https://explorer-testnet.nerochain.io']
      };
      
      // NERO ChainをMetaMaskに追加
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [neroChainParams]
      });
      
      // 追加後にchainIdを更新
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const network = await provider.getNetwork();
      setChainId(network.chainId);
    } catch (err) {
      console.error('NERO Chain追加エラー:', err);
      throw err;
    }
  }, []);
  
  // アカウントとチェーンの変更のためのイベントリスナーを設定
  useEffect(() => {
    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        // ユーザーがすべてのアカウントを切断した
        disconnectWallet();
      } else if (accounts[0] !== account) {
        // ユーザーがアカウントを切り替えた
        setAccount(accounts[0]);
      }
    };
    
    const handleChainChanged = (chainIdHex) => {
      // 16進数のchainIdを10進数に変換
      const chainIdDecimal = parseInt(chainIdHex, 16);
      setChainId(chainIdDecimal);
      
      // MetaMaskの推奨に従ってページをリロード
      window.location.reload();
    };
    
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
    }
    
    // イベントリスナーのクリーンアップ
    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, [account, disconnectWallet]);
  
  return {
    provider,
    signer,
    account,
    isConnecting,
    connectionError,
    chainId,
    aaWalletAddress,
    connectWallet,
    disconnectWallet,
    getTokens,
    switchToNeroChain,
    addNeroChain
  };
};

export default useWallet;