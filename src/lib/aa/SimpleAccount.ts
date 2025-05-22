import {
  EntryPoint__factory,
  SimpleAccountFactory__factory,
  SimpleAccount__factory,
} from '@account-abstraction/contracts';
import { ethers, BigNumber } from 'ethers';
import { BundlerJsonRpcProvider, Presets, UserOperationBuilder, UserOperationMiddlewareCtx } from 'userop';
import { ERC4337 } from 'userop/dist/constants';
import type {
  EntryPoint,
  SimpleAccountFactory,
  SimpleAccount as SimpleAccountImplType,
} from '@account-abstraction/contracts';
import type { BigNumberish, BytesLike } from 'ethers';
import type { IPresetBuilderOpts, UserOperationMiddlewareFn } from 'userop';

const { getGasPrice, estimateUserOperationGas, signUserOpHash } = Presets.Middleware;

export class SimpleAccount extends UserOperationBuilder {
  private signer: ethers.Signer;
  public provider: ethers.providers.JsonRpcProvider;
  public entryPoint: EntryPoint;
  private factory: SimpleAccountFactory;
  private initCode: string;
  public proxy: SimpleAccountImplType;

  private constructor(signer: ethers.Signer, rpcUrl: string, opts?: IPresetBuilderOpts) {
    super();
    this.signer = signer;
    const finalEntryPointAddress = opts?.entryPoint || ERC4337.EntryPoint;
    const finalFactoryAddress = opts?.factory || ERC4337.SimpleAccount.Factory;

    console.log("SimpleAccount Constructor: Signer type:", typeof signer);
    console.log("SimpleAccount Constructor: rpcUrl:", rpcUrl);
    console.log("SimpleAccount Constructor: opts.entryPoint:", opts?.entryPoint, "Using EntryPoint:", finalEntryPointAddress);
    console.log("SimpleAccount Constructor: opts.factory:", opts?.factory, "Using Factory:", finalFactoryAddress);
    console.log("SimpleAccount Constructor: opts.overrideBundlerRpc:", opts?.overrideBundlerRpc);

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
    console.log(
      "SimpleAccount.resolveAccount (before): Op Sender:", ctx.op.sender,
      "Op Nonce (initial in op):", ctx.op.nonce != null ? ethers.BigNumber.from(ctx.op.nonce).toString() : "null/undefined",
      "Op initCode (initial in op) length:", (ctx.op.initCode || "0x").length
    );

    let senderForNonceLookup = ctx.op.sender;
    let fetchedNonce: ethers.BigNumber;

    try {
        if(!senderForNonceLookup || senderForNonceLookup === ethers.constants.AddressZero) {
            console.warn("SimpleAccount.resolveAccount: ctx.op.sender is initially invalid or zero. Using this.proxy.address.");
            senderForNonceLookup = this.proxy.address;
            if (!senderForNonceLookup || senderForNonceLookup === ethers.constants.AddressZero) {
                const errMsg = "SimpleAccount.resolveAccount: Cannot resolve account, this.proxy.address is also invalid.";
                console.error(errMsg);
                throw new Error(errMsg);
            }
            ctx.op.sender = senderForNonceLookup;
            console.log("SimpleAccount.resolveAccount: Updated ctx.op.sender to proxy.address:", senderForNonceLookup);
        }

        fetchedNonce = await this.entryPoint.getNonce(senderForNonceLookup, 0);
        console.log("SimpleAccount.resolveAccount: Fetched on-chain nonce for", senderForNonceLookup, ":", fetchedNonce.toString());

        ctx.op.nonce = fetchedNonce;
        ctx.op.initCode = ethers.BigNumber.from(fetchedNonce).eq(0) ? this.initCode : '0x';

        console.log(
        "SimpleAccount.resolveAccount (after): Set Op Nonce to:", ctx.op.nonce.toString(),
        "Set Op initCode to:", ctx.op.initCode,
        "For Op Sender:", ctx.op.sender
        );
    } catch (error) {
        console.error("SimpleAccount.resolveAccount: Error during nonce/initCode processing for sender", senderForNonceLookup, error);
        throw error;
    }
  };

