# AlpacaLotto Architecture

This document outlines the system architecture of AlpacaLotto, a blockchain lottery application built on NERO Chain that leverages Account Abstraction (AA) and AI for an enhanced user experience.

## System Overview

AlpacaLotto is composed of three primary components:

1. **Smart Contracts**: The on-chain logic for lottery management, ticket purchases, and account abstraction features
2. **Backend Services**: NodeJS server providing AI token optimization and API endpoints 
3. **Frontend Application**: React-based user interface with wagmi v2 integration for interacting with the lottery system

The architecture is designed to maximize the benefits of NERO Chain's Account Abstraction capabilities while providing a seamless user experience.

## Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                            User's Browser                                      │
│                                                                                │
│  ┌────────────────────────────────────────────────────────────────────────┐    │
│  │                      React Frontend Application                        │    │
│  │                                                                        │    │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌──────────┐ │    │
│  │  │ WagmiWallet │    │ TokensHook  │    │ LotteriesHook│   │SessionKey│ │    │
│  │  │    Hook     │    └─────────────┘    └─────────────┘    └──────────┘ │    │
│  │  └─────────────┘            │                  │                 │     │    │
│  │        │                    │                  │                 │     │    │
│  │        ▼                    ▼                  ▼                 ▼     │    │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌──────────┐ │    │
│  │  │   UserOp    │    │    API      │    │  Component  │    │   Pages  │ │    │
│  │  │    Hook     │    │   Service   │    │   Library   │    │          │ │    │
│  │  └─────────────┘    └─────────────┘    └─────────────┘    └──────────┘ │    │
│  │        │                    │                                          │    │
│  │        ▼                    │                                          │    │
│  │  ┌─────────────┐            │                                          │    │
│  │  │ UserOpSDK/  │            │                                          │    │
│  │  │ Paymaster   │            │                                          │    │
│  │  └─────────────┘            │                                          │    │
│  │                             │                                          │    │
│  └─────────────────────────────┼──────────────────────────────────────────┘    │
│                                │                                                │
└────────────────────────────────┼───────────────────────────────────────────────┘
                                 │
                                 ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│                           NodeJS Backend                                       │
│                                                                                │
│  ┌────────────────┐   ┌────────────────┐   ┌────────────────────────────────┐  │
│  │ Token Optimizer│   │ Lottery Service│   │      UserOp Service            │  │
│  │    (AI Logic)  │   │                │   │                                │  │
│  └────────────────┘   └────────────────┘   └────────────────────────────────┘  │
│          │                    │                          │                     │
│          └────────────────────┼──────────────────────────┘                     │
│                               │                                                │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │                          API Controller                                  │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                │
└────────────────────────────────┼───────────────────────────────────────────────┘
                                 │
                                 ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│                           NERO Chain                                           │
