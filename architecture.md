# AlpacaLotto Architecture

This document outlines the system architecture of AlpacaLotto, a blockchain lottery application built on NERO Chain. It leverages Account Abstraction (AA) to deliver a seamless, Web2-like user experience with powerful Web3 capabilities.

## System Overview

AlpacaLotto is primarily composed of two main components:

1.  **Smart Contracts**: Deployed on the NERO Chain, these contracts manage all on-chain logic, including lottery creation, ticket purchases, prize distribution, and Account Abstraction features like session keys and social recovery.
2.  **Frontend Application**: A React-based single-page application that users interact with. It communicates directly with the NERO Chain (via RPC, Bundler, and Paymaster services) and deployed smart contracts to facilitate user actions and display lottery information.

The architecture is designed to maximize the benefits of NERO Chain's Account Abstraction capabilities, providing a user-friendly interface while retaining the security and decentralization of blockchain technology.

## Architecture Diagram

![AlpacaLotto System Architecture](./docs/images/architecture.png) 

## Account Abstraction (AA) Implementation

AlpacaLotto implements the ERC-4337 Account Abstraction standard through direct interaction with NERO Chain's AA infrastructure:

### Smart Contract Wallets
Users interact via smart contract wallets, created and managed using:

* **Account Factory**: A deployed factory contract (e.g., `SimpleAccountFactory`) used to deterministically create smart contract wallets for users. [cite: 85]
* **EntryPoint Contract**: The standard ERC-4337 EntryPoint contract (e.g., `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789`) orchestrates UserOperation execution. [cite: 85]
* **Counterfactual Deployment**: AA Wallets can be interacted with (e.g., receive funds, have UserOps prepared) even before their first on-chain transaction deploys them.

The frontend, particularly through `AAWalletContext` and `SimpleAccount.ts`[cite: 28], manages the user's AA wallet address and initialization.

### UserOperations
All blockchain interactions initiated by the user (after AA wallet setup) are packaged as UserOperations:

* The frontend application, using the **UserOp SDK** and custom logic within `AAWalletContext` and `LotteryContext`[cite: 25, 26], constructs UserOperations for actions like purchasing lottery tickets.
* These UserOperations include fields like `sender` (AA wallet address), `nonce`, `initCode` (if a new wallet), `callData` (the actual function call to `AlpacaLotto.sol` or other contracts), gas parameters, and potentially `paymasterAndData`. [cite: 34]

Example of how `callData` might be prepared in the frontend (conceptual, actual implementation in `LotteryContext.tsx`):
```typescript
// Conceptual: Building callData for a 'purchaseTickets' UserOperation
const lotteryInterface = new ethers.utils.Interface(LOTTO_ABI_JSON);
const purchaseCallData = lotteryInterface.encodeFunctionData(
  "purchaseTickets",
  [lotteryId, USDC_TOKEN_ADDRESS, quantity]
);
// This callData would be part of the UserOperation sent to the EntryPoint.
```

### Paymaster Integration

A core feature is leveraging Paymasters on NERO Chain for flexible gas payments, managed via `PaymasterContext.tsx`[cite: 24]:

  * The frontend configures UserOperations to use a Paymaster, allowing gas fees to be:
      * **Sponsored (Type 0)**: Potentially making transactions free for the user. [cite: 83]
      * **Paid with ERC20 tokens (Type 1 or 2)**: Users can pay gas with tokens like USDC, instead of needing the native NERO token. [cite: 37, 83]
  * `PaymasterContext.tsx` fetches supported tokens for gas payment and applies paymaster data to the UserOperation builder. [cite: 24]

### Session Keys (Smart Contract Deployed, Frontend Integration Planned)

The `SessionKeyManager.sol` contract is deployed. [cite: 88]

  * Future frontend integration via a dedicated context or service (`useSessionKeys.ts` was an old concept) will allow users to create temporary, scoped keys.
  * This will enable "quick play" features and reduce signature prompts for repetitive actions, enhancing the Web2-like experience. [cite: 38, 74]

