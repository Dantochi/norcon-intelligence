function readBody(req) {
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body || {};
}

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })
  }

  try {
    const body = readBody(req);
    const messages = Array.isArray(body.messages) ? body.messages.slice(0, 12) : null;
    if (!messages || messages.length === 0) {
      return res.status(400).json({ error: 'messages array required' });
    }

    const payloadSize = JSON.stringify(messages).length;
    if (payloadSize > 120000) {
      return res.status(413).json({ error: 'Request too large. Try a shorter document or fewer files.' });
    }

    const maxTokens = Math.min(Math.max(parseInt(body.max_tokens, 10) || 2000, 1), 12000);
    const payload = {
      ...body,
      model: typeof body.model === 'string' ? body.model : 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      messages,
    };

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    if (!response.ok) {
      return res.status(response.status).json(data)
    }

    return res.status(200).json(data)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
