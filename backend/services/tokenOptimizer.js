// backend/services/tokenOptimizer.js

const axios = require('axios');

/**
 * AI Token Optimizer Service
 * 
 * このサービスはユーザーのウォレット内のトークンを分析し、
 * 残高、価格のボラティリティ、スリッページなど複数の要素に基づいて
 * ガス代支払い用に最適なトークンを見つけます。
 */
class TokenOptimizer {
  constructor(config = {}) {
    this.priceApiUrl = config.priceApiUrl || 'https://api.coingecko.com/api/v3';
    this.priceApiKey = config.priceApiKey || '';
    this.cacheExpiryTime = config.cacheExpiryTime || 5 * 60 * 1000; // 5分間のキャッシュ
    
    // キャッシュ
    this.priceCache = new Map();
    this.volatilityCache = new Map();
    this.slippageCache = new Map();
  }

  /**
   * ガス代支払いに最適なトークンを見つける
   * @param {Array} tokens - ユーザーのウォレット内のトークン配列
   * @param {Object} userPreferences - ユーザー設定
   * @returns {Object} - スコアと理由を含むおすすめトークン
   */
  async findOptimalToken(tokens, userPreferences = {}) {
    if (!tokens || tokens.length === 0) {
      throw new Error('最適化するトークンが提供されていません');
    }

    // 必要なフィールドを持つトークンのみをフィルタリング
    const validTokens = tokens.filter(token => 
      token.address && token.balance && parseFloat(token.balance) > 0
    );

    if (validTokens.length === 0) {
      throw new Error('有効なトークンが見つかりません');
    }

    // すべてのトークンの価格データを取得
    const priceData = await this.getPriceData(validTokens);
    
    // ボラティリティデータを取得
    const volatilityData = await this.getVolatilityData(validTokens);
    
    // スリッページ推定値を取得
    const slippageData = await this.getSlippageData(validTokens);
    
    // 各トークンをスコアリング
    const scoredTokens = validTokens.map(token => {
      const address = token.address.toLowerCase();
      
      // トークン残高のUSD価値を計算
      const price = priceData[address]?.price || 0;
      const usdBalance = parseFloat(token.balance) * price;
      
      // 価格データがないか、USD価値がゼロのトークンをスキップ
      if (price <= 0 || usdBalance <= 0) {
        return {
          ...token,
          score: 0,
          reasons: ['価格データが利用できないか、価値がゼロです']
        };
      }
      
      // ボラティリティを取得（低いほど良い）
      const volatility = volatilityData[address]?.volatility24h || 100;
      const volatilityScore = this._normalizeVolatility(volatility);
      
      // スリッページを取得（低いほど良い）
      const slippage = slippageData[address]?.slippage || 10;
      const slippageScore = this._normalizeSlippage(slippage);
      
      // 残高スコアを計算
      const balanceScore = this._normalizeBalance(usdBalance);
      
      // 重み付けスコアを計算
      const weights = userPreferences.weights || {
        balance: 0.4,      // 残高の重み 40%
        volatility: 0.3,   // ボラティリティの重み 30%
        slippage: 0.3      // スリッページの重み 30%
      };
      
      const score = (
        (weights.balance * balanceScore) +
        (weights.volatility * volatilityScore) +
        (weights.slippage * slippageScore)
      );
      
      // 人間が読みやすい理由を生成
      const reasons = this._generateReasons(
        usdBalance,
        volatility,
        slippage,
        userPreferences
      );
      
      return {
        ...token,
        usdBalance,
        usdPrice: price,
        volatility,
        volatilityScore,
        slippage,
        slippageScore,
        balanceScore,
        score,
        reasons
      };
    });
    
    // スコア順に並べ替え（降順）
    const sortedTokens = scoredTokens
      .filter(token => token.score > 0)
      .sort((a, b) => b.score - a.score);
    
    if (sortedTokens.length === 0) {
      throw new Error('スコアリング後に適切なトークンが見つかりませんでした');
    }
    
    // トップトークンとすべてのスコアを返す
    return {
      recommendedToken: sortedTokens[0],
      allScores: sortedTokens,
      factors: {
        balanceWeight: userPreferences.weights?.balance || 0.4,
        volatilityWeight: userPreferences.weights?.volatility || 0.3,
        slippageWeight: userPreferences.weights?.slippage || 0.3
      }
    };
  }

