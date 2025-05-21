# AlpacaLotto: Seamless Blockchain Lottery with Account Abstraction on NERO Chain

AlpacaLotto is a user-friendly blockchain lottery platform built on the NERO Chain, leveraging the power of Account Abstraction (AA) to deliver an intuitive, Web2-like experience with robust Web3 capabilities. Our goal is to make participating in blockchain lotteries accessible and enjoyable for everyone.

![AlpacaLotto Banner](./docs/banner.png) [cite: 3]

## 🌐 Live Demo & Community

* **Try AlpacaLotto:** [https://alpaca-lotto.vercel.app/](https://alpaca-lotto.vercel.app/)
* **Join us on X (Twitter):** [https://x.com/AlpacaLotto](https://x.com/AlpacaLotto)

## ✨ Key Features

* **🚀 Easy Onboarding with Social Login**: Get started in seconds! Log in effortlessly using your Google account (Email login coming soon), and we'll automatically set up a secure smart account (AA wallet) for you.
* **💎 True Account Abstraction Wallets**: Interact directly with a smart contract wallet, enabling more flexible and secure transactions without the complexities of traditional EOA management.
* **⛽ Gas Fees Simplified (Paymaster Integration)**: Forget about needing native NERO tokens for gas! Purchase lottery tickets using USDC, with gas fees sponsored or payable in supported ERC20 tokens via our Paymaster integration. [cite: 5]
* **🔑 Session Key Functionality (Smart Contract Deployed)**: Our `SessionKeyManager.sol` contract is deployed, enabling future integration for features like "quick play" options, significantly reducing repetitive signature requests for a smoother user experience. [cite: 2]
* **🛡️ Social Recovery Capabilities (Smart Contract Deployed)**: The `SocialRecoveryModule.sol` contract is deployed, laying the groundwork for an enhanced security layer, allowing users to designate guardians for account recovery. [cite: 10]
* **🪙 Multi-Token Lottery Entry (Smart Contract Enabled)**: The underlying `AlpacaLotto.sol` contract is designed to support lottery ticket purchases with various ERC20 tokens. [cite: 2] Frontend integration for broader token selection is planned.
* **😊 Web2-Like Experience**: Enjoy a smooth user interface that hides Web3 complexities. For social login users, your AA wallet address is your primary identifier.
* **🔮 Future AI Enhancements**: We plan to integrate AI-driven features to enhance user support, provide lottery insights, and offer other smart functionalities.
* **Future AA Capabilities (Roadmap)**:
    * **Batched Operations**: Enabling actions like purchasing multiple tickets across different lotteries in a single transaction. [cite: 4]

## <img src="https://img.icons8.com/fluency/48/nero.png" width="24" height="24" alt="NERO Chain Icon"> NERO Chain Account Abstraction Integration

AlpacaLotto deeply leverages NERO Chain's native Account Abstraction features: [cite: 5]

* **Smart Contract Wallets**: All user interactions are managed through ERC-4337 compliant smart contract wallets, providing: [cite: 5]
    * Enhanced security and flexibility. [cite: 5]
    * The foundation for **Session Keys (via `SessionKeyManager.sol`)** for delegated, time-limited transaction permissions. [cite: 5, 10]
    * The groundwork for **Social Recovery (via `SocialRecoveryModule.sol`)** for improved account security. [cite: 5, 10]
    * Complex transaction logic, such as batched operations, directly from the user's wallet (planned). [cite: 5]
* **Paymaster for Gas Payments**: Our integration with Paymaster services on NERO Chain allows: [cite: 5]
    * **Sponsored Gas**: Potentially free transactions for users for certain actions. [cite: 5]
    * **ERC20 Gas Payment**: Users can pay gas fees using supported ERC20 tokens (like USDC) instead of native NERO. [cite: 5]
* **UserOperation Bundling (Roadmap)**: Multiple user actions can be grouped into a single atomic transaction, improving efficiency and user experience. [cite: 6]

## 🛠️ Tech Stack

AlpacaLotto currently consists of a decentralized frontend application and deployed smart contracts on the NERO Chain.

* **Frontend**:
    * React with TypeScript
    * Chakra UI (v3.19.1) for responsive and accessible UI components (utilizing local snippets and direct imports)
    * Wagmi (v2) for EOA wallet interactions
    * Viem for Ethereum RPC interactions
    * UserOp SDK for building and sending ERC-4337 UserOperations
    * Web3Auth for social login and EOA generation
    * TanStack Query for data fetching and state management
* **Smart Contracts (Deployed on NERO Chain)**:
    * Solidity (`AlpacaLotto.sol` uses `0.8.20`, other modules like `SessionKeyManager.sol` and `SocialRecoveryModule.sol` use `0.8.12`)
    * ERC-4337 Account Abstraction standards
    * **Core Contracts**:
        * `AlpacaLotto.sol`: Main lottery logic. [cite: 10]
        * `SessionKeyManager.sol`: Manages session keys for delegated actions. [cite: 10]
        * `SocialRecoveryModule.sol`: Enables social recovery mechanisms. [cite: 10]
        * (Plus any account implementation and factory contracts you've deployed)
* **Blockchain Interaction**:
    * Direct communication with NERO Chain RPC endpoints.
    * Interaction with ERC-4337 Bundler and Paymaster services on NERO Chain.

*(Note: No custom backend server is currently part of the core application. Future backend services might be developed for advanced features.)*

## 📂 Project Structure

The project repository is structured as follows:

```

alpaca-lotto/
├── contracts/                  \# Solidity smart contracts & Hardhat/Foundry project
│   ├── contracts/              \# Source .sol files
│   │   ├── AlpacaLotto.sol
│   │   ├── SessionKeyManager.sol
│   │   └── SocialRecoveryModule.sol
│   │   └── TestToken.sol       \# Example ERC20 test token
│   ├── ignition/modules/       \# Deployment scripts (e.g., Hardhat Ignition)
│   ├── test/                   \# Contract tests
│   ├── hardhat.config.js       \# Or foundry.toml, etc.
│   └── ...                     \# Other contract development files
├── docs/                       \# Project documentation and assets
│   └── banner.png
├── public/
│   └── images/                 \# Static images for the frontend
│       ├── alpaca-logo.png
│       └── alpaca-ai-bot-icon.png
│       └── alpaca-ai-bot-avatar.png
├── src/                        \# Frontend Vite application source
│   ├── abis/                   \# Smart contract ABIs (JSON)
│   ├── assets/                 \# Other static assets (if any, managed by Vite)
│   ├── components/             \# React components [cite: 11]
│   │   ├── common/             \# Wallet connection, social login
│   │   ├── layout/             \# Main layout components
│   │   ├── lottery/            \# Lottery specific UI (cards, grid, info)
│   │   ├── ui/                 \# Local Chakra UI snippets (Button, Alert, etc.)
│   │   └── web2\_user/          \# Mockups for Web2 user dashboard features
│   ├── config.ts               \# Application configuration (RPC URLs, contract addresses)
│   ├── context/                \# React Context providers (AAWallet, Lottery, Paymaster)
│   ├── lib/                    \# Core libraries (e.g., AA SimpleAccount)
│   ├── utils/                  \# Utility functions
│   ├── App.tsx                 \# Main application component
│   ├── main.tsx                \# Application entry point
│   └── vite-env.d.ts           \# Vite environment types
├── scripts/                    \# Other utility or deployment scripts (if any)
├── .env.example                \# Example environment variables for frontend
├── .gitignore
├── architecture.md             \# If you maintain this
├── package.json
├── README.md
└── vite.config.js
└── ...                         \# Other root project files (tsconfig.json, etc.)

````

## 🚀 Getting Started

### Prerequisites

* Node.js (v18+ recommended)
* A modern web browser with a wallet extension like MetaMask (for EOA connection testing)
* Configuration for NERO Chain Testnet in your wallet.
* (If working on contracts) A smart contract development environment like Hardhat or Foundry.

### Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone <your-repo-url>
    cd alpaca-lotto
    ```
2.  **Install frontend dependencies:** (Assuming your `package.json` is in the root for the Vite app)
    ```bash
    npm install
    ```
3.  **(If contract development is separate)** Navigate to your `contracts` directory and install its dependencies if needed.

### Configuration (Frontend)

1.  Create a `.env` file in the root of the `alpaca-lotto` project directory (alongside `package.json` for the Vite app).
2.  Populate it with the necessary environment variables (refer to `src/config.ts` and the example below):

    ```env
    VITE_NERO_RPC_URL="[https://rpc-testnet.nerochain.io](https://rpc-testnet.nerochain.io)"
    VITE_BUNDLER_URL="[https://bundler-testnet.nerochain.io](https://bundler-testnet.nerochain.io)" # Or your specific bundler
    VITE_PAYMASTER_URL="[https://paymaster-testnet.nerochain.io](https://paymaster-testnet.nerochain.io)" # If using a paymaster [cite: 7]
    VITE_PAYMASTER_API_KEY="your_paymaster_api_key" # If required by your paymaster [cite: 7]
    VITE_LOTTERY_CONTRACT_ADDRESS="your_AlpacaLotto_contract_address_ON_NERO" [cite: 7]
    VITE_SESSION_KEY_MANAGER_ADDRESS="your_SessionKeyManager_contract_address_ON_NERO"
    VITE_SOCIAL_RECOVERY_MODULE_ADDRESS="your_SocialRecoveryModule_contract_address_ON_NERO"
    VITE_ENTRYPOINT_ADDRESS="0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789" # Standard EntryPoint [cite: 7]
    VITE_ACCOUNT_FACTORY_ADDRESS="your_SimpleAccountFactory_address_ON_NERO" [cite: 7]
    VITE_WEB3AUTH_CLIENT_ID="your_web3auth_client_id"
    # Add other variables as needed by your config.ts
    ```
    *Ensure you replace placeholder addresses with your actual deployed contract addresses on NERO Chain.*

### Running the Frontend Application

1.  **Start the development server:**
    ```bash
    npm run dev
    ```
2.  Open your browser and navigate to the local URL provided by Vite (usually `http://localhost:5173` or similar).

*(For deploying and interacting with smart contracts, refer to the `contracts` directory's own README or documentation.)*

## 🛣️ Development Roadmap

*(Aligned with the UIUX Optimization Design Document)*

### Phase 1: Foundation & Core AA Experience (Largely Complete, Ongoing Refinements)
* ✅ Social Login (Google) & EOA Wallet Connection.
* ✅ Automatic AA Wallet creation/association.
* ✅ Paymaster integration for gas abstraction (USDC payments for tickets).
* ✅ Core UI components migrated to Chakra UI v3.
* ✅ Initial Alpaca theming and mockups for Web2 user dashboard (Credit Card, AI Bot).
* Smart Contracts Deployed: `AlpacaLotto.sol`, `SessionKeyManager.sol`, `SocialRecoveryModule.sol`.
* 🚧 **To Do/Refine**:
    * Email Passwordless login full testing & refinement. [cite: 14]
    * Deeper Alpaca theme integration (colors, imagery).
    * Refine loading states and error handling for user-friendliness. [cite: 21, 22]
    * Finalize `ConnectWallet.tsx` return logic and overall flow. [cite: 23]

### Phase 2: Enhanced Features & Frontend Integration
* ▶️ **Fiat On-Ramp Integration**: Implement a real fiat-to-crypto on-ramp service for the "Credit Card" funding option.
* ▶️ **AI Bot (Basic Implementation)**: Develop initial functionality for the AI Bot assistant beyond mockups.
* ▶️ **Session Key Frontend Integration**: Connect UI elements to utilize `SessionKeyManager.sol` for smoother repeat interactions.
* ▶️ **Lottery Purchase & Management UI Polish**: Refine frontend interactions for lottery purchase, ticket display, and prize claims.
* ▶️ **Comprehensive Responsive Design**.
* ▶️ **Accessibility (A11y) Audit & Improvements**.

### Phase 3: Advanced AA Features & Ecosystem Growth
* Future: Frontend integration for **Social Recovery** using `SocialRecoveryModule.sol`.
* Future: Implement **Batched Operations** in the frontend for multi-ticket purchases or other combined actions.
* Future: Expand AI capabilities (e.g., lottery data analysis, personalized suggestions).
* Future: Community engagement features.
* Future: Cross-chain lottery participation capabilities. [cite: 8]
* Future: Loyalty rewards system for frequent players. [cite: 8]

## 🤝 Contributing

We welcome contributions! (Details to be added if the project becomes open source).

## 📜 License

This project is licensed under the MIT License. (Or your chosen license).