import { supabaseAdmin } from './lib/supabase-admin.js';
import { logEvent, logApiCall } from './lib/admin-logger.js';
import { checkAdminAuth } from './lib/admin-auth-check.js';

export const config = { maxDuration: 60 };

const sb = supabaseAdmin;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Admin-only endpoint — requires authentication
  const auth = checkAdminAuth(req);
  if (!auth.authorized) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const apiKey = process.env.ANTHROPIC_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_KEY not configured' });
  }

  if (!sb) {
    return res.status(503).json({ error: 'Supabase not configured' });
  }

  const startTime = Date.now();
  try {
    // Gather post-game analyses from Supabase
    const { data: pgData } = await sb.from('admin_postgame')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    const analyses = (pgData || [])
      .filter(pg => pg.scores || pg.data?.scores)
      .map(pg => ({
        bookId: pg.book_id,
        overallScore: pg.overall_score || pg.data?.overallScore,
        scores: pg.scores || pg.data?.scores,
        topIssue: pg.top_issue || pg.data?.topIssue,
        promptSuggestions: pg.data?.promptSuggestions,
        wouldRecommend: pg.would_recommend,
      }));

    if (analyses.length < 3) {
      return res.json({ skipped: true, reason: `Only ${analyses.length} analyses available, need at least 3` });
    }

    // Aggregate scores
    const dims = ['characterConsistency', 'photoLikeness', 'artStyleConsistency',
                  'textRendering', 'storyQuality', 'layoutVariety', 'coverQuality', 'emotionalImpact'];

    const avgScores = {};
    for (const dim of dims) {
      const scores = analyses.map(a => a.scores?.[dim]?.score).filter(s => typeof s === 'number');
      avgScores[dim] = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    }

    const overallScores = analyses.map(a => a.overallScore).filter(s => typeof s === 'number');
    avgScores.overall = overallScores.length > 0
      ? overallScores.reduce((a, b) => a + b, 0) / overallScores.length : 0;

    // Breakdown by style (from books table)
    const bookIds = analyses.map(a => a.bookId).filter(Boolean);
    const { data: books } = await sb.from('books')
      .select('id, style')
      .in('id', bookIds);

    const bookStyleMap = {};
    (books || []).forEach(b => { bookStyleMap[b.id] = b.style; });

    const byStyle = {};
    for (const a of analyses) {
      const style = bookStyleMap[a.bookId] || 'unknown';
      if (!byStyle[style]) byStyle[style] = { scores: [], count: 0 };
      byStyle[style].count += 1;
      byStyle[style].scores.push(a.overallScore || 0);
    }
    for (const style of Object.keys(byStyle)) {
      const s = byStyle[style];
      s.avgOverall = s.scores.reduce((a, b) => a + b, 0) / s.scores.length;
      delete s.scores;
    }

    // Collect common issues and suggestions
    const issueMap = {};
    const suggestionMap = {};
    for (const a of analyses) {
      if (a.topIssue) {
        issueMap[a.topIssue] = (issueMap[a.topIssue] || 0) + 1;
      }
      if (a.promptSuggestions) {
        for (const s of a.promptSuggestions) {
          const key = s.suggested || s.target || 'unknown';
          suggestionMap[key] = (suggestionMap[key] || 0) + 1;
        }
      }
    }

    const topIssues = Object.entries(issueMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([text, count]) => ({ text, count }));

    const topSuggestions = Object.entries(suggestionMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([text, count]) => ({ text, count }));

    // Ask Claude for pattern analysis
    const insightsPrompt = `You are a data analyst reviewing ${analyses.length} children's book generation reports.

CURRENT AVERAGES:
${dims.map(d => `${d}: ${avgScores[d].toFixed(1)}`).join('\n')}
Overall: ${avgScores.overall.toFixed(1)}

BY ART STYLE:
${JSON.stringify(byStyle, null, 2)}

MOST COMMON ISSUES:
${topIssues.map((issue, i) => `${i + 1}. ${issue.text} (${issue.count} occurrences)`).join('\n')}

MOST SUGGESTED CHANGES:
${topSuggestions.map((s, i) => `${i + 1}. ${s.text} (suggested ${s.count} times)`).join('\n')}

Find patterns. What's weakest? Which styles perform best/worst? Highest-impact fix?

Return JSON:
{
  "weakestDimension": "...",
  "strongestDimension": "...",
  "bestPerformingStyle": "...",
  "worstPerformingStyle": "...",
  "topRecommendations": [
    {
      "priority": 1,
      "title": "Short description",
      "detail": "Full explanation",
      "promptChange": {
        "section": "which prompt section",
        "action": "add/change/remove",
        "text": "specific text change"
      },
      "expectedScoreImpact": "+0.5 on ...",
      "confidence": "high/medium/low",
      "evidenceCount": N
    }
  ],
  "trendingUp": ["dimensions improving"],
  "trendingDown": ["dimensions degrading"],
  "anomalies": ["anything unusual"]
}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);
    let response;
    try {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          messages: [{ role: 'user', content: insightsPrompt }],
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const data = await response.json();
    if (!response.ok) {
      try {
        await logApiCall({
          service: 'anthropic',
          type: 'insights_engine',
          status: response.status,
          durationMs: Date.now() - startTime,
          model: 'claude-sonnet-4-20250514',
          error: data.error?.message,
        });
      } catch (logErr) {
        console.warn('logApiCall failed:', logErr.message);
      }
      return res.status(response.status).json({ error: data.error?.message });
    }

    // Calculate actual cost from token usage — await before response
    const inputTokens = data.usage?.input_tokens || 0;
    const outputTokens = data.usage?.output_tokens || 0;
    const cost = (inputTokens * 3 + outputTokens * 15) / 1_000_000;
    try {
      await logApiCall({
        service: 'anthropic',
        type: 'insights_engine',
        status: 200,
        durationMs: Date.now() - startTime,
        model: 'claude-sonnet-4-20250514',
        cost,
        details: { inputTokens, outputTokens },
      });
    } catch (logErr) {
      console.warn('logApiCall failed:', logErr.message);
    }

    const text = data.content.map(b => b.text || '').join('').trim();
    let insights;
    try {
      const cleaned = text.replace(/```json\s*|```\s*/g, '').trim();
      insights = JSON.parse(cleaned);
    } catch {
      return res.json({ skipped: true, reason: 'Parse error' });
    }

    // Save insights to Supabase config table
    const insightsRecord = {
      date: new Date().toISOString().split('T')[0],
      sampleSize: analyses.length,
      avgScores,
      byStyle,
      topIssues,
      topSuggestions,
      aiInsights: insights,
    };

    await sb.from('admin_config').upsert({
      key: 'insights:latest',
      value: insightsRecord,
      updated_at: new Date().toISOString(),
    });

    await logEvent('insights_generated', {
      sampleSize: analyses.length,
      weakest: insights.weakestDimension,
    });

    return res.json({ success: true, insights: insightsRecord });
  } catch (err) {
    console.error('Insights engine error:', err);
    return res.status(500).json({ error: err.message });
  }
}