│                                                                                │
│  ┌──────────────────┐    ┌────────────────┐    ┌───────────────────┐           │
│  │  AlpacaLotto     │    │  EntryPoint    │    │  Account Factory  │           │
│  │     Contract     │    │  (ERC-4337)    │    │                   │           │
│  └──────────────────┘    └────────────────┘    └───────────────────┘           │
│          │                       │                      │                      │
│          ▼                       ▼                      ▼                      │
│  ┌──────────────────┐    ┌────────────────┐    ┌───────────────────┐           │
│  │  SessionKey      │    │   Paymaster    │    │   Smart Contract  │           │
│  │    Manager       │    │   (AA Platform)│    │      Wallet       │           │
│  └──────────────────┘    └────────────────┘    └───────────────────┘           │
│                                                                                │
│  ┌──────────────────┐                                                          │
│  │  SocialRecovery  │                                                          │
│  │     Module       │                                                          │
│  └──────────────────┘                                                          │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘
```

## Account Abstraction (AA) Implementation

AlpacaLotto implements the ERC-4337 Account Abstraction standard through integration with NERO Chain's AA Platform, focusing on several key AA components:

### Smart Contract Wallets
Instead of using traditional EOAs (Externally Owned Accounts), AlpacaLotto leverages smart contract wallets:

- **Account Factory**: Deterministically creates smart contract wallets for users
- **EntryPoint Contract**: Standard ERC-4337 EntryPoint (0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789)
- **Counterfactual Deployment**: Wallets can be used before they're deployed on-chain

The implementation allows users to interact with the application through AA wallets without needing to understand blockchain complexities.

### UserOperations
All blockchain transactions are handled through UserOperations:

```javascript
// Example of a UserOperation structure in userOpService.js
const minimalUserOp = {
  sender: aaWalletAddress,
  nonce: "0x0",
  initCode: "0x",
  callData: "0x", 
  callGasLimit: "0x0",
  verificationGasLimit: "0x0",
  preVerificationGas: "0x0",
  maxFeePerGas: "0x0",
  maxPriorityFeePerGas: "0x0",
  paymasterAndData: "0x",
  signature: "0x"
};
```

UserOps are created through the UserOpSDK which abstracts much of the complexity:

```javascript
// Create ERC20 token transfer UserOperation
createERC20Transfer(tokenAddress, recipientAddress, amount, decimals) {
  const callData = erc20Interface.encodeFunctionData(
    'transfer',
    [recipientAddress, ethers.utils.parseUnits(amount.toString(), decimals)]
  );
  
  this.builder.execute(tokenAddress, 0, callData);
  return this.builder;
}
```

### Paymaster Implementation
A core feature is the Paymaster implementation, allowing gas fees to be paid in ERC20 tokens:

```javascript
// Paymaster options for different gas payment types
setPaymasterOptions(type, token = null) {
  const options = {
    type,
    apikey: CONSTANTS.PAYMASTER_API_KEY,
    rpc: CONSTANTS.PAYMASTER_URL
  };
  
  // Add token address for ERC20 payment types
  if ((type === 1 || type === 2) && token) {
    options.token = token;
  }
  
  this.builder.setPaymasterOptions(options);
  return this.builder;
}
```

The Paymaster supports three payment types:
- **Type 0**: Sponsored (developer pays gas fees)
- **Type 1**: Prepay with ERC20 tokens (user pays upfront)
- **Type 2**: Postpay with ERC20 tokens (user pays after execution)

### Session Keys
For improved UX, the application implements session keys that allow users to authorize transactions for a limited time:

```javascript
// Session key creation in useSessionKeys.ts
const createSessionKey = useCallback(async (duration: number): Promise<boolean> => {
  // Generate new session key
  const newSessionKey = generateSessionKey();
  
  // Current time and expiration
  const currentTime = Math.floor(Date.now() / 1000);
  const expiresAt = currentTime + duration;
  
  // Create session key parameters
  const sessionParams = {
    duration: duration,
    paymentType: 0, // Use sponsored gas for better UX
  };
  
  // Execute session key creation transaction using Account Abstraction
  const sessionKeyAddress = await createSessionKeyOp(sessionParams);
  
  // Save session key data
  const sessionData: SessionKeyDetails = {
    address: sessionKeyAddress,
    privateKey: newSessionKey.privateKey,
    expiresAt: expiresAt,
    createdAt: currentTime,
    validUntil: expiresAt
  };
  
  setSessionKeyDetails(sessionData);
  setHasActiveSessionKey(true);
  saveSessionKeyToStorage(sessionData);
  
  return true;
}, [/* dependencies */]);
```

### Batch Operations
The AA implementation supports batching multiple operations into a single transaction:

```javascript
// Batch operation creation
createBatchOperation(calls) {
  const callAddresses = calls.map(call => call.to);
  const callData = calls.map(call => call.data);
  
  // Add batch calls to the builder
  this.builder.executeBatch(callAddresses, callData);
  
  return this.builder;
}
```

This allows users to purchase tickets for multiple lotteries in a single transaction, saving gas and improving UX.

## Component Details

### Smart Contracts

#### AlpacaLotto Contract
The main lottery management contract responsible for:
- Creating and managing lottery events
- Handling ticket purchases with any token
- Processing prize distribution
- Supporting session key authorization

```solidity
contract AlpacaLotto is Ownable, ReentrancyGuard {
    // State variables for lotteries, tickets, session keys
    
    // External functions for lottery creation and management
    function createLottery(...) external onlyOwner { ... }
    function purchaseTickets(...) external { ... }
    function batchPurchaseTickets(...) external { ... }
    
    // Session key functions
    function purchaseTicketsFor(...) external onlyValidSessionKey { ... }
    function createSessionKey(...) external { ... }
    function revokeSessionKey(...) external { ... }
    
    // Drawing and prize distribution
    function drawLottery(...) external onlyOwner { ... }
    function claimPrize(...) external { ... }
}
```

#### SessionKeyManager Contract
Manages temporary session keys for Account Abstraction wallets:
- Registers new session keys with specific permissions
- Validates operation authorization for session keys
- Handles key revocation and expiration

```solidity
contract SessionKeyManager {
    // Functions for session key management
    function registerSessionKey(...) external { ... }
    function revokeSessionKey(...) external { ... }
    function validateSessionKey(...) external view returns (bool) { ... }
    
    // Helper functions
    function getAllowedTargets(...) external view returns (address[] memory) { ... }
    function getAllowedFunctions(...) external view returns (bytes4[] memory) { ... }
}
```

#### SocialRecoveryModule Contract
Enables account recovery through trusted guardians:
- Configures recovery settings (guardians, thresholds)
- Initiates and approves recovery processes
- Enforces time delays and verification requirements

```solidity
contract SocialRecoveryModule {
    // Functions for configuring recovery
    function configureRecovery(...) external { ... }
    function addGuardian(...) external { ... }
    function removeGuardian(...) external { ... }
    
    // Recovery process functions
    function initiateRecovery(...) external { ... }
    function approveRecovery(...) external { ... }
    function executeRecovery(...) external { ... }
    function cancelRecovery(...) external { ... }
}
```

### Backend Services

#### tokenOptimizer.js
The AI engine that analyzes tokens to find the most cost-effective option:
- Fetches token price, volatility, and slippage data
- Applies weighted scoring algorithm to each token
- Provides human-readable explanations for recommendations

```javascript
class TokenOptimizer {
    async findOptimalToken(tokens, userPreferences) { ... }
    async getPriceData(tokens) { ... }
    async getVolatilityData(tokens) { ... }
    async getSlippageData(tokens) { ... }
    
