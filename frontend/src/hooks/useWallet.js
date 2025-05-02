import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

// ERC20トークン操作用のABI
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function transfer(address to, uint amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)'
];

// Mock tokens for development when MetaMask isn't available
const MOCK_TOKENS = [
  {
    address: '0x6b175474e89094c44da98b954eedeac495271d0f',
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    decimals: 18,
    balance: '125.75',
    rawBalance: '125750000000000000000'
  },
  {
    address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    balance: '350.5',
    rawBalance: '350500000'
  },
  {
    address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    balance: '200.0',
    rawBalance: '200000000'
  },
  {
    address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
    symbol: 'WBTC',
    name: 'Wrapped Bitcoin',
    decimals: 8,
    balance: '0.015',
    rawBalance: '1500000'
  },
  {
    address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    balance: '0.25',
    rawBalance: '250000000000000000'
  }
];

/**
 * ウォレット接続と管理のためのカスタムフック
 * 改良版: エラー処理と開発モードのサポート強化
 */
export const useWallet = () => {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [aaWalletAddress, setAaWalletAddress] = useState("0x8901b77345cC8936Bd6E142570AdE93f5ccF3417"); // Mock AA address
  const [isDevelopmentMode, setIsDevelopmentMode] = useState(false);
  
  /**
   * MetaMaskウォレットに接続
   */
  const connectWallet = useCallback(async () => {
    setIsConnecting(true);
    setConnectionError(null);
    
    try {
      // Check for MetaMask
      if (!window.ethereum) {
        // Activate development mode if MetaMask is not available
        console.log('MetaMask not detected - activating development mode');
        setIsDevelopmentMode(true);
        setAccount('0x1234567890123456789012345678901234567890'); // Mock account
        setIsConnecting(false);
        return { 
          account: '0x1234567890123456789012345678901234567890',
          provider: null,
          signer: null
        };
      }
      
      try {
        // Request account access
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        
        // Get the first account
        const account = accounts[0];
        setAccount(account);
        
        // Create ethers provider and signer
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        setProvider(provider);
        
        const signer = provider.getSigner();
        setSigner(signer);
        
        // Get chain ID
        const network = await provider.getNetwork();
        setChainId(network.chainId);
        
        // Mock AA wallet address since we can't actually initialize AA client
        setAaWalletAddress("0x" + account.slice(2, 12) + "Ab" + account.slice(14));
        
        setIsConnecting(false);
        
        return { account, provider, signer };
      } catch (err) {
        console.error('MetaMask connection error:', err);
        throw err;
      }
    } catch (err) {
      console.error('Wallet connection error:', err);
      setConnectionError(err.message || 'Wallet connection error');
      setIsConnecting(false);
      
      // Fall back to development mode
      setIsDevelopmentMode(true);
      setAccount('0x1234567890123456789012345678901234567890'); // Mock account
      
      return { 
        account: '0x1234567890123456789012345678901234567890',
        provider: null,
        signer: null
      };
    }
  }, []);
  
  /**
   * ウォレットを切断
   */
  const disconnectWallet = useCallback(() => {
    setAccount(null);
    setProvider(null);
    setSigner(null);
    setChainId(null);
    setIsDevelopmentMode(false);
  }, []);
  
  /**
   * ウォレット内のトークンを取得
   * @param {Array} tokenAddresses - 確認するトークンアドレスの配列
   * @returns {Array} - トークンオブジェクトの配列（残高とメタデータ付き）
   */
  const getTokens = useCallback(async (tokenAddresses) => {
    if (isDevelopmentMode || (!provider && !account)) {
      console.log('Using mock tokens in development mode');
      return MOCK_TOKENS;
    }
    
    if (!provider || !account) {
      throw new Error('Wallet not connected');
    }
    
    // Target address - EOA or AA wallet
    const targetAddress = aaWalletAddress || account;
    
    try {
      const tokenPromises = tokenAddresses.map(async (address) => {
        try {
          // Create token contract instance
          const tokenContract = new ethers.Contract(address, ERC20_ABI, provider);
          
          // Get token details
          const [balance, decimals, symbol, name] = await Promise.all([
            tokenContract.balanceOf(targetAddress),
            tokenContract.decimals(),
            tokenContract.symbol(),
            tokenContract.name()
          ]);
          
          // Format balance
          const formattedBalance = ethers.utils.formatUnits(balance, decimals);
          
          return {
            address,
            symbol,
            name,
            decimals,
            balance: formattedBalance,
            rawBalance: balance.toString()
          };
        } catch (err) {
          console.error(`Error fetching token ${address}:`, err);
          return null;
        }
      });
      
      // Get all token data
      const tokens = (await Promise.all(tokenPromises))
        .filter(token => token !== null)
        .filter(token => parseFloat(token.balance) > 0);
      
      // If no tokens found, return mock tokens in development mode
      if (tokens.length === 0 && isDevelopmentMode) {
        return MOCK_TOKENS;
      }
      
      return tokens;
    } catch (err) {
      console.error('Error fetching tokens:', err);
      if (isDevelopmentMode) {
        return MOCK_TOKENS;
      }
      throw err;
    }
  }, [provider, account, aaWalletAddress, isDevelopmentMode]);
  
  /**
   * Switch to NERO Chain
   */
  const switchToNeroChain = useCallback(async () => {
    if (isDevelopmentMode) {
      console.log('Development mode: Pretending to switch to NERO Chain');
      setChainId(5555003); // NERO Testnet Chain ID
      return;
    }
    
    if (!window.ethereum) {
      throw new Error('MetaMask not installed');
    }
    
    try {
      // NERO Chain details
      const neroChainId = '0x555503'; // NERO Testnet Chain ID in hex
      
      // Switch to NERO Chain
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: neroChainId }]
      });
      
      // Update chainId after switching
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const network = await provider.getNetwork();
      setChainId(network.chainId);
    } catch (err) {
      // This error code indicates that the chain hasn't been added to MetaMask
      if (err.code === 4902) {
        await addNeroChain();
      } else {
        console.error('Error switching to NERO Chain:', err);
        throw err;
      }
    }
  }, [isDevelopmentMode]);
  
  /**
   * Add NERO Chain to MetaMask
   */
  const addNeroChain = useCallback(async () => {
    if (isDevelopmentMode) {
      console.log('Development mode: Pretending to add NERO Chain');
      setChainId(5555003);
      return;
    }
    
    if (!window.ethereum) {
      throw new Error('MetaMask not installed');
    }
    
    try {
      // NERO Chain details
      const neroChainParams = {
        chainId: '0x555503', // NERO Testnet Chain ID in hex
        chainName: 'NERO Chain Testnet',
        nativeCurrency: {
          name: 'NERO',
          symbol: 'NERO',
          decimals: 18
        },
        rpcUrls: ['https://rpc-testnet.nerochain.io'],
        blockExplorerUrls: ['https://explorer-testnet.nerochain.io']
      };
      
      // Add NERO Chain to MetaMask
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [neroChainParams]
      });
      
      // Update chainId after adding
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const network = await provider.getNetwork();
      setChainId(network.chainId);
    } catch (err) {
      console.error('Error adding NERO Chain:', err);
      throw err;
    }
  }, [isDevelopmentMode]);
  
  // Set up event listeners for account and chain changes
  useEffect(() => {
    if (isDevelopmentMode) {
      return; // No event listeners needed in development mode
    }
    
    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        // User disconnected all accounts
        disconnectWallet();
      } else if (accounts[0] !== account) {
        // User switched accounts
        setAccount(accounts[0]);
      }
    };
    
    const handleChainChanged = (chainIdHex) => {
      // Convert hex chainId to decimal
      const chainIdDecimal = parseInt(chainIdHex, 16);
      setChainId(chainIdDecimal);
      
      // Following MetaMask's recommendation to reload the page
      window.location.reload();
    };
    
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
    }
    
    // Clean up event listeners
    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, [account, disconnectWallet, isDevelopmentMode]);
  
  return {
    provider,
    signer,
    account,
    isConnecting,
    connectionError,
    chainId,
    aaWalletAddress,
    isDevelopmentMode,
    connectWallet,
    disconnectWallet,
    getTokens,
    switchToNeroChain,
    addNeroChain
  };
};

export default useWallet;