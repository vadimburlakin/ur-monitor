const express = require('express');
const path = require('path');
const { initDb, getDb } = require('./db');
const { fetchCurrentProperties } = require('./monitor');
const { callWebhook } = require('./webhook');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;

// --- API Routes ---

app.post('/api/login', async (req, res) => {
  const { userId } = req.body;
  if (!userId || typeof userId !== 'string' || userId.length > 16 || userId.trim().length === 0) {
    return res.status(400).json({ error: 'User ID must be 1-16 characters' });
  }
  const id = userId.trim();
  const db = getDb();
  await db.query(
    `INSERT INTO users (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`,
    [id]
  );
  const result = await db.query('SELECT * FROM users WHERE id = $1', [id]);
  res.json(result.rows[0]);
});

app.get('/api/user/:id', async (req, res) => {
  const db = getDb();
  const result = await db.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
  res.json(result.rows[0]);
});

app.put('/api/user/:id/settings', async (req, res) => {
  const { webhookUrl, pollingInterval } = req.body;
  const validIntervals = [1, 5, 15];
  if (pollingInterval !== undefined && !validIntervals.includes(pollingInterval)) {
    return res.status(400).json({ error: 'Polling interval must be 1, 5, or 15 minutes' });
  }
  const db = getDb();
  const result = await db.query(
    `UPDATE users SET
      webhook_url = COALESCE($1, webhook_url),
      polling_interval = COALESCE($2, polling_interval)
    WHERE id = $3 RETURNING *`,
    [webhookUrl !== undefined ? webhookUrl : null, pollingInterval || null, req.params.id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
  res.json(result.rows[0]);
});

app.get('/api/user/:id/properties', async (req, res) => {
  const db = getDb();
  const result = await db.query(
    'SELECT property_id FROM watched_properties WHERE user_id = $1 ORDER BY created_at',
    [req.params.id]
  );
  res.json(result.rows.map(r => r.property_id));
});

app.post('/api/user/:id/properties', async (req, res) => {
  const { propertyId } = req.body;
  if (!propertyId || typeof propertyId !== 'string') {
    return res.status(400).json({ error: 'Property ID is required' });
  }
  const db = getDb();
  await db.query(
    `INSERT INTO watched_properties (user_id, property_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [req.params.id, propertyId.trim()]
  );
  res.json({ ok: true });
});

app.delete('/api/user/:id/properties/:propertyId', async (req, res) => {
  const db = getDb();
  await db.query(
    'DELETE FROM watched_properties WHERE user_id = $1 AND property_id = $2',
    [req.params.id, req.params.propertyId]
  );
  await db.query(
    'DELETE FROM property_state WHERE user_id = $1 AND property_id = $2',
    [req.params.id, req.params.propertyId]
  );
  res.json({ ok: true });
});

app.post('/api/user/:id/poll', async (req, res) => {
  try {
    const result = await pollForUser(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/user/:id/status', async (req, res) => {
  const db = getDb();
  const user = await db.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
  if (user.rows.length === 0) return res.status(404).json({ error: 'User not found' });
  const u = user.rows[0];
  const nextPoll = u.last_poll_at
    ? new Date(new Date(u.last_poll_at).getTime() + u.polling_interval * 60000)
    : null;
  res.json({
    lastPollAt: u.last_poll_at,
    pollingInterval: u.polling_interval,
    nextPollAt: nextPoll,
    lastResult: u.last_result,
  });
});

// List all available UR properties (for browsing)
app.get('/api/properties', async (_req, res) => {
  try {
    const properties = await fetchCurrentProperties();
    res.json(properties);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Polling Logic ---

async function pollForUser(userId) {
  const db = getDb();
  const userResult = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
  if (userResult.rows.length === 0) throw new Error('User not found');
  const user = userResult.rows[0];

  const watchedResult = await db.query(
    'SELECT property_id FROM watched_properties WHERE user_id = $1',
    [userId]
  );
  const watchedIds = watchedResult.rows.map(r => r.property_id);

  if (watchedIds.length === 0) {
    await db.query(
      `UPDATE users SET last_poll_at = NOW(), last_result = $1 WHERE id = $2`,
      ['No properties watched', userId]
    );
    return { newRooms: 0, message: 'No properties watched' };
  }

  const allProperties = await fetchCurrentProperties();
  let totalNewRooms = 0;
  const changes = [];

  for (const propId of watchedIds) {
    const current = allProperties.find(p => String(p.id) === String(propId));
    if (!current) continue;

    const prevResult = await db.query(
      'SELECT room_count FROM property_state WHERE user_id = $1 AND property_id = $2',
      [userId, propId]
    );
    const prevRoomCount = prevResult.rows.length > 0 ? prevResult.rows[0].room_count : 0;
    const diff = current.roomCount - prevRoomCount;

    if (diff > 0) {
      totalNewRooms += diff;
      changes.push({ propertyId: propId, previous: prevRoomCount, current: current.roomCount, diff });
    }

    await db.query(
      `INSERT INTO property_state (user_id, property_id, room_count, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, property_id) DO UPDATE SET room_count = $3, updated_at = NOW()`,
      [userId, propId, current.roomCount]
    );
  }

  const resultMsg = totalNewRooms > 0
    ? `Found ${totalNewRooms} new rooms in ${changes.length} properties`
    : 'No new rooms found';

  await db.query(
    `UPDATE users SET last_poll_at = NOW(), last_result = $1 WHERE id = $2`,
    [resultMsg, userId]
  );

  if (totalNewRooms > 0 && user.webhook_url) {
    await callWebhook(user.webhook_url, {
      userId,
      totalNewRooms,
      changes,
      timestamp: new Date().toISOString(),
    });
  }

  return { newRooms: totalNewRooms, message: resultMsg, changes };
}

async function backgroundPoller() {
  const db = getDb();
  try {
    const users = await db.query(
      `SELECT id FROM users
       WHERE last_poll_at IS NULL
       OR last_poll_at + (polling_interval || ' minutes')::interval <= NOW()`
    );
    for (const user of users.rows) {
      try {
        console.log(`Background poll for user: ${user.id}`);
        await pollForUser(user.id);
      } catch (err) {
        console.error(`Poll error for ${user.id}: ${err.message}`);
      }
    }
  } catch (err) {
    console.error('Background poller error:', err.message);
  }
}

// --- Start ---

async function start() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`UR Monitor running on port ${PORT}`);
  });
  setInterval(backgroundPoller, 30000);
}

start().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
