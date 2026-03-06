import { supabaseAdmin } from './lib/supabase-admin.js';

export const config = { maxDuration: 15 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { book, pages, userId, clerkId, bookId, status, generationProgress } = req.body;

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

    const generationStatus = status || 'completed';
    let savedBookId;

    if (bookId) {
      // ── UPDATE existing book ─────────────────────────────────
      const updateData = {
        ...book,
        generation_status: generationStatus,
        generation_progress: generationProgress || {},
      };
      if (generationStatus === 'completed') {
        updateData.status = 'completed';
        updateData.health_status = book.health_status || 'healthy';
      }

      const { error: updateError } = await supabaseAdmin
        .from('books')
        .update(updateData)
        .eq('id', bookId);

      if (updateError) throw updateError;
      savedBookId = bookId;

      // Upsert pages — delete existing then re-insert for simplicity
      if (pages?.length > 0) {
        await supabaseAdmin
          .from('book_pages')
          .delete()
          .eq('book_id', bookId);

        const pagesWithBookId = pages.map(p => ({
          ...p,
          book_id: bookId,
        }));

        const { error: pagesError } = await supabaseAdmin
          .from('book_pages')
          .insert(pagesWithBookId);

        if (pagesError) console.warn('Pages save error:', pagesError.message);
      }
    } else {
      // ── INSERT new book ──────────────────────────────────────
      const { data: savedBook, error: bookError } = await supabaseAdmin
        .from('books')
        .insert({
          ...book,
          user_id: dbUserId,
          status: generationStatus === 'completed' ? 'completed' : 'generating',
          health_status: book.health_status || 'healthy',
          generation_status: generationStatus,
          generation_progress: generationProgress || {},
        })
        .select('id')
        .single();

      if (bookError) throw bookError;
      savedBookId = savedBook.id;

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
    }

    // Update user stats only when book is fully completed
    if (generationStatus === 'completed' && dbUserId) {
      await supabaseAdmin.rpc('increment_user_books', { uid: dbUserId }).catch(() => {});
    }

    // Log activity
    const eventType = bookId ? 'book_updated' : (generationStatus === 'completed' ? 'book_completed' : 'book_generation_started');
    await supabaseAdmin.from('activity_log').insert({
      event_type: eventType,
      severity: generationStatus === 'failed' ? 'error' : 'success',
      message: `Book ${eventType.replace('book_', '')}: "${book.title || 'Untitled'}" (${book.tier || 'standard'}, ${book.style || 'unknown'})`,
      book_id: savedBookId,
      user_id: dbUserId,
    }).catch(() => {});

    res.json({ bookId: savedBookId });
  } catch (err) {
    console.error('save-book error:', err);
    res.status(500).json({ error: err.message });
  }
}
