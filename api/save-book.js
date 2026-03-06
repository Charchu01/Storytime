import { supabaseAdmin } from './lib/supabase-admin.js';

export const config = { maxDuration: 15 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { book, pages, userId, clerkId } = req.body;

  if (!book) return res.status(400).json({ error: 'book data required' });
  if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase not configured' });

  try {
    // Find or create user
    let dbUserId = null;
    if (clerkId) {
      const { data: existingUser } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('clerk_id', clerkId)
        .single();

      if (existingUser) {
        dbUserId = existingUser.id;
      } else {
        const { data: newUser } = await supabaseAdmin
          .from('users')
          .insert({ clerk_id: clerkId })
          .select('id')
          .single();
        dbUserId = newUser?.id;
      }
    }

    // Insert book
    const { data: savedBook, error: bookError } = await supabaseAdmin
      .from('books')
      .insert({
        ...book,
        user_id: dbUserId,
        status: 'completed',
        health_status: book.health_status || 'healthy',
      })
      .select('id')
      .single();

    if (bookError) throw bookError;

    // Insert pages
    if (pages?.length > 0) {
      const pagesWithBookId = pages.map(p => ({
        ...p,
        book_id: savedBook.id,
      }));

      const { error: pagesError } = await supabaseAdmin
        .from('book_pages')
        .insert(pagesWithBookId);

      if (pagesError) console.warn('Pages save error:', pagesError.message);
    }

    // Update user stats
    if (dbUserId) {
      await supabaseAdmin.rpc('increment_user_books', { uid: dbUserId }).catch(() => {});
    }

    // Log activity
    await supabaseAdmin.from('activity_log').insert({
      event_type: 'book_completed',
      severity: 'success',
      message: `Book completed: "${book.title || 'Untitled'}" (${book.tier || 'standard'}, ${book.style || 'unknown'})`,
      book_id: savedBook.id,
      user_id: dbUserId,
    }).catch(() => {});

    res.json({ bookId: savedBook.id });
  } catch (err) {
    console.error('save-book error:', err);
    res.status(500).json({ error: err.message });
  }
}
