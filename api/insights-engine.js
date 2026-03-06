import { kv } from '@vercel/kv';
import { logEvent } from './lib/admin-logger.js';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_KEY not configured' });
  }

  try {
    // Gather post-game analyses
    const pgIds = await kv.zrange('admin:postgame_index', 0, 99, { rev: true }) || [];
    const analyses = [];
    for (const id of pgIds) {
      const pg = await kv.get(`admin:postgame:${id}`);
      if (pg?.scores) analyses.push(pg);
    }

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

    // Breakdown by style (from book records)
    const byStyle = {};
    for (const a of analyses) {
      const book = await kv.get(`admin:books:${a.bookId}`);
      const style = book?.style || 'unknown';
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

    const response = await fetch('https://api.anthropic.com/v1/messages', {
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
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message });
    }

    const text = data.content.map(b => b.text || '').join('').trim();
    let insights;
    try {
      const cleaned = text.replace(/```json\s*|```\s*/g, '').trim();
      insights = JSON.parse(cleaned);
    } catch {
      return res.json({ skipped: true, reason: 'Parse error' });
    }

    // Save insights
    const insightsRecord = {
      date: new Date().toISOString().split('T')[0],
      sampleSize: analyses.length,
      avgScores,
      byStyle,
      topIssues,
      topSuggestions,
      aiInsights: insights,
    };

    await kv.set('admin:insights:latest', insightsRecord);
    await kv.set(`admin:insights:${insightsRecord.date}`, insightsRecord);

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
