import { ethers } from 'ethers';
import SUPPORTED_TOKENS from '../constants/tokens';
import {
    PAYMASTER_URL,
    ENTRYPOINT_ADDRESS,
    PAYMASTER_API_KEY,
    NERO_RPC_URL,
    TOKEN_PAYMASTER_ADDRESS
} from '../constants/config';

class PaymasterService {
    constructor() {
        this.rpcUrl = PAYMASTER_URL;
        this.entryPointAddress = ENTRYPOINT_ADDRESS;
        this.apiKey = PAYMASTER_API_KEY;
        this.provider = new ethers.providers.JsonRpcProvider(NERO_RPC_URL);
        this.paymasterRpc = new ethers.providers.JsonRpcProvider(this.rpcUrl);
        this.tokenPaymasterAddress = ethers.utils.getAddress(TOKEN_PAYMASTER_ADDRESS);
        this.cache = new Map();
        this.CACHE_EXPIRY_TIME = 5 * 60 * 1000;
    }

    async _fetchWithCache(cacheKey, fetchFunction) {
        const cached = this.cache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < this.CACHE_EXPIRY_TIME)) {
            return cached.data;
        }
        try {
            const data = await fetchFunction();
            this.cache.set(cacheKey, { data, timestamp: Date.now() });
            return data;
        } catch (error) {
            console.error(`Error in _fetchWithCache for ${cacheKey}:`, error);
            throw error;
        }
    }

    async getSupportedTokens() {
        return this._fetchWithCache('supportedTokens', async () => {
            try {
                const response = await this.paymasterRpc.send("pm_supportedTokens", [this.entryPointAddress]);
                 if (response && Array.isArray(response)) {
                    return response.map(token => ({
                        address: ethers.utils.getAddress(token.address),
                        decimals: token.decimals || 18,
                        symbol: token.symbol || 'Unknown',
                        type: 'erc20'
                    }));
                }
                console.warn('pm_supportedTokens did not return expected array, using fallback.');
                return Object.values(SUPPORTED_TOKENS);
            } catch (error) {
                console.warn('Failed to fetch supported tokens from Paymaster RPC, using fallback:', error);
                return Object.values(SUPPORTED_TOKENS);
            }
        });
    }

    async isTokenSupported(tokenAddress) {
        try {
            const supported = await this.getSupportedTokens();
            return supported.some(t => t.address.toLowerCase() === tokenAddress.toLowerCase());
        } catch (error) {
            console.error(`Error checking if token ${tokenAddress} is supported:`, error);
            return false;
        }
    }
    
    async isTokenApproved(tokenAddress, ownerAddress) {
        if (!tokenAddress || !ownerAddress || !this.tokenPaymasterAddress) return false;
        try {
            const tokenContract = new ethers.Contract(
                tokenAddress,
                ['function allowance(address owner, address spender) view returns (uint256)'],
                this.provider
            );
            const allowance = await tokenContract.allowance(ownerAddress, this.tokenPaymasterAddress);
            return allowance.gte(ethers.utils.parseUnits("1", 0));
        } catch (error) {
            console.error('Error checking token approval:', error);
            return false;
        }
    }

    async ensureTokenApproval(signer, tokenAddress, ownerAddress) {
        if (!tokenAddress || !ownerAddress || !this.tokenPaymasterAddress || !signer) {
            throw new Error("Missing parameters for token approval.");
        }
        const isApproved = await this.isTokenApproved(tokenAddress, ownerAddress);
        if (isApproved) {
            console.log(`Token ${tokenAddress} already approved by ${ownerAddress} for ${this.tokenPaymasterAddress}`);
            return true;
        }
   
        console.log(`Approving token ${tokenAddress} for spender ${this.tokenPaymasterAddress} by owner ${ownerAddress}`);
        try {
            const tokenContract = new ethers.Contract(tokenAddress, ['function approve(address spender, uint256 amount) returns (bool)'], signer);
            const tx = await tokenContract.approve(this.tokenPaymasterAddress, ethers.constants.MaxUint256);
            console.log(`Approval transaction sent: ${tx.hash}`);
            await tx.wait();
            console.log(`Token ${tokenAddress} approved successfully.`);
            return true;
        } catch (error) {
            console.error(`Failed to approve token ${tokenAddress} for ${this.tokenPaymasterAddress}:`, error);
            throw new Error(`Token approval failed: ${error.message}`);
        }
    }


   async getSponsoredPaymasterData(userOp, entryPointAddress) {
       console.log("Requesting sponsored paymaster data for UserOp:", userOp);
       try {
           const paymasterRpcMethod = 'pm_sponsorUserOperation';            const paymasterRpcParams = [
               userOp,
               entryPointAddress,
               {
                   apiKey: this.apiKey 
               }
           ];

           const result = await this.paymasterRpc.send(paymasterRpcMethod, paymasterRpcParams);

           if (!result || typeof result.paymasterAndData !== 'string') {
               throw new Error('Invalid response from Paymaster for sponsored gas. Missing paymasterAndData.');
           }
           console.log("Received sponsored paymaster data:", result);
           return result;
       } catch (error) {
           console.error("Error getting sponsored paymaster data from Paymaster RPC:", error);
           throw new Error(`Failed to get sponsored gas data: ${error.message || error}`);
       }
   }

   async getERC20PaymasterData(userOp, entryPointAddress, tokenAddress, paymentType) {
       console.log(`Requesting ERC20 paymaster data for UserOp:`, userOp, `Token: ${tokenAddress}`, `Type: ${paymentType}`);
       if (!tokenAddress) {
           throw new Error("Token address is required for ERC20 paymaster data.");
       }
       try {
           const paymasterRpcMethod = 'pm_sponsorUserOperation';
           const paymasterRpcParams = [
               userOp,
               entryPointAddress,
               {
                   token: ethers.utils.getAddress(tokenAddress),
                   apiKey: this.apiKey,                 
               }
           ];

           const result = await this.paymasterRpc.send(paymasterRpcMethod, paymasterRpcParams);

           if (!result || typeof result.paymasterAndData !== 'string') {
               throw new Error('Invalid response from Paymaster for ERC20 gas. Missing paymasterAndData.');
           }
           console.log("Received ERC20 paymaster data:", result);
           return result; // paymasterAndData, callGasLimit, verificationGasLimit, preVerificationGas などを含むオブジェクトを期待
       } catch (error) {
           console.error("Error getting ERC20 paymaster data from Paymaster RPC:", error);
           throw new Error(`Failed to get ERC20 gas data for token ${tokenAddress}: ${error.message || error}`);
       }
   }
}

export default new PaymasterService();