### Batch Operations (Smart Contract Support, Frontend Integration Planned)

The `AlpacaLotto.sol` contract includes a `batchPurchaseTickets` function. [cite: 44]

  * Future frontend integration will allow users to construct UserOperations that call this batch function, enabling multiple ticket purchases in a single transaction. [cite: 42, 72]

### Social Recovery (Smart Contract Deployed, Frontend Integration Planned)

The `SocialRecoveryModule.sol` contract is deployed. [cite: 88]

  * Future frontend integration will allow users to configure guardians and utilize social recovery mechanisms for their AA wallets, enhancing security. [cite: 46]

## Component Details

### Smart Contracts (Deployed on NERO Chain)

  * **`AlpacaLotto.sol` (v0.8.20)**:
      * Manages lottery creation, ticket sales (supporting various ERC20 tokens), random number generation for draws, and prize distribution. [cite: 44]
      * Includes functions for single and batch ticket purchases. [cite: 44]
      * Integrates with `SessionKeyManager` for authorized actions. [cite: 44]
  * **`SessionKeyManager.sol` (v0.8.12)**:
      * Handles the registration, validation, and revocation of session keys associated with user AA wallets. [cite: 45, 46]
      * Allows defining permissions for session keys (e.g., allowed target contracts, function selectors, spending limits).
  * **`SocialRecoveryModule.sol` (v0.8.12)**:
      * Provides the on-chain logic for users to set up trusted guardians who can help recover access to their AA wallet if the primary owner key is lost. [cite: 46]
  * **Account Contract & Factory**: Standard ERC-4337 compliant smart contract wallet implementation (e.g., based on `SimpleAccount.sol`) and its corresponding factory for deployment.

### Frontend Application (React, Vite, Chakra UI)

The frontend is responsible for user interaction, constructing UserOperations, and communicating with NERO Chain.

  * **Core Contexts (`src/context/`)**:
      * **`AAWalletContext.tsx`**: Manages EOA connection (via Wagmi), social login (via Web3Auth), AA wallet initialization (`SimpleAccount.ts`), and building/sending UserOperations via the UserOp SDK. [cite: 28]
      * **`LotteryContext.tsx`**: Fetches lottery data from `AlpacaLotto.sol`, handles ticket purchase logic (constructing `callData`), manages user's owned tickets, and interacts with `AAWalletContext` to send transactions. [cite: 25]
      * **`PaymasterContext.tsx`**: Fetches supported paymaster tokens, estimates gas costs with paymaster options, and configures UserOperations to use a selected paymaster for gas payments. [cite: 24]
  * **UI Components (`src/components/`)**:
      * **`common/ConnectWallet.tsx` & `common/SocialLogin.tsx`**: UI for wallet connection and social/email login, guiding users through AA wallet setup. [cite: 4, 2]
      * **`lottery/`**: Components for displaying lottery information (`LotteryInfo.tsx`), ticket cards (`TicketCard.tsx`), ticket grid (`TicketGrid.tsx`), owned tickets (`OwnedTickets.tsx`), and paymaster settings (`PaymasterSettings.tsx`). [cite: 9, 10]
      * **`web2_user/Web2UserDashboardMockup.tsx`**: Mockup UI for Web2 user features like fiat on-ramp (credit card) and an AI assistant bot.
      * **`layout/Layout.tsx`**: Main application layout structure including header and footer. [cite: 5]
      * **`ui/`**: Local Chakra UI component snippets, ensuring consistent styling and v3 compatibility.
  * **Configuration (`src/config.ts`)**: Contains application-level configurations like RPC URLs, contract addresses, and other constants. [cite: 31]
  * **AA Library (`src/lib/aa/SimpleAccount.ts`)**: Custom `SimpleAccount` builder class extending UserOp SDK's `UserOperationBuilder` to streamline AA wallet operations. [cite: 28]

## Data Flow Examples

### 1\. User Onboarding & AA Wallet Creation (Social Login Flow)

