export const config = { maxDuration: 30 };

// Check if KV is configured before importing
const kvAvailable = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
let kv = null;
if (kvAvailable) {
  kv = (await import('@vercel/kv')).kv;
}

export default async function handler(req, res) {
  // CORS / method check
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const action = req.query.action || req.body?.action;

  if (!action) {
    return res.status(400).json({ error: 'action parameter is required' });
  }

  // If KV is not configured, return empty/default data instead of crashing
  if (!kvAvailable) {
    return handleWithoutKV(req, res, action);
  }

  try {
    switch (action) {
      // ── Overview Data ────────────────────────────────────────
      case 'overview': {
        const today = new Date().toISOString().split('T')[0];
        const dailyStats = await kv.get(`admin:daily:${today}`) || getEmptyDailyStats(today);
        const events = await kv.lrange('admin:events', 0, 19) || [];
        const parsedEvents = events.map(e => typeof e === 'string' ? JSON.parse(e) : e);

        // Get monthly revenue
        const monthlyRevenue = await getMonthlyRevenue();

        // Get total book count
        const totalBooks = await kv.zcard('admin:books_index') || 0;

        // Get total user count
        const totalUsers = await kv.zcard('admin:users_index') || 0;

        return res.json({
          daily: dailyStats,
          events: parsedEvents,
          monthlyRevenue,
          totalBooks,
          totalUsers,
        });
      }

      // ── Books List ───────────────────────────────────────────
      case 'books': {
        const page = parseInt(req.query.page) || 0;
        const limit = parseInt(req.query.limit) || 20;
        const start = page * limit;

        const bookIds = await kv.zrange('admin:books_index', start, start + limit - 1, { rev: true }) || [];
        const books = [];
        for (const id of bookIds) {
          const book = await kv.get(`admin:books:${id}`);
          if (book) books.push(book);
        }

        const total = await kv.zcard('admin:books_index') || 0;
        return res.json({ books, total, page, limit });
      }

      // ── Single Book Detail ───────────────────────────────────
      case 'book': {
        const bookId = req.query.bookId;
        if (!bookId) return res.status(400).json({ error: 'bookId required' });

        const book = await kv.get(`admin:books:${bookId}`);
        const postgame = await kv.get(`admin:postgame:${bookId}`);
        const feedback = await kv.get(`admin:feedback:${bookId}`);

        return res.json({ book, postgame, feedback });
      }

      // ── Revenue Data ─────────────────────────────────────────
      case 'revenue': {
        const days = parseInt(req.query.days) || 30;
        const revenueData = [];

        for (let i = 0; i < days; i++) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dateStr = d.toISOString().split('T')[0];
          const data = await kv.get(`admin:revenue:${dateStr}`);
          revenueData.push(data || { date: dateStr, gross: 0, transactions: 0, failed: 0, byTier: {} });
        }

        return res.json({ revenue: revenueData.reverse() });
      }

      // ── API Calls Log ────────────────────────────────────────
      case 'api_calls': {
        const limit = parseInt(req.query.limit) || 50;
        const callIds = await kv.zrange('admin:api_calls_index', 0, limit - 1, { rev: true }) || [];
        const calls = [];
        for (const id of callIds) {
          const call = await kv.get(`admin:api_calls:${id}`);
          if (call) calls.push(call);
        }
        return res.json({ calls });
      }

      // ── Error Log ────────────────────────────────────────────
      case 'errors': {
        const limit = parseInt(req.query.limit) || 50;
        const errorIds = await kv.zrange('admin:errors_index', 0, limit - 1, { rev: true }) || [];
        const errors = [];
        for (const id of errorIds) {
          const err = await kv.get(`admin:errors:${id}`);
          if (err) errors.push(err);
        }
        return res.json({ errors });
      }

      // ── Users ────────────────────────────────────────────────
      case 'users': {
        const page = parseInt(req.query.page) || 0;
        const limit = parseInt(req.query.limit) || 20;
        const start = page * limit;

        const userIds = await kv.zrange('admin:users_index', start, start + limit - 1, { rev: true }) || [];
        const users = [];
        for (const id of userIds) {
          const user = await kv.get(`admin:users:${id}`);
          if (user) users.push(user);
        }

        const total = await kv.zcard('admin:users_index') || 0;
        return res.json({ users, total, page, limit });
      }

      // ── Quality / Validation Data ────────────────────────────
      case 'quality': {
        const limit = parseInt(req.query.limit) || 50;
        const valIds = await kv.zrange('admin:validations_index', 0, limit - 1, { rev: true }) || [];
        const validations = [];
        for (const id of valIds) {
          const v = await kv.get(`admin:validations:${id}`);
          if (v) validations.push(v);
        }

        // Get quality trends (last 30 days)
        const trends = await getQualityTrends();

        return res.json({ validations, trends });
      }

      // ── Post-Game Analyses ───────────────────────────────────
      case 'postgame': {
        const limit = parseInt(req.query.limit) || 20;
        const pgIds = await kv.zrange('admin:postgame_index', 0, limit - 1, { rev: true }) || [];
        const analyses = [];
        for (const id of pgIds) {
          const pg = await kv.get(`admin:postgame:${id}`);
          if (pg) analyses.push(pg);
        }
        return res.json({ analyses });
      }

      // ── Insights ─────────────────────────────────────────────
      case 'insights': {
        const latest = await kv.get('admin:insights:latest');
        return res.json({ insights: latest });
      }

      // ── Experiments ──────────────────────────────────────────
      case 'experiments': {
        const expIds = await kv.zrange('admin:experiments_index', 0, -1, { rev: true }) || [];
        const experiments = [];
        for (const id of expIds) {
          const exp = await kv.get(`admin:experiments:${id}`);
          if (exp) experiments.push(exp);
        }
        return res.json({ experiments });
      }

      // ── Config Management ────────────────────────────────────
      case 'get_config': {
        const keys = ['validation_enabled', 'validation_strictness', 'max_retries',
                       'validate_all_pages', 'primary_image_model', 'max_generation_time',
                       'enable_narration'];
        const config = {};
        for (const k of keys) {
          config[k] = await kv.get(`admin:config:${k}`);
        }
        return res.json({ config });
      }

      case 'set_config': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const { key, value } = req.body;
        if (!key) return res.status(400).json({ error: 'key required' });
        await kv.set(`admin:config:${key}`, value);
        return res.json({ success: true, key, value });
      }

      // ── Prompt Overrides ─────────────────────────────────────
      case 'get_prompts': {
        const sections = ['cover', 'spread', 'backCover', 'systemPrompt', 'textBoxDesign', 'characterDesc'];
        const prompts = {};
        for (const s of sections) {
          prompts[s] = await kv.get(`admin:prompts:${s}`);
        }
        return res.json({ prompts });
      }

      case 'set_prompt': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const { section, text } = req.body;
        if (!section) return res.status(400).json({ error: 'section required' });
        if (text === null || text === '') {
          await kv.del(`admin:prompts:${section}`);
        } else {
          await kv.set(`admin:prompts:${section}`, text);
        }
        return res.json({ success: true, section });
      }

      // ── System Health (extended) ─────────────────────────────
      case 'health': {
        const services = {};

        // Check each service
        const checks = [
          { name: 'anthropic', check: checkAnthropic },
          { name: 'replicate', check: checkReplicate },
          { name: 'stripe', check: checkStripe },
          { name: 'elevenlabs', check: checkElevenLabs },
          { name: 'vercel_kv', check: checkKV },
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
        const stats = [];
        for (let i = 0; i < days; i++) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dateStr = d.toISOString().split('T')[0];
          const data = await kv.get(`admin:daily:${dateStr}`);
          stats.push(data || getEmptyDailyStats(dateStr));
        }
        return res.json({ stats: stats.reverse() });
      }

      // ── User Feedback ────────────────────────────────────────
      case 'feedback': {
        const limit = parseInt(req.query.limit) || 50;
        const fbIds = await kv.zrange('admin:feedback_index', 0, limit - 1, { rev: true }) || [];
        const feedbacks = [];
        for (const id of fbIds) {
          const fb = await kv.get(`admin:feedback:${id}`);
          if (fb) feedbacks.push(fb);
        }
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

async function getMonthlyRevenue() {
  const now = new Date();
  let total = 0;
  const daysInMonth = now.getDate();

  for (let i = 0; i < daysInMonth; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const data = await kv.get(`admin:revenue:${dateStr}`);
    if (data) total += data.gross || 0;
  }

  return total;
}

async function getQualityTrends() {
  const trends = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const data = await kv.get(`admin:daily:${dateStr}`);
    if (data?.quality) {
      const q = data.quality;
      trends.push({
        date: dateStr,
        avgTextScore: q.scoreCount > 0 ? q.totalTextScore / q.scoreCount : 0,
        avgFaceScore: q.scoreCount > 0 ? q.totalFaceScore / q.scoreCount : 0,
        firstPassRate: q.totalValidations > 0 ? q.firstPassCount / q.totalValidations : 0,
        retryRate: q.totalValidations > 0 ? q.retryCount / q.totalValidations : 0,
      });
    }
  }
  return trends.reverse();
}

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

