import { Router } from 'express';
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { createId } from '../utils/ids.js';
import { getStore, updateStore } from '../services/storage.js';
import { requireUser } from '../middleware/auth.js';

const router = Router();

// Directory where audio files are persisted
const VOICE_DIR = resolve('backend/src/data/voice');

// Allowed MIME types  →  file extension
const MIME_MAP = {
  'audio/webm': '.webm',
  'audio/ogg': '.ogg',
  'audio/mp4': '.mp4',
  'audio/wav': '.wav',
  'audio/mpeg': '.mp3',
  'audio/aac': '.aac',
};

const MAX_SIZE = 2 * 1024 * 1024; // 2 MB
const MAX_DURATION = 35; // seconds (small buffer above 30s client limit)

// ── Upload voice clip ──────────────────────────────────────────────
router.post('/upload', requireUser, async (req, res, next) => {
  try {
    const groupCode = (req.headers['x-groundlink-group'] || '').trim().toUpperCase();
    const duration = parseFloat(req.headers['x-groundlink-duration'] || '0');
    const mime = (req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();

    if (!groupCode) return res.status(400).json({ error: 'Group code is required' });
    if (!MIME_MAP[mime]) return res.status(400).json({ error: `Unsupported audio type: ${mime}` });
    if (duration > MAX_DURATION) return res.status(400).json({ error: 'Recording too long' });

    // Verify group exists
    const store = await getStore();
    const group = store.groups.find(g => g.code === groupCode);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    // Collect body (raw binary)
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > MAX_SIZE) return res.status(413).json({ error: 'File too large (max 2 MB)' });
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    if (buffer.length < 100) return res.status(400).json({ error: 'Audio file is empty or too small' });

    // Save file
    const audioId = createId(12);
    const ext = MIME_MAP[mime];
    const filename = `${audioId}${ext}`;
    await mkdir(VOICE_DIR, { recursive: true });
    await writeFile(resolve(VOICE_DIR, filename), buffer);

    // Build voice message record
    const message = {
      id: createId(10),
      type: 'voice',
      groupCode,
      sender: req.glUser,
      audioId,
      filename,
      duration: Math.round(duration * 10) / 10,
      mimeType: mime,
      size: buffer.length,
      transcription: null,
      createdAt: new Date().toISOString(),
    };
    await updateStore(s => s.messages.push(message));

    res.status(201).json(message);
  } catch (e) { next(e); }
});

// ── Stream / download audio file ───────────────────────────────────
router.get('/:audioId', async (req, res, next) => {
  try {
    const store = await getStore();
    const msg = store.messages.find(
      m => m.type === 'voice' && m.audioId === req.params.audioId
    );
    if (!msg) return res.status(404).json({ error: 'Audio not found' });

    const filepath = resolve(VOICE_DIR, msg.filename);
    // Verify file actually exists
    try { await stat(filepath); } catch { return res.status(404).json({ error: 'Audio file missing' }); }

    res.setHeader('Content-Type', msg.mimeType || 'audio/webm');
    res.setHeader('Content-Length', msg.size);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    // Use express static-style sendFile for range support
    res.sendFile(filepath);
  } catch (e) { next(e); }
});

export default router;
