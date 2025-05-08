require('dotenv').config();
const express = require('express');
const cors = require('cors');
const apiRoutes = require('./routes/api');
const { ethers } = require('ethers');

// Initialize Express application
const app = express();

// CORS settings - Allow requests from frontend
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://alpaca-lotto.vercel.app',
    process.env.FRONTEND_URL
  ].filter(Boolean),
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'AlpacaLotto API Server is running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Health check route
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api', apiRoutes);

// API 404 handler
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'API endpoint not found',
    path: req.originalUrl
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('An error occurred:', err.stack);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Validate environment variables
const validateEnv = () => {
  const requiredEnvVars = [
    'PORT',
    'NERO_RPC_URL',
    'LOTTERY_CONTRACT_ADDRESS',
    'PAYMASTER_URL',
    'PAYMASTER_API_KEY',
    'ENTRYPOINT_ADDRESS'
  ];
  
  const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingEnvVars.length > 0) {
    console.warn(`Warning: The following environment variables are not set: ${missingEnvVars.join(', ')}`);
    console.warn('Some features may not work correctly.');
  }
};

// Validate contract address
const validateContractAddress = () => {
  const contractAddress = process.env.LOTTERY_CONTRACT_ADDRESS;
  
  if (!contractAddress || !ethers.utils.isAddress(contractAddress)) {
    console.warn('Warning: LOTTERY_CONTRACT_ADDRESS is not a valid Ethereum address.');
    console.warn('Lottery-related features may not work correctly.');
  }
};

// Start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API accessible at http://localhost:${PORT}/api`);
  console.log(`Health check available at http://localhost:${PORT}/health`);
  
  // Validate environment variables and contract address
  validateEnv();
  validateContractAddress();
  
  // Current environment info
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`RPC URL: ${process.env.NERO_RPC_URL}`);
  console.log(`Contract address: ${process.env.LOTTERY_CONTRACT_ADDRESS}`);
});
