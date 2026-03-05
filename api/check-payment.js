import { kv } from '@vercel/kv';

export const config = { maxDuration: 10 };

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { sessionId } = req.query;
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

  try {
    const record = await kv.get(`paid:${sessionId}`);
    res.json({ paid: !!record, tier: record?.tier || null });
  } catch (err) {
    console.error('check-payment error:', err);
    res.status(500).json({ error: err.message });
  }
}
