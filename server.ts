import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALLOWED_VOICES = new Set(['Kore', 'Charon', 'Puck', 'Fenrir', 'Zephyr']);
const MAX_CACHE_ITEMS = 64;
const ttsCache = new Map<string, string>();

let cachedClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  if (!cachedClient) {
    cachedClient = new GoogleGenAI({
      apiKey,
      apiVersion: 'v1beta',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return cachedClient;
}

function extractErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : 'Failed to synthesize voice narration.';
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.error?.message === 'string') {
      return parsed.error.message;
    }
  } catch {
    // Plain error string
  }
  return raw;
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '64kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, geminiConfigured: Boolean(getGeminiClient()) });
  });

  app.post('/api/tts', async (req, res) => {
    const rawText = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    const requestedVoice = typeof req.body?.voiceName === 'string' ? req.body.voiceName : 'Charon';
    const voiceName = ALLOWED_VOICES.has(requestedVoice) ? requestedVoice : 'Charon';

    if (!rawText) {
      res.status(400).json({ error: 'Narration text is required.' });
      return;
    }
    if (rawText.length > 800) {
      res.status(400).json({ error: 'Narration text exceeds maximum length.' });
      return;
    }

    const cacheKey = `${voiceName}::${rawText}`;
    const cached = ttsCache.get(cacheKey);
    if (cached) {
      res.json({
        audioBase64: cached,
        mimeType: 'audio/wav',
        voiceName,
        cached: true,
      });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'GEMINI_API_KEY is not configured. Add it in Settings > Secrets to enable Google AI voices.',
      });
      return;
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: rawText,
                speechMetadata: {
                  style: 'Warm, articulate architectural documentary narrator, calm and authoritative',
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        res.status(502).json({ error: 'Gemini TTS returned an empty audio response.' });
        return;
      }

      if (ttsCache.size >= MAX_CACHE_ITEMS) {
        const oldestKey = ttsCache.keys().next().value;
        if (oldestKey) ttsCache.delete(oldestKey);
      }
      ttsCache.set(cacheKey, base64Audio);

      res.json({
        audioBase64: base64Audio,
        mimeType: 'audio/wav',
        voiceName,
        cached: false,
      });
    } catch (err) {
      res.status(502).json({ error: extractErrorMessage(err) });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`La Sagrada Familia server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