  public static async init(
    signer: ethers.Signer,
    rpcUrl: string,
    opts?: IPresetBuilderOpts,
  ): Promise<SimpleAccount> {
    console.log("SimpleAccount.init called. opts.factory:", opts?.factory);
    const instance = new SimpleAccount(signer, rpcUrl, opts);
    const ownerAddress = await instance.signer.getAddress();
    console.log("SimpleAccount.init: EOA Owner Address:", ownerAddress);
    console.log("SimpleAccount.init: Factory used for initCode construction (instance.factory.address):", instance.factory.address);

    const salt = ethers.BigNumber.from(opts?.salt ?? 0);
    console.log("SimpleAccount.init: Using salt:", salt.toString());

    try {
        instance.initCode = ethers.utils.hexConcat([
        instance.factory.address,
        instance.factory.interface.encodeFunctionData('createAccount', [
            ownerAddress,
            salt,
        ]),
        ]);
        console.log("SimpleAccount.init: Generated initCode:", instance.initCode);

        console.log("SimpleAccount.init: Attempting entryPoint.callStatic.getSenderAddress with initCode...");
        await instance.entryPoint.callStatic.getSenderAddress(instance.initCode);
        console.warn("SimpleAccount.init: getSenderAddress call did not revert as expected in try block. This is unusual.");
        throw new Error('getSenderAddress: unexpected result, should have reverted with sender address');
    } catch (error: any) {
        console.log("SimpleAccount.init: Caught error during getSenderAddress (expected path for address retrieval):", error.message);
        const addr = error?.errorArgs?.sender;
        if (!addr) {
            console.warn("SimpleAccount.init: Could not extract sender from getSenderAddress error. Trying factory.callStatic.getAddress as fallback.");
            try {
                const fallbackAddr = await instance.factory.callStatic.getAddress(ownerAddress, salt);
                console.log("SimpleAccount.init: Fallback factory.getAddress returned:", fallbackAddr);
                if(!fallbackAddr || fallbackAddr === ethers.constants.AddressZero){
                    console.error("SimpleAccount.init: Fallback getAddress also failed or returned zero address. Original error reason:", error?.reason);
                    throw error;
                }
                instance.proxy = SimpleAccount__factory.connect(fallbackAddr, instance.provider);
            } catch (getAddressError: any){
                 console.error("SimpleAccount.init: Failed to get sender address via getSenderAddress simulation AND factory.getAddress. Original error reason:", error?.reason, "Fallback error:", getAddressError?.message || getAddressError);
                 throw getAddressError;
            }
        } else {
             console.log("SimpleAccount.init: Extracted sender address from getSenderAddress error:", addr);
             instance.proxy = SimpleAccount__factory.connect(addr, instance.provider);
        }
    }

    if(!instance.proxy || instance.proxy.address === ethers.constants.AddressZero) {
        const errMsg = "SimpleAccount.init: Failed to determine smart account address (proxy address is zero or undefined).";
        console.error(errMsg);
        throw new Error(errMsg);
    }
    console.log("SimpleAccount.init: Final Smart Account (proxy) address:", instance.proxy.address);

    const defaults = {
      sender: instance.proxy.address,
      signature: await instance.signer.signMessage(
        ethers.utils.arrayify(ethers.utils.keccak256('0xdead')),
      ),
    };
    console.log("SimpleAccount.init: Setting defaults for builder:", JSON.stringify({sender: defaults.sender, signatureLength: defaults.signature.length }));

    let builder = instance
      .useDefaults(defaults)
      .useMiddleware(instance.resolveAccount)
      .useMiddleware(getGasPrice(instance.provider))
      .useMiddleware(estimateUserOperationGas(instance.provider));

    console.log("SimpleAccount.init: opts.paymasterMiddleware provided?", !!opts?.paymasterMiddleware);

    if (opts?.paymasterMiddleware) {
      builder = builder.useMiddleware(opts.paymasterMiddleware);
    }

    return builder.useMiddleware(signUserOpHash(instance.signer));
  }

  public async getSenderNonce(): Promise<BigNumber> {
    if (!this.proxy || this.proxy.address === ethers.constants.AddressZero) {
      console.error("SimpleAccount.getSenderNonce: Proxy not initialized or zero address.");
      throw new Error("SimpleAccount proxy not initialized, cannot get nonce.");
    }
    console.log("SimpleAccount.getSenderNonce: Fetching nonce for sender:", this.proxy.address);
    return this.entryPoint.getNonce(this.proxy.address, 0);
  }

  public async getSenderInitCode(): Promise<string> {
    if (!this.proxy || this.proxy.address === ethers.constants.AddressZero) {
      console.warn("SimpleAccount.getSenderInitCode: Proxy not properly initialized. Cannot reliably determine initCode. Returning stored initCode.");
      return this.initCode;
    }

    const currentNonce = await this.entryPoint.getNonce(this.proxy.address, 0);

    if (currentNonce.isZero()) {
        console.log("SimpleAccount.getSenderInitCode: Nonce is 0, returning deployment initCode:", this.initCode);
        return this.initCode;
    }
    console.log("SimpleAccount.getSenderInitCode: Nonce is not 0, returning '0x'.");
    return "0x";
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