  /**
   * トークンの価格データを取得
   * @param {Array} tokens - トークン配列
   * @returns {Object} - 各トークンの価格データ
   */
  async getPriceData(tokens) {
    try {
      const addresses = tokens.map(token => token.address.toLowerCase());
      
      // まずキャッシュをチェック
      const cachedData = {};
      const addressesToFetch = [];
      
      for (const address of addresses) {
        const cacheEntry = this.priceCache.get(address);
        if (cacheEntry && Date.now() - cacheEntry.timestamp < this.cacheExpiryTime) {
          cachedData[address] = { price: cacheEntry.price };
        } else {
          addressesToFetch.push(address);
        }
      }
      
      // すべてのデータがキャッシュされている場合、それを返す
      if (addressesToFetch.length === 0) {
        return cachedData;
      }
      
      // 本番環境では価格APIを呼び出す
      // const response = await axios.get(
      //   `${this.priceApiUrl}/simple/token_price/ethereum?contract_addresses=${addressesToFetch.join(',')}&vs_currencies=usd&x_cg_api_key=${this.priceApiKey}`
      // );
      
      // モックデータ（デモ用）
      const mockPrices = {
        // ステーブルコイン
        '0x6b175474e89094c44da98b954eedeac495271d0f': 1.0, // DAI
        '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 1.0, // USDC
        '0xdac17f958d2ee523a2206206994597c13d831ec7': 1.0, // USDT
        
        // 主要暗号資産
        '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': 42000, // WBTC
        '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': 2800,  // WETH
        
        // DeFiトークン
        '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984': 8.5,  // UNI
        '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9': 120,  // AAVE
        '0x0bc529c00c6401aef6d220be8c6ea1667f6ad93e': 15000 // YFI
      };
      
      // データを処理しキャッシュを更新
      const result = { ...cachedData };
      
      for (const address of addressesToFetch) {
        // モック価格を使用するか、不明なトークンにはランダムな価格を生成
        const price = mockPrices[address] || (Math.random() * 10 + 0.1);
        
        // キャッシュを更新
        this.priceCache.set(address, {
          price,
          timestamp: Date.now()
        });
        
        result[address] = { price };
      }
      
      return result;
    } catch (error) {
      console.error('価格データの取得エラー:', error);
      return {};
    }
  }

  /**
   * トークンのボラティリティデータを取得
   * @param {Array} tokens - トークン配列
   * @returns {Object} - 各トークンのボラティリティデータ
   */
  async getVolatilityData(tokens) {
    try {
      const addresses = tokens.map(token => token.address.toLowerCase());
      
      // ボラティリティのモックデータ（低いほど安定）
      const mockVolatility = {
        // ステーブルコイン（非常に低いボラティリティ）
        '0x6b175474e89094c44da98b954eedeac495271d0f': 0.2, // DAI
        '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 0.1, // USDC
        '0xdac17f958d2ee523a2206206994597c13d831ec7': 0.15, // USDT
        
        // 主要暗号資産（中程度のボラティリティ）
        '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': 3.5, // WBTC
        '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': 4.2, // WETH
        
        // DeFiトークン（高いボラティリティ）
        '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984': 8.7, // UNI
        '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9': 9.3, // AAVE
        '0x0bc529c00c6401aef6d220be8c6ea1667f6ad93e': 12.5 // YFI
      };
      
      // データを処理
      const result = {};
      
      for (const address of addresses) {
        // モックボラティリティを使用するか、ランダム生成
        const volatility = mockVolatility[address] !== undefined
          ? mockVolatility[address]
          : (Math.random() * 14 + 1); // ランダム 1-15%
        
        result[address] = { volatility24h: volatility };
      }
      
      return result;
    } catch (error) {
      console.error('ボラティリティデータの取得エラー:', error);
      return {};
    }
  }

  /**
   * トークンのスリッページ推定値を取得
   * @param {Array} tokens - トークン配列
   * @returns {Object} - 各トークンのスリッページデータ
   */
  async getSlippageData(tokens) {
    try {
      const addresses = tokens.map(token => token.address.toLowerCase());
      
      // スリッページのモックデータ（低いほど流動性が高い）
      const mockSlippage = {
        // 高流動性トークン（低スリッページ）
        '0x6b175474e89094c44da98b954eedeac495271d0f': 0.1, // DAI
        '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 0.05, // USDC
        '0xdac17f958d2ee523a2206206994597c13d831ec7': 0.08, // USDT
        '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': 0.3, // WBTC
        '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': 0.2, // WETH
        
        // 中流動性トークン
        '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984': 1.2, // UNI
        '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9': 1.8, // AAVE
        
        // 低流動性トークン
        '0x0bc529c00c6401aef6d220be8c6ea1667f6ad93e': 3.5 // YFI
      };
      
      // データを処理
      const result = {};
      
      for (const address of addresses) {
        // モックスリッページを使用するか、ランダム生成
        const slippage = mockSlippage[address] !== undefined
          ? mockSlippage[address]
          : (Math.random() * 4.5 + 0.5); // ランダム 0.5-5%
        
        result[address] = { 
          slippage,
          estimatedFee: slippage * 0.5 // 単純な手数料推定
        };
      }
      
      return result;
    } catch (error) {
      console.error('スリッページデータの取得エラー:', error);
      return {};
    }
  }

