import { supabaseAdmin } from './lib/supabase-admin.js';

export const config = { maxDuration: 10 };

// Expected page types for each tier
const EXPECTED_PAGES = {
  standard: ['cover', 'spread_0', 'spread_1', 'spread_2', 'spread_3', 'spread_4', 'back_cover'],
  premium:  ['cover', 'spread_0', 'spread_1', 'spread_2', 'spread_3', 'spread_4', 'spread_5', 'spread_6', 'spread_7', 'spread_8', 'back_cover'],
};

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Supabase not configured' });
  }

  const bookId = req.method === 'GET' ? req.query.bookId : req.body?.bookId;
  if (!bookId) {
    return res.status(400).json({ error: 'bookId is required' });
  }

  try {
    // Load the book
    const { data: book, error: bookError } = await supabaseAdmin
      .from('books')
      .select('*')
      .eq('id', bookId)
      .single();

    if (bookError || !book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    // Load existing pages
    const { data: pages, error: pagesError } = await supabaseAdmin
      .from('book_pages')
      .select('*')
      .eq('book_id', bookId)
      .order('page_index');

    if (pagesError) throw pagesError;

    // Determine which pages exist and which are missing
    const tier = book.tier || 'standard';
    const expectedPages = EXPECTED_PAGES[tier] || EXPECTED_PAGES.standard;
    // Build a set of completed page identifiers: "cover", "spread_0", "spread_1", ..., "back_cover"
    // DB stores page_type="spread" with page_index, so we need to reconstruct the identifier
    const completedPageIds = new Set((pages || []).map(p => {
      if (p.page_type === 'spread') return `spread_${p.page_index - 1}`;
      return p.page_type;
    }));

    const missingPages = expectedPages.filter(pt => !completedPageIds.has(pt));

    res.json({
      book: {
        id: book.id,
        title: book.title,
        tier: book.tier,
        style: book.style,
        book_type: book.book_type,
        tone: book.tone,
        hero_name: book.hero_name,
        hero_age: book.hero_age,
        hero_type: book.hero_type,
        has_photo: book.has_photo,
        story_plan: book.story_plan,
        dedication: book.dedication,
        generation_status: book.generation_status || 'completed',
        generation_progress: book.generation_progress || {},
      },
      pages: (pages || []).map(p => ({
        id: p.id,
        pageIndex: p.page_index,
        pageType: p.page_type,
        imageUrl: p.image_url,
        leftPageText: p.left_page_text,
        rightPageText: p.right_page_text,
      })),
      missingPages,
      totalExpected: expectedPages.length,
      completedCount: (pages || []).length,
      canResume: missingPages.length > 0 && book.generation_status !== 'completed',
    });
  } catch (err) {
    console.error('resume-generation error:', err);
    res.status(500).json({ error: 'Failed to resume generation. Please try again.' });
  }
}
