import { Router } from 'express';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { updateStore, getStore } from '../services/storage.js';
import { requireUser } from '../middleware/auth.js';

const router = Router();

const GNANI_BASE = 'https://api.vachana.ai';
const VOICE_DIR = resolve('backend/src/data/voice');

function getApiKey() {
  return process.env.GNANI_API_KEY || '';
}

// ── Status — does the server have a Gnani key configured? ──────────
router.get('/status', (_req, res) => {
  const configured = !!getApiKey();
  res.json({ configured, message: configured ? 'Gnani AI is configured' : 'Set GNANI_API_KEY in .env to enable AI features' });
});

// ── Speech-to-Text (Prisma) ────────────────────────────────────────
router.post('/transcribe/:audioId', requireUser, async (req, res, next) => {
  try {
    const apiKey = getApiKey();
    if (!apiKey) return res.status(503).json({ error: 'Gnani API key not configured. Set GNANI_API_KEY in your .env file.' });

    const language = req.body.language || 'en-IN';
    const model = req.body.model || 'prisma-v2.5';
    const store = await getStore();
    const msg = store.messages.find(m => m.type === 'voice' && m.audioId === req.params.audioId);
    if (!msg) return res.status(404).json({ error: 'Voice message not found' });

    // Read the audio file from disk
    const filepath = resolve(VOICE_DIR, msg.filename);
    let audioBuffer;
    try { audioBuffer = await readFile(filepath); } catch { return res.status(404).json({ error: 'Audio file not found on disk' }); }

    // Determine a filename for the multipart upload
    const uploadFilename = msg.filename || `audio${msg.mimeType === 'audio/webm' ? '.webm' : '.wav'}`;

    // Build multipart/form-data manually using the native fetch (Node 18+)
    const formData = new FormData();
    formData.append('audio_file', new Blob([audioBuffer], { type: msg.mimeType || 'audio/webm' }), uploadFilename);
    formData.append('model', model);
    formData.append('language_code', language);

    const response = await fetch(`${GNANI_BASE}/stt/v3`, {
      method: 'POST',
      headers: { 'X-API-Key-ID': apiKey },
      body: formData,
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      return res.status(response.status).json({
        error: `Gnani STT failed (${response.status})`,
        detail: errBody,
      });
    }

    const result = await response.json();
    const transcript = result.transcript || result.text || result.result || JSON.stringify(result);

    // Save transcription to the voice message
    await updateStore(s => {
      const m = s.messages.find(x => x.audioId === req.params.audioId);
      if (m) m.transcription = transcript;
    });

    res.json({ transcript, raw: result });
  } catch (e) { next(e); }
});

// ── Text-to-Speech (Timbre) ────────────────────────────────────────
router.post('/speak', requireUser, async (req, res, next) => {
  try {
    const apiKey = getApiKey();
    if (!apiKey) return res.status(503).json({ error: 'Gnani API key not configured. Set GNANI_API_KEY in your .env file.' });

    const { text, voice, language, speed } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Text is required' });

    const response = await fetch(`${GNANI_BASE}/api/v1/tts/inference`, {
      method: 'POST',
      headers: {
        'X-API-Key-ID': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text.trim().slice(0, 2000),
        voice: voice || 'Nalini',
        model: 'timbre-v2.5',
        language: language || 'hi-IN',
        speed: speed || 1.0,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      return res.status(response.status).json({
        error: `Gnani TTS failed (${response.status})`,
        detail: errBody,
      });
    }

    // Timbre returns audio binary — pipe it back
    const contentType = response.headers.get('content-type') || 'audio/wav';
    res.setHeader('Content-Type', contentType);
    const arrayBuf = await response.arrayBuffer();
    res.send(Buffer.from(arrayBuf));
  } catch (e) { next(e); }
});

export default router;
