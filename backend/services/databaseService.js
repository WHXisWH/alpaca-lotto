let mockReferralDB = [];

async function findReferralByCurrentUserAA(currentUserAA) {
  console.log(`DB Check: Has ${currentUserAA} already been referred or made a referral?`);
  const found = mockReferralDB.find(
    entry => entry.currentUserAA.toLowerCase() === currentUserAA.toLowerCase() ||
             entry.referrerAA.toLowerCase() === currentUserAA.toLowerCase()
  );
  return !!found;
}

async function recordSuccessfulReferral(currentUserAA, referrerAA, refereeReward, referrerReward, refereeTxHash, referrerTxHash) {
  console.log(`DB Record: Successful referral - User: ${currentUserAA}, Referrer: ${referrerAA}`);
  const newEntry = {
    currentUserAA,
    referrerAA,
    refereeReward,
    referrerReward,
    refereeTxHash,
    referrerTxHash,
    status: 'processed',
    timestamp: new Date().toISOString()
  };
  mockReferralDB.push(newEntry);
  console.log('Current Mock DB:', mockReferralDB);
  return newEntry;
}

async function recordFailedReferralAttempt(currentUserAA, referrerAA, failureReason) {
    console.log(`DB Record: Failed referral attempt - User: ${currentUserAA}, Referrer: ${referrerAA}, Reason: ${failureReason}`);
    const newEntry = {
        currentUserAA,
        referrerAA,
        status: 'failed',
        reason: failureReason,
        timestamp: new Date().toISOString()
    };
    mockReferralDB.push(newEntry);
    console.log('Current Mock DB:', mockReferralDB);
    return newEntry;
}

module.exports = {
  findReferralByCurrentUserAA,
  recordSuccessfulReferral,
  recordFailedReferralAttempt
};