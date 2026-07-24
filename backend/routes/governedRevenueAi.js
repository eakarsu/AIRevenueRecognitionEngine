'use strict';

const router = require('express').Router();

router.post('/policy-brief', async (req, res) => {
  try {
    const baseUrl = String(process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL,
        messages: [
          { role: 'system', content: 'You are an ASC 606 and IFRS 15 revenue policy assistant. Give advisory, auditable summaries and never authorize postings.' },
          { role: 'user', content: String(req.body?.prompt || 'Summarize one revenue-recognition control that reduces premature recognition risk.') },
        ],
        max_tokens: 350,
      }),
    });
    if (!response.ok) return res.status(502).json({ error: `OpenRouter returned HTTP ${response.status}` });
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return res.status(502).json({ error: 'OpenRouter returned an empty response' });
    return res.json({ content, model: process.env.OPENROUTER_MODEL });
  } catch (error) {
    return res.status(502).json({ error: error.message });
  }
});

module.exports = router;
