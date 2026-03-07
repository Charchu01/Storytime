import { logBook, logEvent, relinkBookId } from './lib/admin-logger.js';
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

    // Relink admin records (validations, api_calls) from temp bookId to real UUID
    // MUST await — if this fails, the book detail stats will all show 0
    if (bookData.supabaseBookId && bookData.tempBookId && bookData.supabaseBookId !== bookData.tempBookId) {
      for (let retryAttempt = 0; retryAttempt < 3; retryAttempt++) {
        try {
          const relinked = await relinkBookId(bookData.tempBookId, bookData.supabaseBookId);
          if (relinked) break;
          console.warn(`relinkBookId attempt ${retryAttempt + 1} returned false`);
        } catch (err) {
          console.error(`relinkBookId attempt ${retryAttempt + 1} failed:`, err.message);
        }
        if (retryAttempt < 2) await new Promise(r => setTimeout(r, 1000));
      }
    }

    // Log event to activity_log
    await logEvent('book_completed', {
      bookId,
      title: bookData.title || 'Untitled',
      tier: bookData.tier || 'standard',
      style: bookData.style || 'unknown',
      status: bookData.status || 'healthy',
    });

    // Trigger post-game analysis — await to prevent Vercel from killing the request
    if (bookId && bookData.images && Object.keys(bookData.images).length > 0) {
      // Build origin for internal API call — only trust known sources to prevent SSRF
      const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://storytime-eight.vercel.app';
      const rawOrigin = req.headers.origin || vercelUrl;
      const origin = /^https:\/\/[\w-]+\.vercel\.app$/.test(rawOrigin) || /^https?:\/\/localhost(:\d+)?$/.test(rawOrigin)
        ? rawOrigin : vercelUrl;
      try {
        await fetch(`${origin}/api/post-game-analysis`, {
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
        });
      } catch (err) {
        console.warn('Post-game analysis trigger failed:', err.message);
      }
    }

    return res.json({ success: true, bookId });
  } catch (err) {
    console.error('Admin log book error:', err);
    return res.status(500).json({ error: 'Failed to log book. Please try again.' });
  }
}