  /**
   * USD残高を0-1のスコアに正規化
   * @param {number} usdBalance - トークン残高（USD）
   * @returns {number} - 正規化された残高スコア
   */
  _normalizeBalance(usdBalance) {
    // 最小残高しきい値
    const minBalance = 5;
    
    if (usdBalance < minBalance) {
      // 少額残高は比例的に低いスコア
      return 0.3 * (usdBalance / minBalance);
    }
    
    // 幅広い残高範囲を処理するための対数スケール
    // ln(100) ≈ 4.6, $100の残高で約1.0のスコアになるよう5で割る
    const logScore = Math.min(1, Math.log(usdBalance) / 5);
    return logScore;
  }

  /**
   * ボラティリティを0-1のスコアに正規化（高いスコア = 良い）
   * @param {number} volatility - ボラティリティの割合
   * @returns {number} - 正規化されたボラティリティスコア
   */
  _normalizeVolatility(volatility) {
    // ボラティリティが低いほど良い
    // 0%のボラティリティ = 1.0のスコア、15%のボラティリティ = 0.0のスコア
    return Math.max(0, 1 - (volatility / 15));
  }

  /**
   * スリッページを0-1のスコアに正規化（高いスコア = 良い）
   * @param {number} slippage - スリッページの割合
   * @returns {number} - 正規化されたスリッページスコア
   */
  _normalizeSlippage(slippage) {
    // スリッページが低いほど良い
    // 0%のスリッページ = 1.0のスコア、5%のスリッページ = 0.0のスコア
    return Math.max(0, 1 - (slippage / 5));
  }

  /**
   * 推奨理由を人間が読みやすい形で生成
   * @param {number} usdBalance - トークン残高（USD）
   * @param {number} volatility - ボラティリティの割合
   * @param {number} slippage - スリッページの割合
   * @param {Object} userPreferences - ユーザー設定
   * @returns {Array} - 理由の文字列配列
   */
  _generateReasons(usdBalance, volatility, slippage, userPreferences) {
    const reasons = [];
    
    // 残高に関する理由
    if (usdBalance >= 100) {
      reasons.push(`残高が多い（$${usdBalance.toFixed(2)}）ため柔軟性があります`);
    } else if (usdBalance >= 20) {
      reasons.push(`適度な残高（$${usdBalance.toFixed(2)}）があります`);
    } else {
      reasons.push(`残高は限られている（$${usdBalance.toFixed(2)}）ものの、使用可能です`);
    }
    
    // ボラティリティに関する理由
    if (volatility < 1) {
      reasons.push(`非常に安定した価格（24時間変動率${volatility.toFixed(2)}%）`);
    } else if (volatility < 3) {
      reasons.push(`とても安定した価格（24時間変動率${volatility.toFixed(2)}%）`);
    } else if (volatility < 7) {
      reasons.push(`中程度の価格安定性（24時間変動率${volatility.toFixed(2)}%）`);
    } else {
      reasons.push(`ボラティリティが高め（24時間変動率${volatility.toFixed(2)}%）ですが、許容範囲内`);
    }
    
    // スリッページに関する理由
    if (slippage < 0.5) {
      reasons.push(`優れた流動性で最小のスリッページ（${slippage.toFixed(2)}%）`);
    } else if (slippage < 1.5) {
      reasons.push(`良好な流動性で低いスリッページ（${slippage.toFixed(2)}%）`);
    } else if (slippage < 3) {
      reasons.push(`適切な流動性で中程度のスリッページ（${slippage.toFixed(2)}%）`);
    } else {
      reasons.push(`流動性が限られており、高いスリッページ（${slippage.toFixed(2)}%）`);
    }
    
    return reasons;
  }
}

module.exports = TokenOptimizer;