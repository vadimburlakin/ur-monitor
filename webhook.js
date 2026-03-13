const axios = require('axios');

async function callWebhook(url, payload) {
  try {
    await axios.post(url, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    });
    console.log(`Webhook called: ${url}`);
  } catch (err) {
    console.error(`Webhook failed: ${err.message}`);
  }
}

module.exports = { callWebhook };
