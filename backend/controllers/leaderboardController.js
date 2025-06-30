const databaseService = require('../services/databaseService');

const getReferralLeaderboard = async (req, res) => {
  try {
    const topReferrers = await databaseService.getTopReferrers();
    res.status(200).json({
      success: true,
      data: topReferrers,
    });
  } catch (error) {
    console.error("Error in getReferralLeaderboard:", error);
    res.status(500).json({ success: false, message: "Failed to fetch referral leaderboard." });
  }
};

module.exports = {
  getReferralLeaderboard,
};