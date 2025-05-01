# AlpacaLotto Architecture

This document outlines the system architecture of AlpacaLotto, a blockchain lottery application built on NERO Chain that leverages Account Abstraction and AI for an enhanced user experience.

## System Overview

AlpacaLotto is composed of three primary components:

1. **Smart Contracts**: The on-chain logic for lottery management, ticket purchases, and account abstraction features
2. **Backend Services**: NodeJS server providing AI token optimization and API endpoints 
3. **Frontend Application**: React-based user interface for interacting with the lottery system

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
│  │  │  WalletHook │    │ TokensHook  │    │ LotteriesHook│   │SessionKey│ │    │
│  │  └─────────────┘    └─────────────┘    └─────────────┘    └──────────┘ │    │
│  │        │                   │                  │                 │      │    │
│  │        ▼                   ▼                  ▼                 ▼      │    │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌──────────┐ │    │
│  │  │   UserOp    │    │    API      │    │  Component  │    │   Pages  │ │    │
│  │  │   Hook      │    │   Service   │    │   Library   │    │          │ │    │
│  │  └─────────────┘    └─────────────┘    └─────────────┘    └──────────┘ │    │
│  │                            │                                           │    │
│  └────────────────────────────┼───────────────────────────────────────────┘    │
│                               │                                                │
└───────────────────────────────┼────────────────────────────────────────────────┘
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
│  │    Manager       │    │                │    │      Wallet       │           │
│  └──────────────────┘    └────────────────┘    └───────────────────┘           │
│                                                                                │
│  ┌──────────────────┐                                                          │
│  │  SocialRecovery  │                                                          │
│  │     Module       │                                                          │
│  └──────────────────┘                                                          │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘
```

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

##### useWallet.js
Manages wallet connection and token fetching:
- Connects to MetaMask/other providers
- Retrieves token balances and metadata
- Handles chain switching

##### useUserOp.js
Handles UserOperation creation and execution:
- Creates transaction operations for ticket purchases
- Configures session keys and batch transactions
- Integrates with Paymaster for gas abstraction

##### useTokens.js
Manages token data and optimization:
- Fetches token balances and metadata
- Requests AI optimization for token selection
- Tracks recommendations and supported tokens

##### useLotteries.js
Handles lottery data and interactions:
- Fetches active and past lotteries
- Manages user tickets and winnings
- Processes ticket purchases and prize claims

##### useSessionKeys.js
Manages temporary session keys:
- Creates and stores session key data
- Tracks key expiration and validity
- Handles revocation and renewal

#### UI Components
React components providing the user interface:

- **Header**: Navigation and session key status
- **WalletConnect**: Wallet connection interface
- **ActiveLotteries**: List of current lottery events
- **LotteryDetails**: Detailed lottery information
- **TicketPurchase**: Ticket purchase modal with AI recommendations
- **TokenSelector**: Token selection with AI optimization
- **SessionKeyModal**: Session key creation interface
- **UserTickets**: User's purchased tickets display
- **TransactionModal**: Transaction status and confirmation

#### Pages
High-level page components:

- **HomePage**: Main landing page with active lotteries
- **PaymentPage**: Ticket purchase confirmation and execution

## Data Flow

### Ticket Purchase Flow
1. User browses active lotteries on HomePage
2. User selects a lottery and clicks "Buy Tickets"
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

## Account Abstraction Integration

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

### UserOperation Bundling
Multiple actions are combined into single transactions:
- Purchasing tickets for multiple lotteries at once
- Combining approval and purchase operations
- Reducing overall gas costs and improving UX

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