require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const referralRoutes = require('./routes/referralRoutes');
const leaderboardRoutes = require('./routes/leaderboardRoutes');
const { initializeDatabase } = require('./services/databaseService');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());

app.use('/api', referralRoutes);
app.use('/api', leaderboardRoutes);

app.get('/', (req, res) => {
  res.send('Alpaca Lotto Backend is running!');
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send({ success: false, message: 'Something broke!' });
});

const startServer = async () => {
    try {
        await initializeDatabase();

        app.listen(PORT, () => {
            console.log(`Alpaca Lotto Backend listening on port ${PORT}`);
            if (!process.env.MINTER_PRIVATE_KEY) {
              console.warn('WARNING: MINTER_PRIVATE_KEY is not set in .env file. Minting functionality will fail.');
            }
            if (!process.env.RPC_URL) {
              console.warn('WARNING: RPC_URL is not set in .env file.');
            }
            if (!process.env.ALPACALOTTO_CONTRACT_ADDRESS) {
              console.warn('WARNING: ALPACALOTTO_CONTRACT_ADDRESS is not set in .env file.');
            }
            if (!process.env.PACALUCKTOKEN_CONTRACT_ADDRESS) {
              console.warn('WARNING: PACALUCKTOKEN_CONTRACT_ADDRESS is not set in .env file.');
            }
            if (!process.env.DATABASE_URL) {
                console.warn('WARNING: DATABASE_URL is not set in .env file. Database connection will fail.');
            }
        });
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
};

startServer();