// frontend/src/services/userOpSDK.js
import { ethers } from 'ethers';
import { Client, Presets } from 'userop';
import paymasterService from './paymasterService';
import {
  NERO_RPC_URL,
  BUNDLER_URL,
  PAYMASTER_URL,
  PAYMASTER_API_KEY,
  ENTRYPOINT_ADDRESS,
  ACCOUNT_FACTORY_ADDRESS,
  LOTTERY_CONTRACT_ADDRESS,
} from '../constants/config';

class UserOpSDK {
  constructor() {
    this.client = null;
    this.builder = null;
    this.signer = null;
    this.provider = null;
    this.bundlerProvider = null;
    this.aaWalletAddress = null;
    this.initialized = false;
    this.isInitializing = false;
    this.initError = null;
  }

  async init(signer, userAddress) {
    if (this.initialized) {
      return { success: true, client: this.client, builder: this.builder, aaWalletAddress: this.aaWalletAddress };
    }
    if (this.isInitializing) {
      return new Promise(resolve => {
        const interval = setInterval(() => {
          if (!this.isInitializing) {
            clearInterval(interval);
            resolve({ success: this.initialized, client: this.client, builder: this.builder, aaWalletAddress: this.aaWalletAddress, error: this.initError });
          }
        }, 100);
      });
    }

    this.isInitializing = true;
    this.initError = null;

    try {
      if (!signer || !userAddress) {
        throw new Error('Ethers Signer and user address are required for SDK initialization.');
      }
      this.signer = signer;
      if (signer.provider) {
        this.provider = signer.provider;
      } else {
        this.provider = new ethers.providers.JsonRpcProvider(NERO_RPC_URL);
      }
      await this.provider.getNetwork();

      this.bundlerProvider = new ethers.providers.JsonRpcProvider(BUNDLER_URL);


      this.client = await Client.init(NERO_RPC_URL, { 
        overrideBundlerRpc: BUNDLER_URL, 
        entryPoint: ENTRYPOINT_ADDRESS,
      });


      this.builder = await Presets.Builder.SimpleAccount.init(
        this.signer,
        NERO_RPC_URL, 
        {
          entryPoint: ENTRYPOINT_ADDRESS,
          factory: ACCOUNT_FACTORY_ADDRESS,
          overrideBundlerRpc: BUNDLER_URL,
        }
      );

      this.aaWalletAddress = await this.builder.getSender();
      this.initialized = true;
      return { success: true, client: this.client, builder: this.builder, aaWalletAddress: this.aaWalletAddress };
    } catch (error) {
      this.initError = error.message || 'Failed to initialize UserOpSDK';
      console.error('UserOpSDK Initialization Error:', error);
      return { success: false, error: this.initError };
    } finally {
      this.isInitializing = false;
    }
  }

  async isWalletDeployed(addressToCheck) {
    if (!this.provider) {
        this.provider = new ethers.providers.JsonRpcProvider(NERO_RPC_URL);
    }
    try {
      const targetAddress = addressToCheck || this.aaWalletAddress;
      if (!targetAddress) {
          return false;
      }
      const code = await this.provider.getCode(ethers.utils.getAddress(targetAddress));
      return code !== '0x';
    } catch (error) {
      console.error('Error checking AA wallet deployment:', error);
      return false;
    }
  }

  async _getInitCode() {
    if (!this.builder) throw new Error('Builder not initialized for getInitCode.');
    const isDeployed = await this.isWalletDeployed(this.aaWalletAddress);
    return isDeployed ? '0x' : this.builder.getInitCode();
  }

  async _getNonce() {
    if (!this.aaWalletAddress) throw new Error('AA Wallet Address not initialized for getNonce.');
     if (!this.provider) {
        this.provider = new ethers.providers.JsonRpcProvider(NERO_RPC_URL);
    }
    try {
        const entryPointContract = new ethers.Contract(
            ENTRYPOINT_ADDRESS,
            ['function getNonce(address sender, uint192 key) view returns (uint256)'],
            this.provider
        );
        return await entryPointContract.getNonce(this.aaWalletAddress, 0);
    } catch (error) {
        console.error("Error getting nonce from EntryPoint:", error);
        return ethers.BigNumber.from(0); 
    }
  }

