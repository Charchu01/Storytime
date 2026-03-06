export const config = { maxDuration: 30 };

import { supabaseAdmin } from './lib/supabase-admin.js';
import { checkAdminAuth } from './lib/admin-auth-check.js';

const sb = supabaseAdmin;

// Tier → price mapping for revenue computation
const TIER_PRICES = { standard: 9.99, premium: 19.99 };

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { authorized } = checkAdminAuth(req);
  if (!authorized) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const action = req.query.action || req.body?.action;
  if (!action) {
    return res.status(400).json({ error: 'action parameter is required' });
  }

  if (!sb) {
    return handleWithoutSupabase(req, res, action);
  }

  try {
    switch (action) {
      // ── Overview Data ────────────────────────────────────────
      case 'overview': {
        const today = new Date().toISOString().split('T')[0];

        // Today's books by health_status
        const { data: todayBooks } = await sb.from('books')
          .select('health_status')
          .gte('created_at', today);

        const daily = buildDailyBookStats(todayBooks || [], today);

        // Recent events from activity_log
        const { data: events } = await sb.from('activity_log')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20);

        const parsedEvents = (events || []).map(e => ({
          ts: new Date(e.created_at).getTime(),
          type: e.event_type,
          title: e.message,
          bookId: e.book_id,
        }));

        // Monthly revenue (count books this month by tier)
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const { data: monthBooks } = await sb.from('books')
          .select('tier')
          .gte('created_at', monthStart.toISOString());

        const monthlyRevenue = (monthBooks || []).reduce(
          (sum, b) => sum + (TIER_PRICES[b.tier] || 0), 0
        );

        // Totals
        const { count: totalBooks } = await sb.from('books').select('id', { count: 'exact', head: true });
        const { count: totalUsers } = await sb.from('users').select('id', { count: 'exact', head: true });

        return res.json({
          daily,
          events: parsedEvents,
          monthlyRevenue,
          totalBooks: totalBooks || 0,
          totalUsers: totalUsers || 0,
        });
      }

      // ── Books List ───────────────────────────────────────────
      case 'books': {
        const page = parseInt(req.query.page) || 0;
        const limit = parseInt(req.query.limit) || 20;
        const offset = page * limit;

        const { data: books, count } = await sb.from('books')
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        const mapped = (books || []).map(mapBookToAdmin);
        return res.json({ books: mapped, total: count || 0, page, limit });
      }

      // ── Single Book Detail ───────────────────────────────────
      case 'book': {
        const bookId = req.query.bookId;
        if (!bookId) return res.status(400).json({ error: 'bookId required' });

        const { data: book } = await sb.from('books')
          .select('*')
          .eq('id', bookId)
          .single();

        if (!book) return res.json({ book: null, postgame: null, feedback: null });

        // Get pages for image URLs and story texts
        const { data: pages } = await sb.from('book_pages')
          .select('*')
          .eq('book_id', bookId)
          .order('page_index');

        const mapped = mapBookToAdmin(book);
        mapped.images = {};
        mapped.storyTexts = [];

        (pages || []).forEach(p => {
          if (p.page_type === 'cover') mapped.images.cover = p.image_url;
          else if (p.page_type === 'back_cover') mapped.images.backCover = p.image_url;
          else if (p.page_type === 'spread') {
            mapped.images[`spread_${p.page_index - 1}`] = p.image_url;
            mapped.storyTexts.push({
              left: p.left_page_text,
              right: p.right_page_text,
            });
          }
        });

        // Get postgame analysis
        const { data: postgame } = await sb.from('admin_postgame')
          .select('*')
          .eq('book_id', bookId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const mappedPostgame = postgame ? {
          bookId: postgame.book_id,
          analyzedAt: postgame.created_at,
          overallScore: postgame.overall_score,
          wouldRecommend: postgame.would_recommend,
          scores: postgame.scores,
          topIssue: postgame.top_issue,
        } : null;

        // Get feedback
        const { data: feedback } = await sb.from('admin_feedback')
          .select('*')
          .eq('book_id', bookId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const mappedFeedback = feedback ? {
          bookId: feedback.book_id,
          submittedAt: feedback.created_at,
          stars: feedback.stars,
          reaction: feedback.reaction,
          comment: feedback.comment,
        } : null;

        // Get validations for this book
        const { data: validations } = await sb.from('admin_validations')
          .select('*')
          .eq('book_id', bookId)
          .order('created_at');

        mapped.validations = (validations || []).map(v => ({
          page: v.page,
          attempt: v.attempt,
          textScore: v.text_score,
          faceScore: v.face_score,
          sceneAccuracy: v.scene_accuracy,
          textBoxScore: v.text_box_score,
          formatOk: v.format_ok,
          pass: v.pass,
          issues: v.issues,
          fixNotes: v.fix_notes,
          likenessScore: v.likeness_score,
          fingersOk: v.fingers_ok,
          characterCount: v.character_count,
          qualityTier: v.quality_tier,
          compositeScore: v.composite_score,
          createdAt: v.created_at,
        }));

        // Get API calls for this book (image generations, validations, etc.)
        const { data: apiCalls } = await sb.from('admin_api_calls')
          .select('*')
          .eq('book_id', bookId)
          .order('created_at');

        const mappedApiCalls = (apiCalls || []).map(c => ({
          service: c.service,
          type: c.call_type,
          status: c.status,
          durationMs: c.duration_ms,
          model: c.model,
          cost: c.cost,
          error: c.error,
          createdAt: c.created_at,
          details: c.details,
        }));

        // Calculate actual total cost from API calls
        const actualImageCost = mappedApiCalls
          .filter(c => c.service === 'replicate' && c.status === 200)
          .reduce((sum, c) => sum + (parseFloat(c.cost) || 0), 0);

        return res.json({
          book: mapped,
          postgame: mappedPostgame,
          feedback: mappedFeedback,
          apiCalls: mappedApiCalls,
          actualImageCost: actualImageCost || null,
        });
      }

      // ── Revenue Data ─────────────────────────────────────────
      case 'revenue': {
        const days = parseInt(req.query.days) || 30;
        const since = new Date();
        since.setDate(since.getDate() - days);

        const { data: books } = await sb.from('books')
          .select('created_at, tier')
          .gte('created_at', since.toISOString())
          .order('created_at');

        // Group by date
        const byDate = {};
        (books || []).forEach(b => {
          const date = b.created_at.split('T')[0];
          if (!byDate[date]) {
            byDate[date] = { date, gross: 0, transactions: 0, failed: 0, byTier: {} };
          }
          const price = TIER_PRICES[b.tier] || 0;
          byDate[date].gross += price;
          byDate[date].transactions += 1;
          if (!byDate[date].byTier[b.tier]) byDate[date].byTier[b.tier] = { count: 0, revenue: 0 };
          byDate[date].byTier[b.tier].count += 1;
          byDate[date].byTier[b.tier].revenue += price;
        });

        // Fill empty dates
        const revenueData = [];
        for (let i = days - 1; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dateStr = d.toISOString().split('T')[0];
          revenueData.push(byDate[dateStr] || { date: dateStr, gross: 0, transactions: 0, failed: 0, byTier: {} });
        }

        return res.json({ revenue: revenueData });
      }

      // ── API Calls Log ────────────────────────────────────────
      case 'api_calls': {
        const limit = parseInt(req.query.limit) || 50;
        const { data } = await sb.from('admin_api_calls')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);

        const calls = (data || []).map(c => ({
          ts: new Date(c.created_at).getTime(),
          service: c.service,
          type: c.call_type,
          bookId: c.book_id,
          status: c.status,
          durationMs: c.duration_ms,
          model: c.model,
          cost: c.cost,
          error: c.error,
          details: c.details,
        }));

        return res.json({ calls });
      }

      // ── Error Log ────────────────────────────────────────────
      case 'errors': {
        const limit = parseInt(req.query.limit) || 50;
        const { data } = await sb.from('admin_errors')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);

        const errors = (data || []).map(e => ({
          ts: new Date(e.created_at).getTime(),
          service: e.service,
          type: e.error_type,
          bookId: e.book_id,
          error: e.error,
          details: e.details,
        }));

        return res.json({ errors });
      }

      // ── Users ────────────────────────────────────────────────
      case 'users': {
        const page = parseInt(req.query.page) || 0;
        const limit = parseInt(req.query.limit) || 20;
        const offset = page * limit;

        const { data: users, count } = await sb.from('users')
          .select('*', { count: 'exact' })
          .order('updated_at', { ascending: false })
          .range(offset, offset + limit - 1);

        const mapped = (users || []).map(u => ({
          userId: u.clerk_id || u.id,
          email: u.email || null,
          firstSeen: u.created_at,
          lastActive: u.updated_at,
          bookCount: u.book_count || 0,
          totalSpent: (u.book_count || 0) * 9.99, // approximate — could be mixed tiers
          vaultCharacters: u.vault_characters || 0,
        }));

        return res.json({ users: mapped, total: count || 0, page, limit });
      }

      // ── Quality / Validation Data ────────────────────────────
      case 'quality': {
        const limit = parseInt(req.query.limit) || 50;
        const { data } = await sb.from('admin_validations')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);

        const validations = (data || []).map(v => ({
          ts: new Date(v.created_at).getTime(),
          bookId: v.book_id,
          page: v.page,
          attempt: v.attempt,
          textScore: v.text_score,
          faceScore: v.face_score,
          sceneAccuracy: v.scene_accuracy,
          textBoxScore: v.text_box_score,
          formatOk: v.format_ok,
          pass: v.pass,
          issues: v.issues,
          fixNotes: v.fix_notes,
          likenessScore: v.likeness_score,
          fingersOk: v.fingers_ok,
          characterCount: v.character_count,
          qualityTier: v.quality_tier,
          compositeScore: v.composite_score,
        }));

        const trends = await getQualityTrends();
        return res.json({ validations, trends });
      }

      // ── Post-Game Analyses ───────────────────────────────────
      case 'postgame': {
        const limit = parseInt(req.query.limit) || 20;
        const { data } = await sb.from('admin_postgame')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);

        const analyses = (data || []).map(pg => ({
          bookId: pg.book_id,
          analyzedAt: pg.created_at,
          overallScore: pg.overall_score,
          wouldRecommend: pg.would_recommend,
          scores: pg.scores,
          topIssue: pg.top_issue,
          ...pg.data,
        }));

        return res.json({ analyses });
      }

      // ── Insights ─────────────────────────────────────────────
      case 'insights': {
        const { data } = await sb.from('admin_config')
          .select('value')
          .eq('key', 'insights:latest')
          .maybeSingle();
        return res.json({ insights: data?.value || null });
      }

      // ── Experiments ──────────────────────────────────────────
      case 'experiments': {
        const { data } = await sb.from('admin_experiments')
          .select('*')
          .order('created_at', { ascending: false });

        const experiments = (data || []).map(exp => ({
          id: exp.id,
          hypothesis: exp.hypothesis,
          target: exp.target,
          status: exp.status,
          variantA: exp.variant_a,
          variantB: exp.variant_b,
          result: exp.result,
        }));

        return res.json({ experiments });
      }

      // ── Config Management ────────────────────────────────────
      case 'get_config': {
        const keys = ['validation_enabled', 'validation_strictness', 'max_retries',
                       'validate_all_pages', 'primary_image_model', 'max_generation_time',
                       'enable_narration'];
        const config = {};
        const { data } = await sb.from('admin_config')
          .select('key, value')
          .in('key', keys.map(k => `config:${k}`));

        (data || []).forEach(row => {
          const k = row.key.replace('config:', '');
          config[k] = row.value;
        });

        return res.json({ config });
      }

      case 'set_config': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const { key, value } = req.body;
        if (!key) return res.status(400).json({ error: 'key required' });

        await sb.from('admin_config').upsert({
          key: `config:${key}`,
          value,
          updated_at: new Date().toISOString(),
        });

        return res.json({ success: true, key, value });
      }

      // ── Prompt Overrides ─────────────────────────────────────
      case 'get_prompts': {
        const sections = ['cover', 'spread', 'backCover', 'systemPrompt', 'textBoxDesign', 'characterDesc'];
        const prompts = {};
        const { data } = await sb.from('admin_config')
          .select('key, value')
          .in('key', sections.map(s => `prompt:${s}`));

        (data || []).forEach(row => {
          const s = row.key.replace('prompt:', '');
          prompts[s] = row.value;
        });

        return res.json({ prompts });
      }

      case 'set_prompt': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const { section, text } = req.body;
        if (!section) return res.status(400).json({ error: 'section required' });

        if (text === null || text === '') {
          await sb.from('admin_config').delete().eq('key', `prompt:${section}`);
        } else {
          await sb.from('admin_config').upsert({
            key: `prompt:${section}`,
            value: text,
            updated_at: new Date().toISOString(),
          });
        }

        return res.json({ success: true, section });
      }

      // ── System Health ─────────────────────────────────────────
      case 'health': {
        const services = {};
        const checks = [
          { name: 'anthropic', check: checkAnthropic },
          { name: 'replicate', check: checkReplicate },
          { name: 'stripe', check: checkStripe },
          { name: 'elevenlabs', check: checkElevenLabs },
          { name: 'supabase', check: checkSupabase },
        ];

        await Promise.all(checks.map(async ({ name, check }) => {
          const start = Date.now();
          try {
            const status = await check();
            services[name] = { status: 'ok', responseMs: Date.now() - start, ...status };
          } catch (err) {
            services[name] = { status: 'error', responseMs: Date.now() - start, error: err.message };
          }
        }));

        return res.json({ services, checkedAt: new Date().toISOString() });
      }

      // ── Daily Stats (for charts) ────────────────────────────
      case 'daily_stats': {
        const days = parseInt(req.query.days) || 30;
        const since = new Date();
        since.setDate(since.getDate() - days);

        // Get books in date range
        const { data: books } = await sb.from('books')
          .select('created_at, tier, style, health_status, total_cost')
          .gte('created_at', since.toISOString());

        // Get API calls in date range
        const { data: apiCalls } = await sb.from('admin_api_calls')
          .select('created_at, service, duration_ms, cost, error')
          .gte('created_at', since.toISOString());

        // Get validations in date range
        const { data: validations } = await sb.from('admin_validations')
          .select('created_at, text_score, face_score, text_box_score, attempt, pass')
          .gte('created_at', since.toISOString());

        const stats = buildDailyStatsArray(days, books || [], apiCalls || [], validations || []);
        return res.json({ stats });
      }

      // ── User Feedback ────────────────────────────────────────
      case 'feedback': {
        const limit = parseInt(req.query.limit) || 50;
        const { data } = await sb.from('admin_feedback')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);

        const feedbacks = (data || []).map(fb => ({
          bookId: fb.book_id,
          submittedAt: fb.created_at,
          stars: fb.stars,
          reaction: fb.reaction,
          comment: fb.comment,
        }));

        return res.json({ feedbacks });
      }

      // ── Save User Feedback ───────────────────────────────────
      case 'submit_feedback': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const { bookId, stars, reaction, comment } = req.body;
        if (!bookId) return res.status(400).json({ error: 'bookId required' });

        const { logUserFeedback } = await import('./lib/admin-logger.js');
        await logUserFeedback(bookId, { stars, reaction, comment });
        return res.json({ success: true });
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err) {
    console.error('Admin API error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function mapBookToAdmin(book) {
  return {
    bookId: book.id,
    createdAt: book.created_at,
    userId: book.user_id || null,
    tier: book.tier || 'standard',
    style: book.style || 'unknown',
    bookType: book.book_type || 'adventure',
    tone: book.tone || null,
    pageCount: book.story_plan?.spreads?.length ? book.story_plan.spreads.length + 2 : 6,
    heroName: book.hero_name || 'Unknown',
    heroAge: book.hero_age || null,
    heroType: book.hero_type || 'child',
    hasPhoto: book.has_photo || false,
    characterCount: book.character_count || 1,
    totalDurationMs: book.total_duration_ms || 0,
    totalCost: book.total_cost || 0,
    status: book.health_status || 'healthy',
    title: book.title || 'Untitled',
    dedication: book.dedication || null,
    images: {},
    storyTexts: [],
    validations: [],
    costs: {},
  };
}

function buildDailyBookStats(todayBooks, date) {
  const stats = {
    date,
    books: { total: 0, healthy: 0, warnings: 0, failed: 0, byTier: {}, byStyle: {} },
    revenue: { gross: 0, costs: 0, net: 0, transactions: 0, failed: 0 },
    api: {
      anthropic: { calls: 0, errors: 0, totalMs: 0, cost: 0 },
      replicate: { calls: 0, errors: 0, totalMs: 0, cost: 0 },
      elevenlabs: { calls: 0, errors: 0, totalMs: 0, cost: 0 },
    },
    quality: { totalTextScore: 0, totalFaceScore: 0, scoreCount: 0, firstPassCount: 0, totalValidations: 0, retryCount: 0 },
    users: { active: 0, new: 0, returning: 0 },
  };

  todayBooks.forEach(b => {
    stats.books.total += 1;
    const hs = b.health_status || 'healthy';
    if (hs === 'healthy') stats.books.healthy += 1;
    else if (hs === 'warnings') stats.books.warnings += 1;
    else stats.books.failed += 1;
  });

  return stats;
}

function buildDailyStatsArray(days, books, apiCalls, validations) {
  // Index by date
  const byDate = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    byDate[dateStr] = getEmptyDailyStats(dateStr);
  }

  // Aggregate books
  books.forEach(b => {
    const date = b.created_at.split('T')[0];
    const s = byDate[date];
    if (!s) return;
    s.books.total += 1;
    const hs = b.health_status || 'healthy';
    if (hs === 'healthy') s.books.healthy += 1;
    else if (hs === 'warnings') s.books.warnings += 1;
    else s.books.failed += 1;

    const tier = b.tier || 'standard';
    s.books.byTier[tier] = (s.books.byTier[tier] || 0) + 1;

    const style = b.style || 'unknown';
    s.books.byStyle[style] = (s.books.byStyle[style] || 0) + 1;

    s.revenue.costs += b.total_cost || 0;
    s.revenue.gross += TIER_PRICES[tier] || 0;
    s.revenue.transactions += 1;
    s.revenue.net = s.revenue.gross - s.revenue.costs;
  });

  // Aggregate API calls
  apiCalls.forEach(c => {
    const date = c.created_at.split('T')[0];
    const s = byDate[date];
    if (!s) return;
    const svc = s.api[c.service];
    if (svc) {
      svc.calls += 1;
      if (c.error) svc.errors += 1;
      svc.totalMs += c.duration_ms || 0;
      svc.cost += parseFloat(c.cost) || 0;
    }
  });

  // Aggregate validations
  validations.forEach(v => {
    const date = v.created_at.split('T')[0];
    const s = byDate[date];
    if (!s) return;
    s.quality.totalTextScore += parseFloat(v.text_score) || 0;
    s.quality.totalFaceScore += parseFloat(v.face_score) || 0;
    if (v.text_box_score != null) {
      s.quality.totalTextBoxScore = (s.quality.totalTextBoxScore || 0) + (parseFloat(v.text_box_score) || 0);
      s.quality.textBoxScoreCount = (s.quality.textBoxScoreCount || 0) + 1;
    }
    s.quality.scoreCount += 1;
    s.quality.totalValidations += 1;
    if (v.attempt === 1 && v.pass) s.quality.firstPassCount += 1;
    if (v.attempt > 1) s.quality.retryCount += 1;
  });

  return Object.values(byDate);
}