    // Internal scoring methods
    _normalizeBalance(usdBalance) { ... }
    _normalizeVolatility(volatility) { ... }
    _normalizeSlippage(slippage) { ... }
    _generateReasons(usdBalance, volatility, slippage, preferences) { ... }
}
```

#### lotteryService.js
Handles interaction with lottery contracts:
- Retrieves lottery data and user tickets
- Processes ticket purchases
- Manages winner verification and prize claiming

```javascript
class LotteryService {
    // Lottery data functions
    async getAllLotteries() { ... }
    async getActiveLotteries() { ... }
    async getLotteryDetails(lotteryId) { ... }
    async getUserTickets(userAddress, lotteryId) { ... }
    
    // Transaction functions
    async purchaseTickets(lotteryId, tokenAddress, quantity) { ... }
    async batchPurchaseTickets(selections) { ... }
    async purchaseTicketsWithSessionKey(...) { ... }
    async claimPrize(lotteryId) { ... }
    
    // Session key functions
    async createSessionKey(sessionKeyAddress, validDuration, operationsHash) { ... }
    async revokeSessionKey(sessionKeyAddress) { ... }
}
```

#### userOpService.js
Manages Account Abstraction UserOperations:
- Creates and configures UserOperations for transactions
- Handles Paymaster integration for gas abstraction
- Processes session key operations

```javascript
class UserOpService {
    // Initialization
    async init(signer) { ... }
    async isWalletDeployed(address) { ... }
    
    // UserOperation creation functions
    createContractCallOp(contractAddress, callData) { ... }
    createBatchCallOp(calls) { ... }
    setPaymasterOptions(type, tokenAddress) { ... }
    