  async setPaymasterAndDataForUserOp(userOp, paymentType, paymentTokenAddress = null) {
    if (!this.client) throw new Error('Client not initialized for Paymaster setup.');



    if (paymentType === 0) { // Sponsored
        const paymasterData = await paymasterService.getSponsoredPaymasterData(userOp, ENTRYPOINT_ADDRESS);
        userOp.paymasterAndData = paymasterData.paymasterAndData;

        if (paymasterData.callGasLimit) userOp.callGasLimit = paymasterData.callGasLimit;
        if (paymasterData.verificationGasLimit) userOp.verificationGasLimit = paymasterData.verificationGasLimit;
        if (paymasterData.preVerificationGas) userOp.preVerificationGas = paymasterData.preVerificationGas;

    } else if ((paymentType === 1 || paymentType === 2) && paymentTokenAddress) { // ERC20
        const paymasterData = await paymasterService.getERC20PaymasterData(userOp, ENTRYPOINT_ADDRESS, paymentTokenAddress, paymentType);
        userOp.paymasterAndData = paymasterData.paymasterAndData;
        if (paymasterData.callGasLimit) userOp.callGasLimit = paymasterData.callGasLimit;
        if (paymasterData.verificationGasLimit) userOp.verificationGasLimit = paymasterData.verificationGasLimit;
        if (paymasterData.preVerificationGas) userOp.preVerificationGas = paymasterData.preVerificationGas;

    } else if (paymentType !== 0) {
        throw new Error('Payment token address is required for ERC20 payment types.');
    }
    return userOp;
  }


  async buildUserOperationWithGasEstimation(callData, contractAddress = LOTTERY_CONTRACT_ADDRESS, value = 0, paymentType, paymentTokenAddress = null) {
    if (!this.builder || !this.client || !this.aaWalletAddress || !this.provider || !this.bundlerProvider) {
        throw new Error('SDK not fully initialized for building UserOperation.');
    }


    this.builder.setCallData(ethers.utils.arrayify(callData)); 
    this.builder.execute(contractAddress, value, callData);


    const initCode = await this._getInitCode();
    const nonce = await this._getNonce();

    const feeData = await this.provider.getFeeData();
    const maxFeePerGas = feeData.maxFeePerGas || ethers.utils.parseUnits('20', 'gwei');
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || ethers.utils.parseUnits('1', 'gwei');

    let userOperation = {
        sender: this.aaWalletAddress,
        nonce: nonce.toHexString(),
        initCode: initCode,
        callData: this.builder.getOp().callData, 
        paymasterAndData: '0x',
        maxFeePerGas: maxFeePerGas.toHexString(),
        maxPriorityFeePerGas: maxPriorityFeePerGas.toHexString(),
    };


    let estimatedGas;
    try {
        estimatedGas = await this.bundlerProvider.send('eth_estimateUserOperationGas', [
            userOperation,
            ENTRYPOINT_ADDRESS
        ]);
    } catch (e) {
        console.error("Error from eth_estimateUserOperationGas:", e);
        throw new Error(`Gas estimation via eth_estimateUserOperationGas failed: ${e.message}`);
    }

    userOperation = {
        ...userOperation,
        callGasLimit: estimatedGas.callGasLimit,
        verificationGasLimit: estimatedGas.verificationGasLimit,
        preVerificationGas: estimatedGas.preVerificationGas,
    };

    userOperation = await this.setPaymasterAndDataForUserOp(
        userOperation,
        paymentType,
        paymentTokenAddress
    );


    this.builder.setSender(userOperation.sender);
    this.builder.setNonce(userOperation.nonce);
    this.builder.setInitCode(userOperation.initCode);
    this.builder.setCallGasLimit(userOperation.callGasLimit);
    this.builder.setVerificationGasLimit(userOperation.verificationGasLimit);
    this.builder.setPreVerificationGas(userOperation.preVerificationGas);
    this.builder.setMaxFeePerGas(userOperation.maxFeePerGas);
    this.builder.setMaxPriorityFeePerGas(userOperation.maxPriorityFeePerGas);
    this.builder.setPaymasterAndData(userOperation.paymasterAndData);

    return this.builder.buildOp();
  }

  async sendUserOperation(userOperation) {
    if (!this.client) throw new Error('Client not initialized for sending UserOperation.');
    try {
      const opResponse = await this.client.sendUserOperation(userOperation, ENTRYPOINT_ADDRESS); // v0.3.x の sendUserOperation は entryPoint を第二引数に取る
      const receipt = await opResponse.wait();
      if (!receipt || !receipt.transactionHash) {
        throw new Error('Transaction failed or receipt not available.');
      }
      return {
        success: true,
        userOpHash: opResponse.userOpHash,
        transactionHash: receipt.transactionHash,
        receipt,
      };
    } catch (error) {
      console.error('Error sending UserOperation:', error);
      const errorMessage = error?.error?.message || error.message || 'Failed to send UserOperation.';
       if (errorMessage.includes('AA21') || errorMessage.toLowerCase().includes('insufficient funds for prefund')) {
        throw new Error('AA21: Insufficient NERO funds in EOA for AA wallet deployment or prefund.');
      }
      if (errorMessage.includes('paymaster validation failed') || (error.message && error.message.includes('"code":-32504'))) {
         throw new Error(`Paymaster validation failed: ${errorMessage}. Check token, allowance, or Paymaster balance/rules.`);
      }
      if (error.message && error.message.includes('"code":-32502')){
          throw new Error(`Nonce mismatch or invalid UserOp fields: ${errorMessage}`);
      }
      throw new Error(errorMessage);
    }
  }
}

export default new UserOpSDK();