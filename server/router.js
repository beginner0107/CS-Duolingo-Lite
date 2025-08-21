const express = require('express');
const router = express.Router();
const { all, get, run } = require('./database');
const path = require('path');
const { pathToFileURL } = require('url');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Helpers to (de)serialize arrays
function toJson(value) {
  if (value == null) return null;
  try { return JSON.stringify(value); } catch (_) { return null; }
}
function fromJson(value) {
  if (!value) return [];
  try { return JSON.parse(value); } catch (_) { return []; }
}

// List questions
router.get('/questions', async (req, res) => {
  try {
    const rows = await all('SELECT * FROM questions ORDER BY id DESC');
    const items = rows.map(r => ({
      ...r,
      keywords: fromJson(r.keywords),
      synonyms: fromJson(r.synonyms)
    }));
    res.json(items);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get by id
router.get('/questions/:id', async (req, res) => {
  try {
    const row = await get('SELECT * FROM questions WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    row.keywords = fromJson(row.keywords);
    row.synonyms = fromJson(row.synonyms);
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Create
router.post('/questions', async (req, res) => {
  try {
    const q = req.body || {};
    const result = await run(
      `INSERT INTO questions (deck, type, prompt, answer, keywords, keywordThreshold, synonyms, explain)
       VALUES (?,?,?,?,?,?,?,?)`,
      [q.deck ?? null, q.type, q.prompt, q.answer ?? null, toJson(q.keywords) , q.keywordThreshold ?? null, toJson(q.synonyms), q.explain ?? null]
    );
    const row = await get('SELECT * FROM questions WHERE id = ?', [result.id]);
    row.keywords = fromJson(row.keywords);
    row.synonyms = fromJson(row.synonyms);
    res.status(201).json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update
router.put('/questions/:id', async (req, res) => {
  try {
    const q = req.body || {};
    await run(
      `UPDATE questions SET deck=?, type=?, prompt=?, answer=?, keywords=?, keywordThreshold=?, synonyms=?, explain=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [q.deck ?? null, q.type, q.prompt, q.answer ?? null, toJson(q.keywords), q.keywordThreshold ?? null, toJson(q.synonyms), q.explain ?? null, req.params.id]
    );
    const row = await get('SELECT * FROM questions WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    row.keywords = fromJson(row.keywords);
    row.synonyms = fromJson(row.synonyms);
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Delete
router.delete('/questions/:id', async (req, res) => {
  try {
    const result = await run('DELETE FROM questions WHERE id = ?', [req.params.id]);
    if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

// ========== AI Grading: Essay (OpenAI) ==========
async function loadPrompts() {
  const url = pathToFileURL(path.join(__dirname, '..', 'ai', 'prompts.js')).href;
  return await import(url);
}

// Unified essay grading endpoint supporting openai | anthropic | gemini
router.post('/grade/essay', async (req, res) => {
  try {
    const { question, reference, student, model, provider } = req.body || {};
    const { USER_TEMPLATE } = await loadPrompts();
    const userContent = USER_TEMPLATE({ question, reference, keywords: [], student });
    const systemPrompt = 'You are a KR/EN essay grader. Return ONLY strict JSON: {"score":0..100,"feedback":"..."}. Be concise, judge content quality, relevance, correctness. No extra text.';

    const prov = (provider || process.env.AI_PROVIDER || 'openai').toLowerCase();
    const { url, headers, body } = buildProviderRequest({ provider: prov, model, systemPrompt, userContent, req });

    if (!url) return res.status(400).json({ error: 'Unsupported provider', provider: prov });

    const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      return res.status(resp.status).json({ error: `${prov} HTTP ${resp.status}`, details: text });
    }
    const data = await resp.json();
    const content = extractProviderContent(prov, data);
    let parsed;
    try { parsed = JSON.parse(content); } catch (_) {
      const m = content && content.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch (__) {} }
    }
    if (!parsed || typeof parsed.score !== 'number') {
      return res.status(502).json({ error: 'Model did not return expected JSON', raw: content });
    }
    const score = Math.max(0, Math.min(100, Math.round(parsed.score)));
    const feedback = String(parsed.feedback || parsed.rationale || '');
    res.json({ score, feedback });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

function getApiKeyForProvider(provider, req) {
  switch (provider) {
    case 'openai': return process.env.OPENAI_API_KEY || req.headers['x-openai-key'] || req.headers['x-api-key'];
    case 'anthropic': return process.env.ANTHROPIC_API_KEY || req.headers['x-anthropic-key'] || req.headers['x-api-key'];
    case 'gemini': return process.env.GEMINI_API_KEY || req.headers['x-gemini-key'] || req.headers['x-api-key'];
    default: return undefined;
  }
}

function buildProviderRequest({ provider, model, systemPrompt, userContent, req }) {
  if (provider === 'openai') {
    const apiKey = getApiKeyForProvider('openai', req);
    if (!apiKey) return {};
    const usedModel = model || process.env.OPENAI_MODEL || 'gpt-4o-mini';
    return {
      url: 'https://api.openai.com/v1/chat/completions',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: {
        model: usedModel,
        temperature: 0.2,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ]
      }
    };
  }

  if (provider === 'anthropic') {
    const apiKey = getApiKeyForProvider('anthropic', req);
    if (!apiKey) return {};
    const usedModel = model || process.env.ANTHROPIC_MODEL || 'claude-3-haiku-20240307';
    return {
      url: 'https://api.anthropic.com/v1/messages',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'anthropic-version': '2023-06-01'
      },
      body: {
        model: usedModel,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
        temperature: 0.2,
        max_tokens: 300
      }
    };
  }

  if (provider === 'gemini') {
    const apiKey = getApiKeyForProvider('gemini', req);
    if (!apiKey) return {};
    const usedModel = model || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${usedModel}:generateContent?key=${encodeURIComponent(apiKey)}`,
      headers: {
        'Content-Type': 'application/json'
      },
      body: {
        contents: [{ parts: [{ text: `${systemPrompt}\n\n${userContent}` }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 300, responseMimeType: 'application/json' }
      }
    };
  }
  return {};
}

function extractProviderContent(provider, data) {
  switch (provider) {
    case 'openai':
      return data?.choices?.[0]?.message?.content || '';
    case 'anthropic':
      return data?.content?.[0]?.text || '';
    case 'gemini':
      return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    default:
      return '';
  }
}
