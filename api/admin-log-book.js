import { logBook, logUser } from './lib/admin-logger.js';

export const config = { maxDuration: 15 };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const bookData = req.body || {};

    if (!bookData || Object.keys(bookData).length === 0) {
      return res.status(400).json({ error: 'Empty book data' });
    }

    const bookId = await logBook(bookData);

    if (!bookId) {
      console.error('logBook returned null — KV write likely failed. Check KV_REST_API_URL and KV_REST_API_TOKEN env vars.');
      return res.status(500).json({ error: 'Failed to log book to KV. Check Vercel KV configuration.' });
    }

    // Log user data — always log even anonymous users so Users tab works
    await logUser({
      userId: bookData.userId || `anon_${Date.now().toString(36)}`,
      email: bookData.userEmail || null,
      bookCreated: true,
      amountPaid: bookData.tier === 'premium' ? 19.99 : 9.99,
    }).catch((err) => console.warn('User log failed:', err.message));

    // Trigger post-game analysis asynchronously (fire and forget)
    if (bookId && bookData.images && Object.keys(bookData.images).length > 0) {
      const origin = req.headers.origin
        || (req.headers['x-forwarded-host'] ? `https://${req.headers['x-forwarded-host']}` : null)
        || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://storytime-eight.vercel.app');
      fetch(`${origin}/api/post-game-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId,
          images: bookData.images,
          storyTexts: bookData.storyTexts,
          artStyle: bookData.style,
          heroName: bookData.heroName,
          title: bookData.title,
        }),
      }).catch((err) => console.warn('Post-game analysis trigger failed:', err.message));
    }

    return res.json({ success: true, bookId });
  } catch (err) {
    console.error('Admin log book error:', err);
    return res.status(500).json({ error: err.message });
  }
}
