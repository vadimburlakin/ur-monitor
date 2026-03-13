const { Pool } = require('pg');

let pool;

async function initDb() {
  pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'urmonitor',
    user: process.env.DB_USER || 'urmonitor',
    password: process.env.DB_PASSWORD || 'urmonitor',
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(16) PRIMARY KEY,
      webhook_url TEXT,
      polling_interval INTEGER DEFAULT 5,
      last_poll_at TIMESTAMPTZ,
      last_result TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS watched_properties (
      user_id VARCHAR(16) REFERENCES users(id) ON DELETE CASCADE,
      property_id VARCHAR(64),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (user_id, property_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS property_state (
      user_id VARCHAR(16) REFERENCES users(id) ON DELETE CASCADE,
      property_id VARCHAR(64),
      room_count INTEGER DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (user_id, property_id)
    )
  `);

  console.log('Database initialized');
}

function getDb() {
  return pool;
}

module.exports = { initDb, getDb };
