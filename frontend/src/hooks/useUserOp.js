// frontend/src/hooks/useUserOp.js

import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { Client, Presets } from 'userop';

// 環境変数から定数を取得
const NERO_RPC_URL = process.env.REACT_APP_NERO_RPC_URL || 'https://rpc-testnet.nerochain.io';
const BUNDLER_URL = process.env.REACT_APP_BUNDLER_URL || 'https://bundler-testnet.nerochain.io';
const PAYMASTER_URL = process.env.REACT_APP_PAYMASTER_URL || 'https://paymaster-testnet.nerochain.io';
const PAYMASTER_API_KEY = process.env.REACT_APP_PAYMASTER_API_KEY || '';
const ENTRYPOINT_ADDRESS = process.env.REACT_APP_ENTRYPOINT_ADDRESS || '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';
const ACCOUNT_FACTORY_ADDRESS = process.env.REACT_APP_ACCOUNT_FACTORY_ADDRESS || '0x9406Cc6185a346906296840746125a0E44976454';

/**
 * @typedef {Object} UserOpParams
 * @property {ethers.Signer} signer - 署名者
 * @property {string} tokenAddress - トークンのアドレス
 * @property {string} recipientAddress - 受信者アドレス
 * @property {number|string} amount - 送信量
 * @property {number} decimals - トークンの小数点以下桁数
 * @property {number} [paymentType] - 支払いタイプ
 * @property {string} [paymentToken] - 支払いトークンのアドレス
 */

/**
 * @typedef {Object} PaymasterParams
 * @property {number} type - 支払いタイプ
 * @property {string} [token] - トークンのアドレス
 */

/**
 * NERO ChainのAccount Abstractionを使用してUserOperationを管理するためのカスタムフック
 * @returns {Object} UserOperation関連の状態と関数
 */