function getEmptyDailyStats(date) {
  return {
    date,
    books: { total: 0, healthy: 0, warnings: 0, failed: 0, byTier: {}, byStyle: {} },
    revenue: { gross: 0, costs: 0, net: 0, transactions: 0, failed: 0 },
    api: {
      anthropic: { calls: 0, errors: 0, totalMs: 0, cost: 0 },
      replicate: { calls: 0, errors: 0, totalMs: 0, cost: 0 },
      elevenlabs: { calls: 0, errors: 0, totalMs: 0, cost: 0 },
    },
    quality: { totalTextScore: 0, totalFaceScore: 0, scoreCount: 0, firstPassCount: 0, totalValidations: 0, retryCount: 0 },
    users: { active: 0, new: 0, returning: 0 },
  };
}

async function getQualityTrends() {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data } = await sb.from('admin_validations')
    .select('created_at, text_score, face_score, text_box_score, likeness_score, composite_score, attempt, pass')
    .gte('created_at', since.toISOString());

  // Group by date
  const byDate = {};
  (data || []).forEach(v => {
    const date = v.created_at.split('T')[0];
    if (!byDate[date]) byDate[date] = { totalText: 0, totalFace: 0, totalTextBox: 0, totalLikeness: 0, totalComposite: 0, count: 0, textBoxCount: 0, likenessCount: 0, compositeCount: 0, firstPass: 0, total: 0, retries: 0 };
    const d = byDate[date];
    d.totalText += parseFloat(v.text_score) || 0;
    d.totalFace += parseFloat(v.face_score) || 0;
    if (v.text_box_score != null) { d.totalTextBox += parseFloat(v.text_box_score) || 0; d.textBoxCount += 1; }
    if (v.likeness_score != null) { d.totalLikeness += parseFloat(v.likeness_score) || 0; d.likenessCount += 1; }
    if (v.composite_score != null) { d.totalComposite += parseFloat(v.composite_score) || 0; d.compositeCount += 1; }
    d.count += 1;
    d.total += 1;
    if (v.attempt === 1 && v.pass) d.firstPass += 1;
    if (v.attempt > 1) d.retries += 1;
  });

  const trends = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const q = byDate[dateStr];
    if (q) {
      trends.push({
        date: dateStr,
        avgTextScore: q.count > 0 ? q.totalText / q.count : 0,
        avgFaceScore: q.count > 0 ? q.totalFace / q.count : 0,
        avgTextBoxScore: q.textBoxCount > 0 ? q.totalTextBox / q.textBoxCount : null,
        avgLikenessScore: q.likenessCount > 0 ? q.totalLikeness / q.likenessCount : null,
        avgCompositeScore: q.compositeCount > 0 ? q.totalComposite / q.compositeCount : null,
        firstPassRate: q.total > 0 ? q.firstPass / q.total : 0,
        retryRate: q.total > 0 ? q.retries / q.total : 0,
      });
    }
  }
  return trends;
}

