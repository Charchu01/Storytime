import { logBook, logEvent } from './lib/admin-logger.js';
import { supabaseAdmin } from './lib/supabase-admin.js';

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

    // Update the existing Supabase book record with health_status
    if (bookData.supabaseBookId && supabaseAdmin) {
      await supabaseAdmin.from('books')
        .update({ health_status: bookData.status || 'healthy' })
        .eq('id', bookData.supabaseBookId);
    }

    const bookId = bookData.supabaseBookId || bookData.bookId || `book_${Date.now()}`;

    // Log event to activity_log
    await logEvent('book_completed', {
      bookId,
      title: bookData.title || 'Untitled',
      tier: bookData.tier || 'standard',
      style: bookData.style || 'unknown',
      status: bookData.status || 'healthy',
    });

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