async function checkKV() {
  if (!kv) return { configured: false };
  const start = Date.now();
  await kv.ping();
  return { configured: true, pingMs: Date.now() - start };
}

// Return empty/default data when Vercel KV is not configured
function handleWithoutKV(req, res, action) {
  const today = new Date().toISOString().split('T')[0];
  const emptyDaily = getEmptyDailyStats(today);

  switch (action) {
    case 'overview':
      return res.json({
        daily: emptyDaily,
        events: [],
        monthlyRevenue: 0,
        totalBooks: 0,
        totalUsers: 0,
        kvConfigured: false,
      });
    case 'books':
      return res.json({ books: [], total: 0, page: 0, limit: 20, kvConfigured: false });
    case 'book':
      return res.json({ book: null, postgame: null, feedback: null, kvConfigured: false });
    case 'revenue':
      return res.json({ revenue: [], kvConfigured: false });
    case 'api_calls':
      return res.json({ calls: [], kvConfigured: false });
    case 'errors':
      return res.json({ errors: [], kvConfigured: false });
    case 'users':
      return res.json({ users: [], total: 0, page: 0, limit: 20, kvConfigured: false });
    case 'quality':
      return res.json({ validations: [], trends: [], kvConfigured: false });
    case 'postgame':
      return res.json({ analyses: [], kvConfigured: false });
    case 'insights':
      return res.json({ insights: null, kvConfigured: false });
    case 'experiments':
      return res.json({ experiments: [], kvConfigured: false });
    case 'get_config':
      return res.json({ config: {}, kvConfigured: false });
    case 'set_config':
      return res.status(503).json({ error: 'Vercel KV not configured. Add a KV database in your Vercel project settings.' });
    case 'get_prompts':
      return res.json({ prompts: {}, kvConfigured: false });
    case 'set_prompt':
      return res.status(503).json({ error: 'Vercel KV not configured. Add a KV database in your Vercel project settings.' });
    case 'health': {
      // Health check can still run for non-KV services
      return handleHealthWithoutKV(req, res);
    }
    case 'daily_stats': {
      const days = parseInt(req.query.days) || 30;
      const stats = [];
      for (let i = 0; i < days; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        stats.push(getEmptyDailyStats(d.toISOString().split('T')[0]));
      }
      return res.json({ stats: stats.reverse(), kvConfigured: false });
    }
    case 'feedback':
      return res.json({ feedbacks: [], kvConfigured: false });
    case 'submit_feedback':
      return res.status(503).json({ error: 'Vercel KV not configured. Add a KV database in your Vercel project settings.' });
    default:
      return res.status(400).json({ error: `Unknown action: ${action}` });
  }
}

async function handleHealthWithoutKV(req, res) {
  const services = {};
  const checks = [
    { name: 'anthropic', check: checkAnthropic },
    { name: 'replicate', check: checkReplicate },
    { name: 'stripe', check: checkStripe },
    { name: 'elevenlabs', check: checkElevenLabs },
    { name: 'vercel_kv', check: async () => ({ configured: false }) },
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

  return res.json({ services, checkedAt: new Date().toISOString(), kvConfigured: false });
}
