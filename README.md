# AlpacaLotto: AI-Powered Blockchain Lottery with Account Abstraction

AlpacaLotto is a next-generation blockchain lottery platform built on NERO Chain that leverages Account Abstraction (AA) and AI to deliver a seamless, Web2-like experience with powerful Web3 capabilities. Users can enter lotteries with any token in their wallet, leverage AI for optimal token selection, and enjoy one-click interactions through session keys.

![AlpacaLotto Banner](./docs/banner.png)

## 🌐 Demo
https://alpaca-lotto.vercel.app/

## Key Features

### 🎟️ Multi-Token Lottery Entry
- Enter lotteries using ANY token in your wallet
- No need to hold native NERO tokens
- Pay lottery tickets and gas with your preferred tokens

### 🤖 AI-Powered Token Optimization
- Advanced algorithm analyzes your tokens to find the most cost-effective option
- Considers balance, volatility, and slippage to optimize your experience
- Automatically recommends the best token for both ticket purchase and gas payment

### 🔑 Session Key Quick Play
- Create temporary session keys for lottery interactions
- Enter multiple lotteries with just one initial signature
- Secure, time-limited keys for frictionless experience

### 🔄 Batched Operations
- Purchase multiple tickets across different lotteries in a single transaction
- Combine ticket purchase and referral rewards in one operation
- Optimize gas costs through bundled UserOperations

### 🛡️ Social Recovery
- Protect lottery winnings with social recovery options
- Designate trusted contacts who can help recover an account
- Enhanced security for high-value prizes

## Technical Stack

### Smart Contracts
- Solidity 0.8.12
- ERC-4337 Account Abstraction
- OpenZeppelin libraries

### Backend
- Node.js with Express
- ethers.js for blockchain interaction
- UserOp SDK for Account Abstraction

### Frontend
- React with TypeScript
- wagmi v2 for wallet interactions
- viem for Ethereum RPC interactions
- TanStack Query for data fetching

## NERO Chain Account Abstraction Integration

The project deeply integrates with NERO Chain's Account Abstraction capabilities:

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

## Getting Started

### Prerequisites
- Node.js v16+
- MetaMask or another Web3 wallet
- NERO Chain testnet connection

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/alpaca-lotto.git
cd alpaca-lotto
```

2. Install backend dependencies:
```bash
cd backend
npm install
```

3. Install frontend dependencies:
```bash
cd frontend
npm install
```

### Configuration

1. Create a `.env` file in the backend directory:
```
PORT=3001
NERO_RPC_URL=https://rpc-testnet.nerochain.io
LOTTERY_CONTRACT_ADDRESS=your_contract_address
PAYMASTER_URL=https://paymaster-testnet.nerochain.io
PAYMASTER_API_KEY=your_api_key
ENTRYPOINT_ADDRESS=0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789
```

2. Create a `.env` file in the frontend directory:
```
VITE_API_BASE_URL=http://localhost:3001/api
VITE_NERO_RPC_URL=https://rpc-testnet.nerochain.io
VITE_BUNDLER_URL=https://bundler-testnet.nerochain.io
VITE_PAYMASTER_URL=https://paymaster-testnet.nerochain.io
VITE_LOTTERY_CONTRACT_ADDRESS=your_contract_address
VITE_PAYMASTER_API_KEY=your_api_key
VITE_ENTRYPOINT_ADDRESS=0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789
VITE_ACCOUNT_FACTORY_ADDRESS=0x9406Cc6185a346906296840746125a0E44976454
```

### Running the Application

1. Start the backend:
```bash
cd backend
npm run dev
```

2. Start the frontend:
```bash
cd frontend
npm run dev
```

3. Open your browser and navigate to `http://localhost:3000`

## Development Roadmap

### 🟦 Wave 2: Core Features (Current)
- Multi-token lottery implementation with ERC20 compatibility
- Session key functionality for gasless repeat participation
- Basic AI token selection for optimal gas costs
- Smart contract security auditing and optimization

### 🟩 Wave 3: Enhanced Features
- Advanced token optimization algorithm based on market conditions
- Social recovery system with guardian designation
- UI/UX refinement for seamless cross-platform experience
- Batch transaction processing for improved efficiency

### 🟪 Wave 4: Ecosystem Expansion
- Cross-chain lottery participation capabilities
- Community governance for lottery parameters
- Loyalty rewards system for frequent players
- Integration with external protocols for expanded prize options

## Project Structure

The project follows a standard structure:

```
alpaca-lotto/
├── README.md                 // Project overview
├── architecture.md           // Detailed system architecture design
├── backend/                  // Node.js backend
│   ├── abis/                 // Contract ABIs
│   ├── mock/                 // Mock data for development
│   ├── routes/               // API routes
│   ├── services/             // Business logic services
│   ├── app.js                // Express application
│   └── package.json
├── contracts/                // Solidity smart contracts
│   ├── AlpacaLotto.sol       // Main lottery contract
│   ├── SessionKeyManager.sol // Session key management
│   ├── SocialRecoveryModule.sol // Social recovery
│   └── TestToken.sol         // ERC20 test token
├── frontend/                 // React frontend
│   ├── src/
│   │   ├── components/       // React components
│   │   ├── constants/        // Constants and ABIs
│   │   ├── hooks/            // Custom React hooks
│   │   ├── pages/            // Page components
│   │   ├── services/         // API and blockchain services
│   │   └── styles/           // CSS styles
│   ├── package.json
│   └── vite.config.js        // Vite configuration
└── scripts/                  // Deployment scripts
```

## License

This project is licensed under the MIT License.
