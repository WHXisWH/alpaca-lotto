import { ethers } from 'ethers';

const paymasterUrl = 'https://paymaster-testnet.nerochain.io';
const entryPoint = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';
const apiKey = '';
const aaWalletAddress = '0xf246aB9E24ab2B4a949ADCf150add9A697785eB9';

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(paymasterUrl);

  const userOp = {
    sender: aaWalletAddress,
    nonce: '0x0',
    initCode: '0x',
    callData: '0x',
    callGasLimit: '0x0',
    verificationGasLimit: '0x0',
    preVerificationGas: '0x0',
    maxFeePerGas: '0x0',
    maxPriorityFeePerGas: '0x0',
    paymasterAndData: '0x',
    signature: '0x'
  };

  try {
    const result = await provider.send('pm_supported_tokens', [
      userOp,
      apiKey,
      entryPoint
    ]);
    console.log('✅ Supported tokens:', result);
  } catch (err) {
    console.error('❌ Error fetching supported tokens:', err.message);
  }
}

main();