1.  User selects "Social Login" (e.g., Google) in `ConnectWallet.tsx`. [cite: 4]
2.  `SocialLogin.tsx` interacts with `AAWalletContext` which uses Web3Auth to authenticate the user. [cite: 2, 28]
3.  Web3Auth returns an EOA (signer).
4.  `AAWalletContext` uses this EOA signer and `SimpleAccount.ts` to initialize an AA wallet builder and determine the counterfactual AA wallet address. [cite: 28]
5.  The AA wallet address is displayed to the user. Actual on-chain deployment occurs with the first UserOperation.

### 2\. Ticket Purchase Flow (with Paymaster)

1.  User views available lotteries (`TicketGrid.tsx` using `LotteryContext`). [cite: 9, 25]
2.  User selects quantity and clicks "Purchase" on a `TicketCard.tsx`. [cite: 10]
3.  `LotteryContext` prepares the `callData` for `AlpacaLotto.sol`'s `purchaseTickets` function. [cite: 25]
4.  `PaymasterContext` is consulted for gas payment options; user might select to pay gas with USDC or use sponsored gas. [cite: 24]
5.  `AAWalletContext` (using `SimpleAccount.ts` and UserOp SDK) builds the UserOperation, including the `callData` and `paymasterAndData`. [cite: 28]
6.  The UserOperation is signed (typically by the EOA signer associated with the AA wallet, or by a session key in the future) and sent to the Bundler on NERO Chain.
7.  Bundler sends it to the EntryPoint, which validates and executes the transaction via the AA wallet, interacting with the Paymaster and `AlpacaLotto.sol`.
8.  Frontend UI (`LotteryContext`, `TicketCard.tsx`) updates upon transaction confirmation. [cite: 25, 10]

### 3\. Session Key Usage Flow (Future Frontend Integration)

1.  User initiates a process to create a session key via a UI element (e.g., "Enable Quick Play").
2.  Frontend generates a new temporary key pair locally.
3.  A UserOperation is constructed to call `SessionKeyManager.sol` to register this new public key with specific permissions (e.g., allowed to call `purchaseTickets` on `AlpacaLotto.sol` for a limited time).
4.  User signs this UserOperation once.
5.  The session key (private key) is stored securely in the frontend (e.g., browser's local storage, potentially encrypted).
6.  For subsequent actions within the session's scope and duration (e.g., purchasing another ticket), UserOperations are signed by this local session key, requiring no further prompts from the user's main wallet. [cite: 64]

## Security Considerations

  * **Smart Contract Security**: Contracts (`AlpacaLotto.sol`, `SessionKeyManager.sol`, `SocialRecoveryModule.sol`) should undergo thorough auditing. Standard practices like ReentrancyGuard, Ownable, and input validation are crucial. [cite: 74]
  * **Session Key Security**: Session keys will have limited permissions (target contracts, functions, spending limits, duration) and secure local storage. [cite: 74]
  * **Social Recovery Security**: Guardian-based recovery mechanisms in `SocialRecoveryModule.sol` add a layer of protection against loss of primary owner keys. [cite: 74]
  * **Frontend Security**:
      * No main EOA private keys are stored in the browser (Web3Auth handles this for social logins; EOA wallets manage their own keys).
      * UserOp SDK and `SimpleAccount.ts` handle UserOperation signing and construction securely.
      * Careful management of any locally stored session private keys.
  * **Paymaster Security**: Trust in the deployed Paymaster contract's logic and solvency (if it sponsors gas or holds pre-paid tokens).

## Future Extensions (Conceptual)

  * **Advanced AI Features**: Beyond a simple AI Bot, potential for AI to analyze lottery odds, suggest participation strategies, or personalize user experience.
  * **Cross-Chain Capabilities**: Exploring lotteries spanning multiple compatible blockchains.
  * **NFT Integration**: Lottery tickets as NFTs, or NFT-based prizes.
  * **DAO Governance**: Community-driven control over lottery parameters or platform development.
