const express = require('express');
const router = express.Router();
const referralController = require('../controllers/referralController');

router.post('/referral', referralController.handleReferral);

module.exports = router;