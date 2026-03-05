import { kv } from '@vercel/kv';

export const config = { maxDuration: 10 };

export default async function handler(req, res) {
  // Use a simple device-based key (or Clerk userId if available via header)
  const userId = req.headers['x-user-id'] || req.query.userId || 'anonymous';
  const key = `vault:${userId}`;

  try {
    if (req.method === 'GET') {
      const characters = await kv.get(key) || [];
      return res.json({ characters });
    }

    if (req.method === 'POST') {
      const { name, loraUrl, triggerWord, thumbnailUrl } = req.body;
      if (!name || !loraUrl || !triggerWord) {
        return res.status(400).json({ error: 'name, loraUrl, and triggerWord required' });
      }

      const characters = await kv.get(key) || [];
      const newChar = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2),
        name,
        loraUrl,
        triggerWord,
        thumbnailUrl: thumbnailUrl || null,
        createdAt: new Date().toISOString(),
      };
      characters.push(newChar);
      await kv.set(key, characters);

      return res.json({ character: newChar });
    }

    if (req.method === 'DELETE') {
      const { characterId } = req.body || req.query;
      if (!characterId) return res.status(400).json({ error: 'characterId required' });

      const characters = await kv.get(key) || [];
      const filtered = characters.filter((c) => c.id !== characterId);
      await kv.set(key, filtered);

      return res.json({ deleted: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('vault error:', err);
    res.status(500).json({ error: err.message });
  }
}
