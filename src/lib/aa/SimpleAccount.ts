import {
  EntryPoint__factory,
  SimpleAccountFactory__factory,
  SimpleAccount__factory,
} from '@account-abstraction/contracts';
import { ethers } from 'ethers';
import { BundlerJsonRpcProvider, Presets, UserOperationBuilder, UserOperationMiddlewareCtx } from 'userop';
import { ERC4337 } from 'userop/dist/constants';
import type {
  EntryPoint,
  SimpleAccountFactory,
  SimpleAccount as SimpleAccountImplType,
} from '@account-abstraction/contracts';
import type { BigNumberish, BytesLike } from 'ethers';
import type { IPresetBuilderOpts, UserOperationMiddlewareFn, IUserOperation } from 'userop';

const { getGasPrice, estimateUserOperationGas, EOASignature } = Presets.Middleware;

export class SimpleAccount extends UserOperationBuilder {
  private signer: ethers.Signer;
  public provider: ethers.providers.JsonRpcProvider;
  private entryPoint: EntryPoint;
  private factory: SimpleAccountFactory;
  private initCode: string;
  public proxy: SimpleAccountImplType;

  private constructor(signer: ethers.Signer, rpcUrl: string, opts?: IPresetBuilderOpts) {
    super();
    this.signer = signer;
    const finalEntryPointAddress = opts?.entryPoint || ERC4337.EntryPoint;
    const finalFactoryAddress = opts?.factory || ERC4337.SimpleAccount.Factory;
    console.log("SimpleAccount Constructor: Using EntryPoint:", finalEntryPointAddress);
    console.log("SimpleAccount Constructor: Using Factory:", finalFactoryAddress);
    this.provider = new BundlerJsonRpcProvider(rpcUrl).setBundlerRpc(opts?.overrideBundlerRpc);
    this.entryPoint = EntryPoint__factory.connect(
      finalEntryPointAddress,
      this.provider,
    );
    this.factory = SimpleAccountFactory__factory.connect(
      finalFactoryAddress,
      this.provider,
    );
    this.initCode = '0x';
    this.proxy = SimpleAccount__factory.connect(ethers.constants.AddressZero, this.provider);
  }

  private resolveAccount: UserOperationMiddlewareFn = async (ctx: UserOperationMiddlewareCtx) => {
    const nonceBN = ethers.BigNumber.from(ctx.op.nonce);
    if(ctx.op.sender && ctx.op.sender !== ethers.constants.AddressZero) {
        const currentNonce = await this.entryPoint.getNonce(ctx.op.sender, 0);
        ctx.op.nonce = currentNonce;
        ctx.op.initCode = ethers.BigNumber.from(currentNonce).eq(0) ? this.initCode : '0x';
    } else {
        const predictedAddress = await this.getSender();
        ctx.op.sender = predictedAddress;
        const currentNonce = await this.entryPoint.getNonce(predictedAddress, 0);
        ctx.op.nonce = currentNonce;
        ctx.op.initCode = ethers.BigNumber.from(currentNonce).eq(0) ? this.initCode : '0x';
    }
  };

  public static async init(
    signer: ethers.Signer,
    rpcUrl: string,
    opts?: IPresetBuilderOpts,
  ): Promise<SimpleAccount> {
    const instance = new SimpleAccount(signer, rpcUrl, opts);
    const ownerAddress = await instance.signer.getAddress();

    try {
        instance.initCode = ethers.utils.hexConcat([
        instance.factory.address,
        instance.factory.interface.encodeFunctionData('createAccount', [
            ownerAddress,
            ethers.BigNumber.from(opts?.salt ?? 0),
        ]),
        ]);
        await instance.entryPoint.callStatic.getSenderAddress(instance.initCode);
        throw new Error('getSenderAddress: unexpected result, should have reverted with sender address');
    } catch (error: any) {
        const addr = error?.errorArgs?.sender;
        if (!addr) {
            try {
                const fallbackAddr = await instance.factory.callStatic.getAddress(ownerAddress, ethers.BigNumber.from(opts?.salt ?? 0));
                if(!fallbackAddr || fallbackAddr === ethers.constants.AddressZero){
                    throw error; 
                }
                instance.proxy = SimpleAccount__factory.connect(fallbackAddr, instance.provider);
            } catch (getAddressError){
                 console.error("Failed to get sender address via getSenderAddress simulation and factory.getAddress. Original error:", error, "Fallback error:", getAddressError);
                 throw error; 
            }
        } else {
             instance.proxy = SimpleAccount__factory.connect(addr, instance.provider);
        }
    }
    if(!instance.proxy || instance.proxy.address === ethers.constants.AddressZero) {
        throw new Error("Failed to determine smart account address");
    }


    const base = instance
      .useDefaults({
        sender: instance.proxy.address,
        signature: await instance.signer.signMessage(
          ethers.utils.arrayify(ethers.utils.keccak256('0xdead')),
        ),
      })
      .useMiddleware(instance.resolveAccount)
      .useMiddleware(getGasPrice(instance.provider));

    const withPM = opts?.paymasterMiddleware
      ? base.useMiddleware(opts.paymasterMiddleware)
      : base.useMiddleware(estimateUserOperationGas(instance.provider));

    return withPM.useMiddleware(EOASignature(instance.signer));
  }

  async checkUserOpReceipt(opHash: string): Promise<any | null> {
    let receipt = null;
    for (let i = 0; i < 10; i++) {
        try {
            receipt = await this.provider.send('eth_getUserOperationReceipt', [opHash]);
            if (receipt) break;
        } catch (e) {
            console.warn(`Attempt ${i+1} to get UserOp receipt failed:`, e);
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    return receipt;
  }

  execute(to: string, value: BigNumberish, data: BytesLike) {
    const callData = this.proxy.interface.encodeFunctionData('execute', [to, value, data]);
    return this.setCallData(callData);
  }

  executeBatch(to: Array<string>, data: Array<BytesLike>) {
    const callData = (this.proxy.interface as any).encodeFunctionData('executeBatch', [to, data]);
    return this.setCallData(callData);
  }
}