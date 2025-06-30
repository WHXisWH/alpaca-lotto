require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const referralRoutes = require('./routes/referralRoutes');
const leaderboardRoutes = require('./routes/leaderboardRoutes');
const { initializeDatabase } = require('./services/databaseService');

const app = express();
const PORT = process.env.PORT || 3001;

// --- CORS Configuration Start ---
// Explicitly define the allowed origin
const allowedOrigins = ['https://alpaca-lotto.vercel.app'];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  }
};

// Use the configured cors options
app.use(cors(corsOptions));
// --- CORS Configuration End ---

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

        // Render sets the PORT environment variable.
        const port = process.env.PORT || 3001;
        
        app.listen(port, () => {
            console.log(`Alpaca Lotto Backend listening on port ${port}`);
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