const express = require('express');
const router = express.Router();
const leaderboardController = require('../controllers/leaderboardController');

router.get('/leaderboard/referrals', leaderboardController.getReferralLeaderboard);

module.exports = router;