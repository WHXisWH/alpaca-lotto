# AlpacaLotto

AlpacaLotto is a friendly blockchain lottery dApp built on the NERO Chain. Powered by Account Abstraction, it delivers a Web2‑like experience while retaining full Web3 functionality.
![AlpacaLotto Banner](./docs/banner.png)


## 🌐 Live Demo & Homepage

* Try AlpacaLotto: [https://alpaca-lotto.vercel.app/](https://alpaca-lotto.vercel.app/)
* Join us on X (Twitter): [https://x.com/AlpacaLotto](https://x.com/AlpacaLotto)

---

## ✨ Highlights

* **Social login onboarding** – Sign up with Google and receive a smart account automatically.
* **Multi‑token tickets** – Purchase tickets with USDC or the new PacaLuckToken (PLT).
* **Gas abstraction** – Paymaster lets you cover gas fees in USDC or PLT; some actions may be sponsored.
* **Referral & milestone rewards** – Earn PLT for inviting friends and reaching purchase milestones.
* **One‑click prize claims** – A “Claim Prize” button appears in *My Tickets* after each draw.
* **How to Play guide** – Built‑in modal explains the platform and token flow for newcomers.

---

## 🛠 Tech Stack

* **Frontend:** React + TypeScript, Vite, Chakra UI 3, Wagmi, Viem, TanStack Query
* **Auth & Wallets:** Web3Auth (social login) with ERC‑4337 smart accounts
* **Smart Contracts:** Solidity 0.8.x (`AlpacaLotto.sol`, `PacaLuckToken.sol`, session‑key & social‑recovery modules)
* **Backend:** Node.js / Express referral API with PostgreSQL (Render)
* **Infrastructure:** NERO Testnet RPC, Bundler, Paymaster

---

## 🚀 Quick Start

```bash
git clone <your‑repo‑url>
cd alpaca-lotto
npm install
npm run dev
```

Create a `.env` file with your NERO RPC, Bundler, Paymaster, and contract addresses.

---

## 📂 Repository Layout

```
backend/        Node.js referral API (Express + PostgreSQL)
contracts/      Solidity sources & tests
src/            React application
public/         Static assets served by Vite
scripts/        Utility or deployment scripts
docs/           Images and documentation
...
```

---

## 🛣 Roadmap
1. Airdrop PLT to new users.
2. Finalise milestone reward payouts.
3. Polish PLT gas‑payment UX.
4. Improve responsive design & accessibility.
5. Add batched purchases and social recovery UI.

---

## 📜 License
MIT
