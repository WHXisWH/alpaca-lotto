// frontend/src/pages/PaymentPage.jsx

import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useWallet from '../hooks/useWallet';
import useUserOp from '../hooks/useUserOp';
import useTokens from '../hooks/useTokens';
import useSessionKeys from '../hooks/useSessionKeys';

/**
 * チケット購入の支払いを処理するページ
 */
const PaymentPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { lottery, token, quantity, recommendation } = location.state || {};
  
  // カスタムフック
  const { signer, account, connectWallet } = useWallet();
  const { 
    executeTicketPurchase, 
    isLoading: purchaseLoading, 
    error: purchaseError, 
    txHash 
  } = useUserOp();
  const { hasActiveSessionKey } = useSessionKeys();
  
  // 状態
  const [paymentType, setPaymentType] = useState(0); // デフォルトはスポンサード (タイプ 0)
  const [paymentToken, setPaymentToken] = useState(token);
  const [transactionStatus, setTransactionStatus] = useState('preparing'); // 'preparing', 'processing', 'success', 'error'
  const [estimatedGas, setEstimatedGas] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  
  // ロッタリーまたはトークンがない場合はホームに戻る
  useEffect(() => {
    if (!lottery || !token) {
      navigate('/');
    }
  }, [lottery, token, navigate]);
  
  // ウォレットが接続されていなければ接続
  useEffect(() => {
    if (!account) {
      connectWallet();
    }
  }, [account, connectWallet]);
  
  // 支払いタイプ変更のハンドラー
  const handlePaymentTypeChange = (e) => {
    setPaymentType(parseInt(e.target.value));
  };
  
  // 支払いトークン変更のハンドラー
  const handlePaymentTokenChange = (selectedToken) => {
    setPaymentToken(selectedToken);
  };
  
  // トランザクション送信のハンドラー
  const handleSubmitTransaction = async () => {
    if (!signer || !lottery || !token) {
      setErrorMessage('ウォレットが接続されていないか、必要な情報が不足しています');
      return;
    }
    
    setTransactionStatus('processing');
    
    try {
      // チケット購入トランザクションを実行
      const hash = await executeTicketPurchase({
        signer,
        lotteryId: lottery.id,
        tokenAddress: token.address,
        quantity,
        paymentType,
        paymentToken: paymentToken?.address,
        useSessionKey: hasActiveSessionKey
      });
      
      // 成功したらステータスを更新
      if (hash) {
        setTransactionStatus('success');
      }
    } catch (error) {
      console.error('トランザクションエラー:', error);
      setErrorMessage(error.message || 'トランザクションに失敗しました');
      setTransactionStatus('error');
    }
  };
  
  // ホームに戻る
  const handleGoBack = () => {
    navigate('/');
  };
  
  // ガス代の推定額を計算
  const calculateEstimatedGas = () => {
    // この実装は簡易的なもので、実際には正確なガス推定が必要
    if (paymentType === 0) {
      return '無料 (スポンサー付き)';
    } else if (paymentToken) {
      return `約 ${(0.001).toFixed(6)} ${paymentToken.symbol}`;
    }
    return '計算中...';
  };
  
  // 合計コストを計算（チケット料金 + ガス代）
  const calculateTotalCost = () => {
    if (!lottery || !token) return '0';
    
    // チケット総額
    const ticketTotal = lottery.ticketPrice * quantity;
    
    // トークンでの支払い額を計算
    const tokenPrice = token.usdPrice || 1;
    const totalTokens = ticketTotal / tokenPrice;
    
    return totalTokens.toFixed(6);
  };
  
  // ロッタリーまたはトークンがない場合
  if (!lottery || !token) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>情報を読み込み中...</p>
      </div>
    );
  }
  
  // トランザクション処理中
  if (transactionStatus === 'processing') {
    return (
      <div className="transaction-processing">
        <div className="processing-card">
          <div className="loading-spinner"></div>
          <h2>トランザクション処理中</h2>
          <p>チケット購入トランザクションを処理しています。しばらくお待ちください...</p>
          {hasActiveSessionKey ? (
            <p className="session-note">クイックプレイが有効なため、ウォレット確認は不要です。</p>
          ) : (
            <p className="session-note">ウォレットで操作を確認してください。</p>
          )}
        </div>
      </div>
    );
  }
  
  // トランザクション成功
  if (transactionStatus === 'success') {
    return (
      <div className="transaction-success">
        <div className="success-card">
          <div className="success-icon">✓</div>
          <h2>購入成功！</h2>
          <p>
            {quantity}枚のチケットを{lottery.name}に正常に購入しました。
          </p>
          
          <div className="transaction-details">
            <div className="detail-row">
              <span>トランザクションハッシュ:</span>
              <span className="tx-hash">{txHash}</span>
            </div>
          </div>
          
          <div className="action-buttons">
            <a 
              href={`https://explorer-testnet.nerochain.io/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="explorer-link"
            >
              エクスプローラーで表示
            </a>
            
            <button 
              className="home-button"
              onClick={handleGoBack}
            >
              ホームに戻る
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // トランザクションエラー
  if (transactionStatus === 'error') {
    return (
      <div className="transaction-error">
        <div className="error-card">
          <div className="error-icon">✗</div>
          <h2>購入失敗</h2>
          <p>チケット購入中にエラーが発生しました。</p>
          
          <div className="error-details">
            <p className="error-message">{errorMessage || purchaseError}</p>
          </div>
          
          <div className="action-buttons">
            <button 
              className="retry-button"
              onClick={() => setTransactionStatus('preparing')}
            >
              再試行
            </button>
            
            <button 
              className="home-button"
              onClick={handleGoBack}
            >
              ホームに戻る
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // トランザクション準備（デフォルト状態）
  return (
    <div className="payment-page">
      <div className="payment-container">
        <div className="back-navigation">
          <button className="back-button" onClick={handleGoBack}>
            ← ロッタリーに戻る
          </button>
        </div>
        
        <div className="payment-card">
          <h2>チケット購入の確認</h2>
          
          <div className="lottery-summary">
            <h3>{lottery.name}</h3>
            <div className="ticket-price">
              ${lottery.ticketPrice} / チケット
            </div>
          </div>
          
          <div className="purchase-summary">
            <div className="summary-row">
              <span className="summary-label">チケット数:</span>
              <span className="summary-value">{quantity}</span>
            </div>
            
            <div className="summary-row">
              <span className="summary-label">チケット価格:</span>
              <span className="summary-value">${lottery.ticketPrice}</span>
            </div>
            
            <div className="summary-row">
              <span className="summary-label">合計USD:</span>
              <span className="summary-value">
                ${(lottery.ticketPrice * quantity).toFixed(2)}
              </span>
            </div>
            
            <div className="summary-row">
              <span className="summary-label">支払いトークン:</span>
              <span className="summary-value token-value">
                <span className="token-icon">{token.symbol.charAt(0)}</span>
                {token.symbol}
                {recommendation && recommendation.recommendedToken.address === token.address && (
                  <span className="ai-badge">AI推奨</span>
                )}
              </span>
            </div>
            
            <div className="summary-row total">
              <span className="summary-label">支払い合計:</span>
              <span className="summary-value">
                {calculateTotalCost()} {token.symbol}
              </span>
            </div>
          </div>
          
          <div className="gas-payment-section">
            <h3>ガス支払い方法</h3>
            
            <div className="payment-type-selector">
              <div className="payment-type-option">
                <input 
                  type="radio" 
                  id="payment-type-0" 
                  name="payment-type" 
                  value="0"
                  checked={paymentType === 0}
                  onChange={handlePaymentTypeChange}
                />
                <label htmlFor="payment-type-0">
                  <div className="option-title">スポンサード（無料）</div>
                  <div className="option-description">開発者がガス代を負担します</div>
                </label>
              </div>
              
              <div className="payment-type-option">
                <input 
                  type="radio" 
                  id="payment-type-1" 
                  name="payment-type" 
                  value="1"
                  checked={paymentType === 1}
                  onChange={handlePaymentTypeChange}
                />
                <label htmlFor="payment-type-1">
                  <div className="option-title">前払い（ERC20トークン）</div>
                  <div className="option-description">取引前にERC20トークンで支払い</div>
                </label>
              </div>
              
              <div className="payment-type-option">
                <input 
                  type="radio" 
                  id="payment-type-2" 
                  name="payment-type" 
                  value="2"
                  checked={paymentType === 2}
                  onChange={handlePaymentTypeChange}
                />
                <label htmlFor="payment-type-2">
                  <div className="option-title">後払い（ERC20トークン）</div>
                  <div className="option-description">取引後にERC20トークンで支払い</div>
                </label>
              </div>
            </div>
            
            {(paymentType === 1 || paymentType === 2) && (
              <div className="payment-token-selector">
                <h4>ガス支払い用トークン</h4>
                <div className="token-options">
                  <div 
                    className={`token-option ${paymentToken?.address === token.address ? 'selected' : ''}`}
                    onClick={() => handlePaymentTokenChange(token)}
                  >
                    <div className="token-icon">{token.symbol.charAt(0)}</div>
                    <div className="token-details">
                      <div className="token-name">{token.symbol}</div>
                      <div className="token-balance">{parseFloat(token.balance).toFixed(4)}</div>
                    </div>
                  </div>
                  
                  {recommendation && recommendation.recommendedToken.address !== token.address && (
                    <div 
                      className={`token-option ${paymentToken?.address === recommendation.recommendedToken.address ? 'selected' : ''}`}
                      onClick={() => handlePaymentTokenChange(recommendation.recommendedToken)}
                    >
                      <div className="token-icon">{recommendation.recommendedToken.symbol.charAt(0)}</div>
                      <div className="token-details">
                        <div className="token-name">{recommendation.recommendedToken.symbol}</div>
                        <div className="token-balance">{parseFloat(recommendation.recommendedToken.balance).toFixed(4)}</div>
                      </div>
                      <div className="ai-badge">AI推奨</div>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            <div className="gas-estimate">
              <span className="estimate-label">推定ガス料金:</span>
              <span className="estimate-value">{calculateEstimatedGas()}</span>
            </div>
            
            {hasActiveSessionKey && (
              <div className="session-key-notice">
                <div className="notice-icon">🔑</div>
                <div className="notice-text">
                  クイックプレイが有効です - ウォレット確認は不要です！
                </div>
              </div>
            )}
          </div>
          
          <div className="action-buttons">
            <button 
              className="cancel-button"
              onClick={handleGoBack}
            >
              キャンセル
            </button>
            
            <button 
              className="confirm-button"
              onClick={handleSubmitTransaction}
              disabled={purchaseLoading}
            >
              {purchaseLoading ? '処理中...' : '購入を確定'}
            </button>
          </div>
        </div>
        
        <div className="payment-info-card">
          <h3>アカウント抽象化について</h3>
          <p>
            NERO Chainのアカウント抽象化により、ネイティブ通貨だけでなく、任意のトークンでガス料金を支払うことができます。AIが最も費用対効果の高いオプションを分析します。
          </p>
          
          <h4>支払いタイプ</h4>
          <ul>
            <li><strong>スポンサード:</strong> 開発者が負担する無料ガス</li>
            <li><strong>前払い:</strong> 事前にERC20トークンで支払い</li>
            <li><strong>後払い:</strong> 実行後にERC20トークンで支払い</li>
          </ul>
          
          <div className="security-note">
            <div className="note-icon">🔒</div>
            <div className="note-text">
              <strong>セキュリティメモ:</strong> すべてのトランザクションはブロックチェーン上で実行され、
              完全に透明性があります。AlpacaLottoはあなたの資金を保管しません。
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentPage;