const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const initializeDatabase = async () => {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS referrals (
                id SERIAL PRIMARY KEY,
                referee_address VARCHAR(42) NOT NULL,
                referrer_address VARCHAR(42) NOT NULL,
                status VARCHAR(20) NOT NULL,
                reason TEXT,
                referee_reward NUMERIC(18, 2),
                referrer_reward NUMERIC(18, 2),
                referee_tx_hash VARCHAR(66),
                referrer_tx_hash VARCHAR(66),
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("Database initialized: 'referrals' table checked/created.");
    } catch (err) {
        console.error('Error initializing database:', err);
        throw err;
    } finally {
        client.release();
    }
};

async function findReferralByCurrentUserAA(currentUserAA) {
  const query = 'SELECT 1 FROM referrals WHERE referee_address = $1 LIMIT 1';
  try {
    const res = await pool.query(query, [currentUserAA.toLowerCase()]);
    return res.rowCount > 0;
  } catch (err) {
    console.error('Database query error in findReferralByCurrentUserAA:', err);
    throw err;
  }
}

async function recordSuccessfulReferral(currentUserAA, referrerAA, refereeReward, referrerReward, refereeTxHash, referrerTxHash) {
  const query = `
    INSERT INTO referrals 
    (referee_address, referrer_address, status, referee_reward, referrer_reward, referee_tx_hash, referrer_tx_hash) 
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *;
  `;
  const values = [
    currentUserAA.toLowerCase(),
    referrerAA.toLowerCase(),
    'processed',
    refereeReward,
    referrerReward,
    refereeTxHash,
    referrerTxHash
  ];
  try {
    const res = await pool.query(query, values);
    console.log(`DB Record: Successful referral - User: ${currentUserAA}, Referrer: ${referrerAA}`);
    return res.rows[0];
  } catch (err) {
    console.error('Database query error in recordSuccessfulReferral:', err);
    throw err;
  }
}

async function recordFailedReferralAttempt(currentUserAA, referrerAA, failureReason) {
    const query = `
        INSERT INTO referrals
        (referee_address, referrer_address, status, reason)
        VALUES ($1, $2, $3, $4)
        RETURNING *;
    `;
    const values = [
        currentUserAA.toLowerCase(),
        referrerAA.toLowerCase(),
        'failed',
        failureReason
    ];
    try {
        const res = await pool.query(query, values);
        console.log(`DB Record: Failed referral attempt - User: ${currentUserAA}, Referrer: ${referrerAA}, Reason: ${failureReason}`);
        return res.rows[0];
    } catch (err) {
        console.error('Database query error in recordFailedReferralAttempt:', err);
        throw err;
    }
}

async function getTopReferrers() {
  const query = `
    SELECT
        referrer_address,
        COUNT(*) as referral_count
    FROM
        referrals
    WHERE
        status = 'processed'
    GROUP BY
        referrer_address
    ORDER BY
        referral_count DESC
    LIMIT 10;
  `;
  try {
    const res = await pool.query(query);
    return res.rows;
  } catch (err) {
    console.error('Database query error in getTopReferrers:', err);
    throw err;
  }
}

module.exports = {
  initializeDatabase,
  findReferralByCurrentUserAA,
  recordSuccessfulReferral,
  recordFailedReferralAttempt,
  getTopReferrers
};