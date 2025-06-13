require('dotenv').config();
const { ethers } = require('ethers');
const neroChainService = require('../services/neroChainService');
const databaseService = require('../services/databaseService');

const REFEREE_REWARD_PLT = parseFloat(process.env.REFEREE_REWARD_PLT || "50");
const REFERRER_REWARD_PLT = parseFloat(process.env.REFERRER_REWARD_PLT || "100");
const REFERRER_QUALIFICATION_USDC_THRESHOLD = parseFloat(process.env.REFERRER_QUALIFICATION_USDC_THRESHOLD || "10");

const handleReferral = async (req, res) => {
  const { currentUserAA, referrerAA } = req.body;

  if (!currentUserAA || !referrerAA) {
    return res.status(400).json({ success: false, message: "currentUserAA and referrerAA are required." });
  }

  if (!ethers.utils.isAddress(currentUserAA) || !ethers.utils.isAddress(referrerAA)) {
    return res.status(400).json({ success: false, message: "Invalid Ethereum address format provided." });
  }

  if (currentUserAA.toLowerCase() === referrerAA.toLowerCase()) {
    return res.status(400).json({ success: false, message: "You cannot refer yourself." });
  }

  try {
    const existingReferral = await databaseService.findReferralByCurrentUserAA(currentUserAA);
    if (existingReferral) {
      await databaseService.recordFailedReferralAttempt(currentUserAA, referrerAA, "User has already been referred");
      return res.status(400).json({ success: false, message: "This user has already been referred. Each user can only be referred once." });
    }

    const currentUserHasPurchased = await neroChainService.getHasMadeFirstPurchase(currentUserAA);
    if (currentUserHasPurchased) {
      await databaseService.recordFailedReferralAttempt(currentUserAA, referrerAA, "User has already made a purchase");
      return res.status(400).json({ success: false, message: "Referral failed: You are not eligible because you have already made a purchase." });
    }

    const referrerCumulativeUSDC = await neroChainService.getCumulativeTicketsPurchased(referrerAA);
    if (referrerCumulativeUSDC < REFERRER_QUALIFICATION_USDC_THRESHOLD) {
      const failureReason = `Referrer not qualified. Required: ${REFERRER_QUALIFICATION_USDC_THRESHOLD} USDC, Actual: ${referrerCumulativeUSDC} USDC.`;
      await databaseService.recordFailedReferralAttempt(currentUserAA, referrerAA, failureReason);
      return res.status(400).json({ success: false, message: `Referral failed: The referrer has not yet met the purchase threshold of ${REFERRER_QUALIFICATION_USDC_THRESHOLD} USDC.` });
    }

    let refereeTxHash = null;
    let referrerTxHash = null;

    if (REFEREE_REWARD_PLT > 0) {
        refereeTxHash = await neroChainService.mintPLTTokens(currentUserAA, REFEREE_REWARD_PLT);
    }
    if (REFERRER_REWARD_PLT > 0) {
        referrerTxHash = await neroChainService.mintPLTTokens(referrerAA, REFERRER_REWARD_PLT);
    }

    await databaseService.recordSuccessfulReferral(currentUserAA, referrerAA, REFEREE_REWARD_PLT, REFERRER_REWARD_PLT, refereeTxHash, referrerTxHash);

    return res.status(200).json({
      success: true,
      message: "Referral recorded successfully! Rewards have been sent.",
      data: {
        currentUserAAReward: REFEREE_REWARD_PLT,
        referrerAAReward: REFERRER_REWARD_PLT,
        refereeTxHash: refereeTxHash,
        referrerTxHash: referrerTxHash,
      }
    });

  } catch (error) {
    console.error("Error in handleReferral:", error);
    let errorMessage = "Failed to process referral due to a server error.";
    if (error.message && (error.message.includes("PacaLuckToken contract not initialized") || error.message.includes("MINTER_PRIVATE_KEY is not set"))) {
        errorMessage = "Referral processing error: Minting service is currently unavailable. Please contact support.";
    } else if (error.code === 'CALL_EXCEPTION' || error.transactionHash) {
        errorMessage = "Referral processing error: A blockchain transaction failed during reward distribution.";
    }
    await databaseService.recordFailedReferralAttempt(currentUserAA, referrerAA, error.message || "Unknown server error");
    return res.status(500).json({ success: false, message: errorMessage });
  }
};

module.exports = {
  handleReferral,
};