// ── Health Check Helpers ────────────────────────────────────────────────────

async function checkAnthropic() {
  if (!process.env.ANTHROPIC_KEY) return { configured: false };
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
    }),
    signal: AbortSignal.timeout(8000),
  });
  return { configured: true, httpStatus: resp.status };
}

async function checkReplicate() {
  if (!process.env.REPLICATE_KEY) return { configured: false };
  const resp = await fetch('https://api.replicate.com/v1/models', {
    headers: { Authorization: `Bearer ${process.env.REPLICATE_KEY}` },
    signal: AbortSignal.timeout(5000),
  });
  return { configured: true, httpStatus: resp.status };
}

async function checkStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return { configured: false };
  try {
    const resp = await fetch('https://api.stripe.com/v1/balance', {
      headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
      signal: AbortSignal.timeout(5000),
    });
    if (resp.ok) {
      const data = await resp.json();
      const available = data.available?.reduce((sum, b) => sum + b.amount, 0) || 0;
      const pending = data.pending?.reduce((sum, b) => sum + b.amount, 0) || 0;
      const currency = data.available?.[0]?.currency || 'usd';
      return { configured: true, httpStatus: resp.status, balance: { available: available / 100, pending: pending / 100, currency } };
    }
    return { configured: true, httpStatus: resp.status };
  } catch {
    return { configured: true };
  }
}

