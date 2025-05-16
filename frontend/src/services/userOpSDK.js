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
        throw new Error('Signer and user address are required for SDK initialization.');
      }
      this.signer = signer;
      this.provider = new ethers.providers.JsonRpcProvider(NERO_RPC_URL);
      await this.provider.getNetwork();

      this.client = await Client.init(NERO_RPC_URL, {
        overrideBundlerRpc: BUNDLER_URL,
        entryPoint: ENTRYPOINT_ADDRESS,
      });

      this.builder = await Presets.Builder.SimpleAccount.init(
        this.signer,
        NERO_RPC_URL,
        {
          overrideBundlerRpc: BUNDLER_URL,
          entryPoint: ENTRYPOINT_ADDRESS,
          factory: ACCOUNT_FACTORY_ADDRESS,
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
        if (!this.signer) {
            console.warn("Provider and Signer not available for isWalletDeployed check after SDK init failure or if not called.");
            return false; // Cannot check without provider
        }
        this.provider = this.signer.provider;
        if (!this.provider) {
             this.provider = new ethers.providers.JsonRpcProvider(NERO_RPC_URL);
        }
    }
    try {
      const targetAddress = addressToCheck || this.aaWalletAddress;
      if (!targetAddress) {
          console.warn("AA Wallet address not available for deployment check.");
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
    if (!this.builder) throw new Error('Builder not initialized.');
    const isDeployed = await this.isWalletDeployed(this.aaWalletAddress);
    return isDeployed ? '0x' : await this.builder.getInitCode();
  }

  async _getNonce() {
    if (!this.client || !this.aaWalletAddress) throw new Error('Client or AA Wallet Address not initialized.');
     if (!this.provider) {
        if (!this.signer) throw new Error("Provider not available for nonce check.");
        this.provider = this.signer.provider;
         if (!this.provider) {
             this.provider = new ethers.providers.JsonRpcProvider(NERO_RPC_URL);
        }
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
        return ethers.BigNumber.from(Math.floor(Math.random() * 100000));
    }
  }

  async setPaymasterAndDataForUserOp(userOp, paymentType, paymentTokenAddress = null) {
    if (!this.client) throw new Error('Client not initialized.');
    if (paymentType === 0) {
        const paymasterRpcResult = await this.client.rpc.send('pm_sponsorUserOperation', [
            userOp,
            ENTRYPOINT_ADDRESS,
            { type: 'sponsor', apiKey: PAYMASTER_API_KEY }
        ]);
        userOp.paymasterAndData = paymasterRpcResult.paymasterAndData;
    } else if ((paymentType === 1 || paymentType === 2) && paymentTokenAddress) {
        const paymasterRpcResult = await this.client.rpc.send('pm_sponsorUserOperation', [
            userOp,
            ENTRYPOINT_ADDRESS,
            { type: paymentType === 1 ? 'erc20Preapproval' : 'erc20Postop', token: paymentTokenAddress, apiKey: PAYMASTER_API_KEY }
        ]);
        userOp.paymasterAndData = paymasterRpcResult.paymasterAndData;
    } else if (paymentType !== 0) {
        throw new Error('Payment token address is required for ERC20 payment types.');
    }
    return userOp;
  }


  async buildUserOperationWithGasEstimation(callData, contractAddress = LOTTERY_CONTRACT_ADDRESS, value = 0, paymentType, paymentTokenAddress = null) {
    if (!this.builder || !this.client) throw new Error('SDK not fully initialized.');

    this.builder.resetOp && this.builder.resetOp();
    this.builder.execute(contractAddress, value, callData);

    const initCode = await this._getInitCode();
    const nonce = await this._getNonce();

    let partialUserOp = {
        sender: this.aaWalletAddress,
        nonce: nonce,
        initCode: initCode,
        callData: this.builder.getOp().callData,
        paymasterAndData: '0x',
    };

    const estimatedGas = await this.client.estimateUserOperationGas(partialUserOp, ENTRYPOINT_ADDRESS);
    partialUserOp = {
        ...partialUserOp,
        callGasLimit: estimatedGas.callGasLimit,
        verificationGasLimit: estimatedGas.verificationGasLimit,
        preVerificationGas: estimatedGas.preVerificationGas,
        maxFeePerGas: estimatedGas.maxFeePerGas || ethers.utils.parseUnits('20', 'gwei'),
        maxPriorityFeePerGas: estimatedGas.maxPriorityFeePerGas || ethers.utils.parseUnits('1', 'gwei'),
    };
    
    const userOpWithPaymaster = await this.setPaymasterAndDataForUserOp(
        {...partialUserOp},
        paymentType,
        paymentTokenAddress
    );
    
    const finalUserOp = await this.builder.buildOp(userOpWithPaymaster);

    return finalUserOp;
  }


  async sendUserOperation(userOperation) {
    if (!this.client) throw new Error('Client not initialized.');
    try {
      const opResponse = await this.client.sendUserOperation(userOperation, ENTRYPOINT_ADDRESS);
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