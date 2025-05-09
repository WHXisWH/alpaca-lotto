const { ethers } = require('ethers');
const { Client, Presets } = require('userop');

/**
 * UserOp Service
 * 
 * NERO Chainのアカウント抽象化を使用してトランザクションを実行するためのサービス
 * ERC-4337に基づくUserOperationの構築と送信を行います
 */
class UserOpService {
  constructor(config = {}) {
    // 設定パラメータ
    this.rpcUrl = config.rpcUrl || 'https://rpc-testnet.nerochain.io';
    this.bundlerUrl = config.bundlerUrl || 'https://bundler-testnet.nerochain.io';
    this.paymasterUrl = config.paymasterUrl || 'https://paymaster-testnet.nerochain.io';
    this.paymasterApiKey = config.paymasterApiKey || '';
    this.entryPointAddress = config.entryPointAddress || '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';
    this.accountFactoryAddress = config.accountFactoryAddress || '0x9406Cc6185a346906296840746125a0E44976454';
    
    // クライアントとビルダーの初期化
    this.client = null;
    this.builder = null;
  }

  /**
   * クライアントとビルダーを初期化
   * @param {ethers.Signer} signer - 署名者
   * @returns {Object} - 初期化されたクライアントとビルダー
   */
  async init(signer) {
    try {
      // クライアントを初期化
      this.client = await Client.init(this.rpcUrl, {
        overrideBundlerRpc: this.bundlerUrl,
        entryPoint: this.entryPointAddress,
      });
      
      // ビルダーを初期化
      this.builder = await Presets.Builder.SimpleAccount.init(
        signer,
        this.rpcUrl,
        {
          overrideBundlerRpc: this.bundlerUrl,
          entryPoint: this.entryPointAddress,
          factory: this.accountFactoryAddress,
        }
      );
      
      // AAウォレットアドレスを取得
      const aaWalletAddress = await this.builder.getSender();
      
      if (!this.builder.initCode || this.builder.initCode === "0x") {
        this.builder.initCode = await this.builder.getInitCode();
      }

      return {
        client: this.client,
        builder: this.builder,
        aaWalletAddress
      };
    } catch (error) {
      console.error('UserOpクライアント初期化エラー:', error);
      throw error;
    }
  }

  /**
   * AAウォレットがデプロイされているかを確認
   * @param {string} address - AAウォレットアドレス
   * @returns {boolean} - デプロイされているかどうか
   */
  async isWalletDeployed(address) {
    try {
      const provider = new ethers.providers.JsonRpcProvider(this.rpcUrl);
      const code = await provider.getCode(address);
      return code !== '0x'; // コードが存在すればデプロイ済み
    } catch (error) {
      console.error('ウォレットデプロイ確認エラー:', error);
      return false;
    }
  }

  /**
   * コントラクト呼び出しを実行するUserOperationを作成
   * @param {string} contractAddress - 呼び出すコントラクトのアドレス
   * @param {string} callData - 呼び出すコントラクトのコールデータ
   * @returns {Object} - 構築されたビルダー
   */
  createContractCallOp(contractAddress, callData) {
    if (!this.builder) {
      throw new Error('ビルダーが初期化されていません。init()を先に呼び出してください。');
    }
    
    // コントラクト呼び出しを追加
    this.builder.execute(contractAddress, 0, callData);
    
    return this.builder;
  }

  /**
   * 複数のコントラクト呼び出しを一括処理するUserOperationを作成
   * @param {Array} calls - 呼び出し情報の配列 [{to, data}]
   * @returns {Object} - 構築されたビルダー
   */
  createBatchCallOp(calls) {
    if (!this.builder) {
      throw new Error('ビルダーが初期化されていません。init()を先に呼び出してください。');
    }
    
    const callTo = calls.map(call => call.to);
    const callData = calls.map(call => call.data);
    
    // バッチ呼び出しを追加
    this.builder.executeBatch(callTo, callData);
    
    return this.builder;
  }

  /**
   * Paymasterオプションを設定
   * @param {number} type - Paymasterタイプ（0:スポンサード、1:プリペイ、2:ポストペイ）
   * @param {string} tokenAddress - 支払いトークンのアドレス（タイプ1, 2の場合）
   * @returns {Object} - 構築されたビルダー
   */
  setPaymasterOptions(type, tokenAddress = null) {
    if (!this.builder) {
      throw new Error('ビルダーが初期化されていません。init()を先に呼び出してください。');
    }
    
    const paymasterOptions = {
      type,
      apikey: this.paymasterApiKey,
      rpc: this.paymasterUrl
    };
    
    // タイプ1または2の場合、トークンアドレスを追加
    if ((type === 1 || type === 2) && tokenAddress) {
      paymasterOptions.token = tokenAddress;
    }
    
    // Paymasterオプションを設定
    this.builder.setPaymasterOptions(paymasterOptions);
    
    return this.builder;
  }