async function checkElevenLabs() {
  if (!process.env.ELEVENLABS_KEY) return { configured: false };
  try {
    const resp = await fetch('https://api.elevenlabs.io/v1/user/subscription', {
      headers: { 'xi-api-key': process.env.ELEVENLABS_KEY },
      signal: AbortSignal.timeout(5000),
    });
    if (resp.ok) {
      const data = await resp.json();
      return {
        configured: true, httpStatus: resp.status,
        usage: {
          characterCount: data.character_count,
          characterLimit: data.character_limit,
          remainingCharacters: data.character_limit - data.character_count,
          tier: data.tier,
          nextReset: data.next_character_count_reset_unix ? new Date(data.next_character_count_reset_unix * 1000).toISOString() : null,
        },
      };
    }
    return { configured: true, httpStatus: resp.status };
  } catch {
    return { configured: true };
  }
}

async function checkSupabase() {
  if (!sb) return { configured: false };
  const start = Date.now();
  const { error } = await sb.from('books').select('id').limit(1);
  if (error) throw new Error(error.message);
  return { configured: true, pingMs: Date.now() - start };
}

// ── Fallback when Supabase is not configured ────────────────────────────────

function handleWithoutSupabase(req, res, action) {
  const today = new Date().toISOString().split('T')[0];

  switch (action) {
    case 'overview':
      return res.json({
        daily: getEmptyDailyStats(today),
        events: [],
        monthlyRevenue: 0,
        totalBooks: 0,
        totalUsers: 0,
        supabaseConfigured: false,
      });
    case 'books':
      return res.json({ books: [], total: 0, page: 0, limit: 20, supabaseConfigured: false });
    case 'book':
      return res.json({ book: null, postgame: null, feedback: null, supabaseConfigured: false });
    case 'revenue':
      return res.json({ revenue: [], supabaseConfigured: false });
    case 'api_calls':
      return res.json({ calls: [], supabaseConfigured: false });
    case 'errors':
      return res.json({ errors: [], supabaseConfigured: false });
    case 'users':
      return res.json({ users: [], total: 0, page: 0, limit: 20, supabaseConfigured: false });
    case 'quality':
      return res.json({ validations: [], trends: [], supabaseConfigured: false });
    case 'postgame':
      return res.json({ analyses: [], supabaseConfigured: false });
    case 'insights':
      return res.json({ insights: null, supabaseConfigured: false });
    case 'experiments':
      return res.json({ experiments: [], supabaseConfigured: false });
    case 'get_config':
      return res.json({ config: {}, supabaseConfigured: false });
    case 'set_config':
      return res.status(503).json({ error: 'Supabase not configured.' });
    case 'get_prompts':
      return res.json({ prompts: {}, supabaseConfigured: false });
    case 'set_prompt':
      return res.status(503).json({ error: 'Supabase not configured.' });
    case 'health':
      return handleHealthWithoutSupabase(req, res);
    case 'daily_stats': {
      const days = parseInt(req.query.days) || 30;
      const stats = [];
      for (let i = 0; i < days; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        stats.push(getEmptyDailyStats(d.toISOString().split('T')[0]));
      }
      return res.json({ stats: stats.reverse(), supabaseConfigured: false });
    }
    case 'feedback':
      return res.json({ feedbacks: [], supabaseConfigured: false });
    case 'submit_feedback':
      return res.status(503).json({ error: 'Supabase not configured.' });
    default:
      return res.status(400).json({ error: `Unknown action: ${action}` });
  }
}

async function handleHealthWithoutSupabase(req, res) {
  const services = {};
  const checks = [
    { name: 'anthropic', check: checkAnthropic },
    { name: 'replicate', check: checkReplicate },
    { name: 'stripe', check: checkStripe },
    { name: 'elevenlabs', check: checkElevenLabs },
    { name: 'supabase', check: async () => ({ configured: false }) },
  ];

  await Promise.all(checks.map(async ({ name, check }) => {
    const start = Date.now();
    try {
      const status = await check();
      services[name] = { status: status.configured === false ? 'not_configured' : 'ok', responseMs: Date.now() - start, ...status };
    } catch (err) {
      services[name] = { status: 'error', responseMs: Date.now() - start, error: err.message };
    }
  }));

  return res.json({ services, checkedAt: new Date().toISOString(), supabaseConfigured: false });
}
