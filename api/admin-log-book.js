import { logBook, logUser } from './lib/admin-logger.js';

export const config = { maxDuration: 15 };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const bookData = req.body || {};
    const bookId = await logBook(bookData);

    // Log user data
    if (bookData.userId || bookData.userEmail) {
      await logUser({
        userId: bookData.userId || `anon_${Date.now().toString(36)}`,
        email: bookData.userEmail,
        bookCreated: true,
        amountPaid: bookData.tier === 'premium' ? 19.99 : 9.99,
      }).catch(() => {});
    }

    // Trigger post-game analysis asynchronously (fire and forget)
    if (bookData.images && Object.keys(bookData.images).length > 0) {
      fetch(`${req.headers.origin || 'https://storytime.cards'}/api/post-game-analysis`, {
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
      }).catch(() => {});
    }

    return res.json({ success: true, bookId });
  } catch (err) {
    console.error('Admin log book error:', err);
    return res.status(500).json({ error: err.message });
  }
}