  /**
   * UserOperationを送信
   * @returns {Object} - 送信結果
   */
  async sendUserOperation() {
    if (!this.client || !this.builder) {
      throw new Error('クライアントまたはビルダーが初期化されていません。init()を先に呼び出してください。');
    }
    
    try {
      // UserOperationを送信
      const result = await this.client.sendUserOperation(this.builder);
      
      // UserOperation ハッシュ
      const userOpHash = result.userOpHash;
      console.log("UserOperation hash:", userOpHash);
      
      // トランザクションが完了するまで待機
      const receipt = await result.wait();
      
      if (receipt) {
        console.log("Transaction hash:", receipt.transactionHash);
        return {
          success: true,
          userOpHash,
          transactionHash: receipt.transactionHash,
          receipt
        };
      } else {
        throw new Error("トランザクションレシートがnullです");
      }
    } catch (error) {
      console.error("UserOperation送信エラー:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * セッションキーを使用してUserOperationを構築
   * @param {string} sessionKey - セッションキーのプライベートキー
   * @param {string} contractAddress - 呼び出すコントラクトのアドレス
   * @param {string} callData - 呼び出すコントラクトのコールデータ
   * @returns {Object} - 構築されたビルダー
   */
  async createSessionKeyOp(sessionKey, contractAddress, callData) {
    if (!this.builder) {
      throw new Error('ビルダーが初期化されていません。init()を先に呼び出してください。');
    }
    
    try {
      // セッションキーの秘密鍵からウォレットを作成
      const sessionWallet = new ethers.Wallet(sessionKey);
      
      // セッションキーの署名を使用するカスタム署名関数
      const customSignature = async (op) => {
        // UserOperationハッシュを計算
        const userOpHash = await this.client.getUserOpHash(op);
        
        // セッションキーで署名
        const signature = await sessionWallet.signMessage(ethers.utils.arrayify(userOpHash));
        
        // アカウントインターフェースを呼び出すためのカスタム署名を返す
        return ethers.utils.hexConcat([
          ethers.utils.hexlify(1), // セッションキーを使用することを示すフラグ
          signature
        ]);
      };
      
      // コントラクト呼び出しを追加
      this.builder.execute(contractAddress, 0, callData);
      
      // カスタム署名関数を設定
      this.builder.customSignature = customSignature;
      
      return this.builder;
    } catch (error) {
      console.error("セッションキーOp作成エラー:", error);
      throw error;
    }
  }

  /**
   * ERC20トークン転送のUserOperationを作成
   * @param {string} tokenAddress - トークンコントラクトのアドレス
   * @param {string} recipientAddress - 送信先アドレス
   * @param {string} amount - 送信量（文字列表現）
   * @param {number} decimals - トークンの小数点以下桁数
   * @returns {Object} - 構築されたビルダー
   */
  createERC20TransferOp(tokenAddress, recipientAddress, amount, decimals) {
    if (!this.builder) {
      throw new Error('ビルダーが初期化されていません。init()を先に呼び出してください。');
    }
    
    // ERC20トークンコントラクトのインターフェース
    const erc20Interface = new ethers.utils.Interface([
      'function transfer(address to, uint256 amount) returns (bool)'
    ]);
    
    // transfer関数のコールデータを作成
    const callData = erc20Interface.encodeFunctionData(
      'transfer',
      [recipientAddress, ethers.utils.parseUnits(amount.toString(), decimals)]
    );
    
    // コントラクト呼び出しを追加
    this.builder.execute(tokenAddress, 0, callData);
    
    return this.builder;
  }

  /**
   * ガスコストを推定
   * @returns {Object} - ガス推定値
   */
  async estimateGas() {
    if (!this.client || !this.builder) {
      throw new Error('クライアントまたはビルダーが初期化されていません。init()を先に呼び出してください。');
    }
    
    try {
      // ガスを推定
      const gasEstimation = await this.client.estimateUserOperationGas(this.builder);
      
      return {
        callGasLimit: gasEstimation.callGasLimit,
        verificationGasLimit: gasEstimation.verificationGasLimit,
        preVerificationGas: gasEstimation.preVerificationGas
      };
    } catch (error) {
      console.error("ガス推定エラー:", error);
      throw error;
    }
  }

  /**
   * UserOperationのガスパラメータを手動設定
   * @param {Object} gasParams - ガスパラメータオブジェクト
   * @returns {Object} - 構築されたビルダー
   */
  setGasParameters(gasParams) {
    if (!this.builder) {
      throw new Error('ビルダーが初期化されていません。init()を先に呼び出してください。');
    }
    
    if (gasParams.callGasLimit) {
      this.builder.setCallGasLimit(gasParams.callGasLimit);
    }
    
    if (gasParams.verificationGasLimit) {
      this.builder.setVerificationGasLimit(gasParams.verificationGasLimit);
    }
    
    if (gasParams.preVerificationGas) {
      this.builder.setPreVerificationGas(gasParams.preVerificationGas);
    }
    
    if (gasParams.maxFeePerGas) {
      this.builder.setMaxFeePerGas(gasParams.maxFeePerGas);
    }
    
    if (gasParams.maxPriorityFeePerGas) {
      this.builder.setMaxPriorityFeePerGas(gasParams.maxPriorityFeePerGas);
    }
    
    return this.builder;
  }
}

module.exports = UserOpService;