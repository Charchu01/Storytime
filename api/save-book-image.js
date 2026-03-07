import { saveImageToStorage } from './lib/save-image.js';
import { rateLimit } from './lib/rate-limiter.js';

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const rl = rateLimit(req, { key: 'save-book-image', limit: 30, windowMs: 60000 });
  if (!rl.allowed) {
    res.setHeader('Retry-After', Math.ceil((rl.resetAt - Date.now()) / 1000));
    return res.status(429).json({ error: 'Too many requests.' });
  }

  const { imageUrl, bookId, pageType, pageIndex } = req.body;
  if (!imageUrl || !bookId) return res.status(400).json({ error: 'imageUrl and bookId required' });
  if (!pageType) return res.status(400).json({ error: 'pageType is required' });

  try {
    const filename = `${pageType}_${pageIndex || 0}.jpg`;
    const permanentUrl = await saveImageToStorage(imageUrl, bookId, filename);

    if (!permanentUrl) {
      return res.status(500).json({ error: 'Failed to save image to storage' });
    }

    return res.json({ permanentUrl });
  } catch (err) {
    console.error('save-book-image error:', err.message);
    return res.status(500).json({ error: 'Image save failed' });
  }
}
