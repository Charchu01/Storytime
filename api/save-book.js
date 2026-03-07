import { supabaseAdmin } from './lib/supabase-admin.js';

export const config = { maxDuration: 15 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { book, pages, userId, clerkId, bookId, status, generationProgress } = req.body;

  if (!book) return res.status(400).json({ error: 'book data required' });
  if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase not configured' });

  // Allowlist book fields to prevent arbitrary column injection via spread operator
  const BOOK_FIELDS = [
    'title', 'tier', 'style', 'tone', 'book_type', 'hero_name', 'hero_age',
    'hero_type', 'has_photo', 'dedication', 'author_name', 'story_plan',
    'story_idea', 'personal_ingredient', 'page_count', 'companion_count',
    'health_status', 'image_quality_summary',
  ];
  const sanitizedBook = {};
  for (const key of BOOK_FIELDS) {
    if (book[key] !== undefined) sanitizedBook[key] = book[key];
  }

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
        ...sanitizedBook,
        generation_status: generationStatus,
        generation_progress: generationProgress || {},
      };
      if (generationStatus === 'completed') {
        updateData.status = 'completed';
        updateData.health_status = sanitizedBook.health_status || 'healthy';
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
          page_type: p.page_type,
          page_index: p.page_index,
          image_url: p.image_url,
          left_page_text: p.left_page_text,
          right_page_text: p.right_page_text,
          scene_description: p.scene_description,
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
          ...sanitizedBook,
          user_id: dbUserId,
          status: generationStatus === 'completed' ? 'completed' : 'generating',
          health_status: sanitizedBook.health_status || 'healthy',
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
          page_type: p.page_type,
          page_index: p.page_index,
          image_url: p.image_url,
          left_page_text: p.left_page_text,
          right_page_text: p.right_page_text,
          scene_description: p.scene_description,
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
      const { error: rpcErr } = await supabaseAdmin.rpc('increment_user_books', { uid: dbUserId });
      if (rpcErr) console.error('INCREMENT_USER_BOOKS_FAILED:', dbUserId, rpcErr.message);
    }

    // Log activity — await before response
    const eventType = bookId ? 'book_updated' : (generationStatus === 'completed' ? 'book_completed' : 'book_generation_started');
    const { error: logErr } = await supabaseAdmin.from('activity_log').insert({
      event_type: eventType,
      severity: generationStatus === 'failed' ? 'error' : 'success',
      message: `Book ${eventType.replace('book_', '')}: "${book.title || 'Untitled'}" (${book.tier || 'standard'}, ${book.style || 'unknown'})`,
      book_id: savedBookId,
      user_id: dbUserId,
    });
    if (logErr) console.warn('ACTIVITY_LOG_FAILED:', logErr.message);

    res.json({ bookId: savedBookId });
  } catch (err) {
    console.error('save-book error:', err);
    res.status(500).json({ error: err.message });
  }
}