    // Execution functions
    async sendUserOperation() { ... }
    async createSessionKeyOp(sessionKey, contractAddress, callData) { ... }
    async estimateGas() { ... }
}
```

### Frontend Components

#### Custom Hooks
React hooks that encapsulate blockchain and application logic:

##### useWagmiWallet.ts
Manages wallet connection and token fetching using wagmi v2:
- Connects to MetaMask/other providers
- Retrieves token balances and metadata
- Handles chain switching
- Manages AA wallet address derivation

```typescript
export const useWagmiWallet = (): UseWagmiWalletReturn => {
  // wagmi hooks
  const { address, isConnected, isConnecting: connecting } = useAccount();
  const { connect, connectors, error: connectError, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain, error: switchError } = useSwitchChain();
  
  // State variables
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [aaWalletAddress, setAaWalletAddress] = useState<string | null>(null);
  const [isDevelopmentMode, setIsDevelopmentMode] = useState<boolean>(false);

  // Handle AA wallet address derivation
  useEffect(() => {
    if (address) {
      // Use the EOA address for now until proper AA address generation is implemented
      setAaWalletAddress(address);
    } else if (isDevelopmentMode) {
      // In development mode, provide a valid mock AA address
      setAaWalletAddress("0x8901b77345cC8936Bd6E142570AdE93f5ccF3417");
    } else {
      setAaWalletAddress(null);
    }
  }, [address, isDevelopmentMode]);
  
  // ...rest of the implementation
}
```

##### useUserOp.ts
Handles UserOperation creation and execution:
- Creates transaction operations for ticket purchases
- Configures session keys and batch transactions
- Integrates with Paymaster for gas abstraction

```typescript
export const useUserOp = (): UseUserOpReturn => {
  // Use wagmi hooks
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { isDevelopmentMode } = useWagmiWallet();
  
  // State
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [aaWalletAddress, setAaWalletAddress] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  
  // Initialize SDK
  const initSDK = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Check if development mode
      if (isDevelopmentMode || !walletClient) {
        // Initialize with mock signer
        // ...
      } else {
        // Initialize with real wallet client
        // ...
      }
      
      // Set AA wallet address
      setAaWalletAddress(aaAddress);
      setIsLoading(false);
      
      return { client, builder, aaAddress };
    } catch (err) {
      // Error handling
      // ...
    }
  }, [address, walletClient, isDevelopmentMode]);
  
  // ...rest of the implementation
}
```

##### useTokens.ts
Manages token data and optimization:
- Fetches token balances and metadata
- Requests AI optimization for token selection
- Tracks recommendations and supported tokens

##### useLotteries.ts
Handles lottery data and interactions:
- Fetches active and past lotteries
- Manages user tickets and winnings
- Processes ticket purchases and prize claims

##### useSessionKeys.ts
Manages temporary session keys:
- Creates and stores session key data
- Tracks key expiration and validity
- Handles revocation and renewal

#### UI Components
React components providing the user interface:

- **Header**: Navigation and session key status
- **WalletConnect**: Wallet connection interface with wagmi v2
- **ActiveLotteries**: List of current lottery events
- **LotteryDetails**: Detailed lottery information
- **TicketPurchase**: Ticket purchase modal with AI recommendations
- **TokenSelector**: Token selection with AI optimization
- **SessionKeyModal**: Session key creation interface
- **UserTickets**: User's purchased tickets display
- **BatchOperations**: Batch transaction UI for multiple tickets
- **PaymentOptimizer**: AI-powered token recommendation UI
- **QuickPlay**: Session key enabled quick ticket purchasing

#### Pages
High-level page components:

- **HomePage**: Main landing page with active lotteries
- **PaymentPage**: Ticket purchase confirmation and execution

## Data Flow

### AA Wallet Creation Flow
1. User connects their EOA wallet using wagmi v2
2. Frontend derives the AA wallet address from the EOA address
3. UserOpSDK initializes with the connected wallet as signer
4. AA wallet is created counterfactually (without deployment)
5. Actual deployment happens on first transaction

### Ticket Purchase Flow
1. User browses active lotteries on HomePage
2. User selects a lottery and clicks "Purchase Tickets"
3. AI analyzes user's tokens and recommends optimal payment token
4. User confirms purchase details on PaymentPage
5. UserOperation is created with Paymaster configuration
6. Transaction is submitted to NERO Chain through EntryPoint
7. Smart contract processes ticket purchase
8. UI updates to show purchased tickets

### Session Key Flow
1. User enables "Quick Play" through SessionKeyModal
2. A temporary key pair is generated client-side
3. User signs a message authorizing the session key
4. Session key is registered with the AlpacaLotto contract
5. Session key details are stored in local storage
6. User can now purchase tickets without additional signatures
7. Session key automatically expires after the set duration

### Prize Claiming Flow
1. Lottery admin draws winning numbers (or automated process)
2. Smart contract selects winning tickets
3. Winner information is stored on-chain
4. User checks if they won via the UI
5. If winner, user can claim prize with one-click
6. UserOperation executes prize claim function
7. Prize is transferred to user's wallet

## Account Abstraction Integration with NERO Chain

AlpacaLotto deeply integrates with NERO Chain's Account Abstraction capabilities:

### Smart Contract Wallets
Users interact through AA wallets rather than EOAs (Externally Owned Accounts), enabling:
- Complex transaction logic (batch operations)
- Session keys for delegated authority
- Enhanced security features
- Social recovery capabilities

### Paymaster Integration
Enables flexible gas payment options:
- **Type 0**: Developer-sponsored gas (free for users)
- **Type 1**: Prepay with ERC20 tokens (user pays upfront)
- **Type 2**: Postpay with ERC20 tokens (user pays after execution)

Users can pay gas fees with any supported token, removing the need to hold native NERO tokens.

```javascript
// Paymaster integration in userOpSDK.js
async getSupportedTokens() {
  try {
    // Create minimal UserOp for the request
    const minimalUserOp = {
      sender: this.aaWalletAddress,
      nonce: "0x0",
      initCode: "0x",
      callData: "0x",
      callGasLimit: "0x0",
      verificationGasLimit: "0x0",
      preVerificationGas: "0x0",
      maxFeePerGas: "0x0",
      maxPriorityFeePerGas: "0x0",
      paymasterAndData: "0x",
      signature: "0x"
    };
    
    // Call the pm_supported_tokens method
    const response = await provider.send("pm_supported_tokens", [
      minimalUserOp,
      CONSTANTS.PAYMASTER_API_KEY,
      CONSTANTS.ENTRYPOINT_ADDRESS
    ]);
    
    // Format the tokens
    return response.tokens.map(token => ({
      address: token.token || token.address,
      symbol: token.symbol,
      name: token.name || token.symbol,
      decimals: token.decimals,
      type: token.type
    }));
  } catch (error) {
    // Error handling
    // ...
  }
}
```

### UserOperation Bundling
Multiple actions are combined into single transactions:
- Purchasing tickets for multiple lotteries at once
- Combining approval and purchase operations
- Reducing overall gas costs and improving UX

```javascript
// Batch ticket purchase in userOpSDK.js
createBatchTicketPurchaseOp(selections) {
  // Prepare batch arrays
  const lotteryIds = selections.map(s => s.lotteryId);
  const tokenAddresses = selections.map(s => s.tokenAddress);
  const quantities = selections.map(s => s.quantity);
  
  // Encode function call
  const callData = contractInterface.encodeFunctionData(
    'batchPurchaseTickets',
    [lotteryIds, tokenAddresses, quantities]
  );
  
  // Add call to builder
  this.builder.execute(contractAddress, 0, callData);
  
  return this.builder;
}
```

### Signature Abstraction
The session key system enables:
- Time-limited authorization for specific operations
- Reduced signature prompts for repetitive actions
- Improved user experience similar to Web2 applications
- Enhanced security through scope-limited permissions

## Security Considerations

### Smart Contract Security
- Reentrancy protection using OpenZeppelin's ReentrancyGuard
- Access control with Ownable pattern
- Time-locked operations for recovery mechanisms
- Proper validation of all user inputs

### Session Key Security
- Keys have limited scope (only specific operations)
- Time-based expiration
- Ability to revoke keys at any time
- Local storage encryption for key material

### Social Recovery Security
- Multi-guardian approval requirement
- Time-delay for recovery actions
- On-chain verification of guardian signatures
- Cancelation mechanism for owner

### Frontend Security
- No private keys stored in browser (except session keys)
- Session keys are temporary and limited in scope
- All sensitive operations require explicit user approval
- Clear security indicators for session key status

## Technology Stack

### Frontend
- React with TypeScript
- wagmi v2 for wallet interactions
- viem for Ethereum RPC interactions
- TanStack Query for data fetching
- React Router for navigation
- Vite for build tooling

### Backend
- Node.js with Express
- Ethers.js for blockchain interactions
- UserOp SDK for Account Abstraction
- Axios for API requests

### Smart Contracts
- Solidity 0.8.12
- OpenZeppelin for contract security primitives
- Hardhat for development, testing and deployment

### Blockchain
- NERO Chain (EVM Compatible)
- ERC-4337 Account Abstraction
- Custom Paymaster for gas abstraction
- AA Platform integration

## Development Mode

The application includes a comprehensive development mode that:
- Functions without a real wallet connection
- Provides mock tokens and lottery data
- Simulates blockchain transactions
- Allows full testing of UI and UX without real assets

## Future Extensions

The modular architecture allows for several planned extensions:

### Cross-Chain Capabilities
- Support for lotteries across multiple blockchains
- Unified experience through common AA interface
- Cross-chain prize distribution

### NFT Integration
- Special ticket types as NFTs
- Collectible lottery memorabilia
- Enhanced prize distribution mechanisms

### DAO Governance
- Community control of lottery parameters
- Decentralized prize pool management
- Collective decision making on feature development

### Advanced AI Features
- Predictive analytics for optimal entry timing
- Personalized lottery recommendations
- Pattern recognition for "lucky" numbers

## Conclusion

AlpacaLotto's architecture represents a new generation of blockchain applications that leverage Account Abstraction to deliver Web2-like user experiences without compromising on Web3 capabilities. By combining AI optimization with NERO Chain's advanced AA features, the platform provides a seamless, secure, and efficient lottery experience that can appeal to both crypto-native users and newcomers alike.