export const useUserOp = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [aaWalletAddress, setAaWalletAddress] = useState(null);
  const [txHash, setTxHash] = useState(null);
  
  /**
   * クライアントとビルダーを初期化
   * @param {ethers.Signer} signer - AAウォレットを所有するEOA署名者
   * @returns {Object} - 初期化されたクライアントとビルダー
   */
  const initClient = useCallback(async (signer) => {
    try {
      // AAクライアントを初期化
      const client = await Client.init(NERO_RPC_URL, {
        overrideBundlerRpc: BUNDLER_URL,
        entryPoint: ENTRYPOINT_ADDRESS,
      });
      
      // SimpleAccountビルダーを初期化
      const builder = await Presets.Builder.SimpleAccount.init(
        signer,
        NERO_RPC_URL,
        {
          overrideBundlerRpc: BUNDLER_URL,
          entryPoint: ENTRYPOINT_ADDRESS,
          factory: ACCOUNT_FACTORY_ADDRESS,
        }
      );
      
      // AAウォレットアドレスを取得
      const aaAddress = await builder.getSender();
      setAaWalletAddress(aaAddress);
      
      return { client, builder };
    } catch (err) {
      console.error('AAクライアント初期化エラー:', err);
      setError(err.message || 'AAクライアント初期化エラー');
      throw err;
    }
  }, []);
  
  /**
   * AAウォレットがすでにデプロイされているかを確認
   * @param {string} address - 確認するAAウォレットアドレス
   * @returns {boolean} - デプロイされているかどうか
   */
  const isWalletDeployed = useCallback(async (address) => {
    const provider = new ethers.providers.JsonRpcProvider(NERO_RPC_URL);
    const code = await provider.getCode(address);
    return code !== '0x';
  }, []);
  
  /**
   * トークン転送を実行
   * @param {UserOpParams} params - トークン転送パラメータ
   * @returns {string} - トランザクションハッシュ
   */
  const executeTransfer = useCallback(async ({
    signer,
    tokenAddress,
    recipientAddress,
    amount,
    decimals,
    paymentType,
    paymentToken
  }) => {
    setIsLoading(true);
    setError(null);
    setTxHash(null);
    
    try {
      // クライアントとビルダーを初期化
      const { client, builder } = await initClient(signer);
      
      // トークンコントラクトのインスタンスを作成
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ['function transfer(address to, uint256 amount) returns (bool)'],
        signer
      );
      
      // transfer関数のコールデータを準備
      const callData = tokenContract.interface.encodeFunctionData(
        'transfer',
        [recipientAddress, ethers.utils.parseUnits(amount.toString(), decimals)]
      );
      
      // トランザクションをビルダーに追加
      builder.execute(tokenAddress, 0, callData);
      
      // 必要に応じてPaymasterを設定
      if (paymentType !== undefined && paymentType >= 0) {
        const paymasterOptions = {
          type: paymentType,
          apikey: PAYMASTER_API_KEY,
          rpc: PAYMASTER_URL
        };
        
        // タイプ1または2の場合、トークンアドレスを追加
        if ((paymentType === 1 || paymentType === 2) && paymentToken) {
          paymasterOptions.token = paymentToken;
        }
        
        builder.setPaymasterOptions(paymasterOptions);
      }
      
      // UserOperationを送信
      const result = await client.sendUserOperation(builder);
      
      // UserOperationハッシュを取得
      const userOpHash = result.userOpHash;
      console.log("UserOperation hash:", userOpHash);
      
      // トランザクションがマイニングされるのを待機
      const receipt = await result.wait();
      
      // nullチェックを追加
      if (receipt) {
        console.log("Transaction hash:", receipt.transactionHash);
        setTxHash(receipt.transactionHash);
        setIsLoading(false);
        return receipt.transactionHash;
      } else {
        throw new Error("トランザクションレシートがnullです");
      }
    } catch (err) {
      console.error("UserOperation送信エラー:", err);
      setError(err.message || 'UserOperation送信エラー');
      setIsLoading(false);
      throw err;
    }
  }, [initClient]);
  
  /**
   * バッチトランザクションを実行
   * @param {Object} params - バッチパラメータ
   * @returns {string} - トランザクションハッシュ
   */
  const executeBatch = useCallback(async ({
    signer,
    calls,
    paymentType,
    paymentToken
  }) => {
    setIsLoading(true);
    setError(null);
    setTxHash(null);
    
    try {
      // クライアントとビルダーを初期化
      const { client, builder } = await initClient(signer);
      
      // コールターゲットとデータを抽出
      const callTo = calls.map(call => call.to);
      const callData = calls.map(call => call.data);
      const callValue = calls.map(call => call.value || 0);
      
      // バッチ実行をビルダーに追加
      if (callValue.some(value => value > 0)) {
        // 値を含む呼び出しがある場合
        builder.executeBatch(callTo, callData);
      } else {
        // シンプルなバッチ実行
        builder.executeBatch(callTo, callData);
      }
      
      // 必要に応じてPaymasterを設定
      if (paymentType !== undefined && paymentType >= 0) {
        const paymasterOptions = {
          type: paymentType,
          apikey: PAYMASTER_API_KEY,
          rpc: PAYMASTER_URL
        };
        
        // タイプ1または2の場合、トークンアドレスを追加
        if ((paymentType === 1 || paymentType === 2) && paymentToken) {
          paymasterOptions.token = paymentToken;
        }
        
        builder.setPaymasterOptions(paymasterOptions);
      }
      
      // UserOperationを送信
      const result = await client.sendUserOperation(builder);
      
      // UserOperationハッシュを取得
      const userOpHash = result.userOpHash;
      console.log("UserOperation hash:", userOpHash);
      
      // トランザクションがマイニングされるのを待機
      const receipt = await result.wait();
      
      if (receipt) {
        console.log("Transaction hash:", receipt.transactionHash);
        setTxHash(receipt.transactionHash);
        setIsLoading(false);
        return receipt.transactionHash;
      } else {
        throw new Error("トランザクションレシートがnullです");
      }
    } catch (err) {
      console.error("バッチUserOperation送信エラー:", err);
      setError(err.message || 'バッチUserOperation送信エラー');
      setIsLoading(false);
      throw err;
    }
  }, [initClient]);
  
  /**
   * UserOperationのPaymasterデータを取得
   * @param {Object} builder - SimpleAccountビルダー
   * @param {PaymasterParams} params - Paymasterパラメータ
   * @returns {Object} - 更新されたビルダー
   */
  const getPaymasterData = useCallback(async (
    builder,
    { type, token }
  ) => {
    try {
      const paymasterOptions = {
        type,
        apikey: PAYMASTER_API_KEY,
        rpc: PAYMASTER_URL
      };
      
      // タイプ1または2の場合、トークンアドレスを追加
      if ((type === 1 || type === 2) && token) {
        paymasterOptions.token = token;
      }
      
      builder.setPaymasterOptions(paymasterOptions);
      
      return builder;
    } catch (err) {
      console.error("Paymasterデータ取得エラー:", err);
      throw err;
    }
  }, []);
  
  /**
   * ロッタリーチケットを購入するUserOperationを実行
   * @param {Object} params - チケット購入パラメータ
   * @returns {string} - トランザクションハッシュ
   */
  const executeTicketPurchase = useCallback(async ({
    signer,
    lotteryId,
    tokenAddress,
    quantity,
    paymentType = 0,
    paymentToken = null
  }) => {
    setIsLoading(true);
    setError(null);
    setTxHash(null);
    
    try {
      // クライアントとビルダーを初期化
      const { client, builder } = await initClient(signer);
      
      // ロッタリーコントラクトのアドレス（環境変数から取得または定数として設定）
      const LOTTERY_CONTRACT_ADDRESS = process.env.REACT_APP_LOTTERY_CONTRACT_ADDRESS || 
        '0x1234567890123456789012345678901234567890'; // 仮のアドレス
      
      // ロッタリーコントラクトのインターフェース（必要な関数のみ）
      const lotteryInterface = new ethers.utils.Interface([
        'function purchaseTickets(uint256 lotteryId, address tokenAddress, uint256 quantity) external'
      ]);
      
      // チケット購入関数のコールデータを準備
      const callData = lotteryInterface.encodeFunctionData(
        'purchaseTickets',
        [lotteryId, tokenAddress, quantity]
      );
      
      // トランザクションをビルダーに追加
      builder.execute(LOTTERY_CONTRACT_ADDRESS, 0, callData);
      
      // Paymasterオプションを設定
      const paymasterOptions = {
        type: paymentType,
        apikey: PAYMASTER_API_KEY,
        rpc: PAYMASTER_URL
      };
      
      // タイプ1または2の場合、トークンアドレスを追加
      if ((paymentType === 1 || paymentType === 2) && paymentToken) {
        paymasterOptions.token = paymentToken;
      }
      
      builder.setPaymasterOptions(paymasterOptions);
      
      // UserOperationを送信
      const result = await client.sendUserOperation(builder);
      
      // UserOperationハッシュを取得
      const userOpHash = result.userOpHash;
      console.log("UserOperation hash:", userOpHash);
      
      // トランザクションがマイニングされるのを待機
      const receipt = await result.wait();
      
      if (receipt) {
        console.log("Transaction hash:", receipt.transactionHash);
        setTxHash(receipt.transactionHash);
        setIsLoading(false);
        return receipt.transactionHash;
      } else {
        throw new Error("トランザクションレシートがnullです");
      }
    } catch (err) {
      console.error("チケット購入UserOperation送信エラー:", err);
      setError(err.message || 'チケット購入UserOperation送信エラー');
      setIsLoading(false);
      throw err;
    }
  }, [initClient]);
  
  /**
   * 複数のロッタリーチケットを一括購入
   * @param {Object} params - バッチ購入パラメータ
   * @returns {string} - トランザクションハッシュ
   */
  const executeBatchPurchase = useCallback(async ({
    signer,
    selections,
    paymentType = 0,
    paymentToken = null
  }) => {
    setIsLoading(true);
    setError(null);
    setTxHash(null);
    
    try {
      // クライアントとビルダーを初期化
      const { client, builder } = await initClient(signer);
      
      // ロッタリーコントラクトのアドレス
      const LOTTERY_CONTRACT_ADDRESS = process.env.REACT_APP_LOTTERY_CONTRACT_ADDRESS || 
        '0x1234567890123456789012345678901234567890'; // 仮のアドレス
      
      // ロッタリーコントラクトのインターフェース
      const lotteryInterface = new ethers.utils.Interface([
        'function batchPurchaseTickets(uint256[] lotteryIds, address[] tokenAddresses, uint256[] quantities) external'
      ]);
      
      // バッチ購入のパラメータを準備
      const lotteryIds = selections.map(s => s.lotteryId);
      const tokenAddresses = selections.map(s => s.tokenAddress);
      const quantities = selections.map(s => s.quantity);
      
      // バッチ購入関数のコールデータを準備
      const callData = lotteryInterface.encodeFunctionData(
        'batchPurchaseTickets',
        [lotteryIds, tokenAddresses, quantities]
      );
      
      // トランザクションをビルダーに追加
      builder.execute(LOTTERY_CONTRACT_ADDRESS, 0, callData);
      
      // Paymasterオプションを設定
      const paymasterOptions = {
        type: paymentType,
        apikey: PAYMASTER_API_KEY,
        rpc: PAYMASTER_URL
      };
      
      // タイプ1または2の場合、トークンアドレスを追加
      if ((paymentType === 1 || paymentType === 2) && paymentToken) {
        paymasterOptions.token = paymentToken;
      }
      
      builder.setPaymasterOptions(paymasterOptions);
      
      // UserOperationを送信
      const result = await client.sendUserOperation(builder);
      
      // UserOperationハッシュを取得
      const userOpHash = result.userOpHash;
      console.log("UserOperation hash:", userOpHash);
      
      // トランザクションがマイニングされるのを待機
      const receipt = await result.wait();
      
      if (receipt) {
        console.log("Transaction hash:", receipt.transactionHash);
        setTxHash(receipt.transactionHash);
        setIsLoading(false);
        return receipt.transactionHash;
      } else {
        throw new Error("トランザクションレシートがnullです");
      }
    } catch (err) {
      console.error("バッチチケット購入エラー:", err);
      setError(err.message || 'バッチチケット購入エラー');
      setIsLoading(false);
      throw err;
    }
  }, [initClient]);
  
  return {
    isLoading,
    error,
    txHash,
    aaWalletAddress,
    initClient,
    isWalletDeployed,
    executeTransfer,
    executeBatch,
    getPaymasterData,
    executeTicketPurchase,
    executeBatchPurchase
  };
};

export default useUserOp;