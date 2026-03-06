import { logPostGameAnalysis, logEvent } from './lib/admin-logger.js';

export const config = { maxDuration: 60 };

const POST_GAME_PROMPT = `You are a senior art director and children's book editor reviewing a completed AI-generated picture book.
You have extremely high standards.

Score each dimension 1-10 and provide specific, actionable feedback.

SCORING DIMENSIONS:

1. CHARACTER CONSISTENCY (1-10)
Does the hero look like the SAME person on every page?
- 10: Identical across all pages
- 7-9: Minor variations but recognisably the same
- 4-6: Noticeable inconsistencies
- 1-3: Looks like different people

2. PHOTO LIKENESS (1-10)
Does the illustrated character resemble the real person?
- 10: Unmistakably the same person
- 7-9: Strong resemblance
- 4-6: Vaguely similar
- 1-3: Completely different

3. ART STYLE CONSISTENCY (1-10)
Same art style across ALL pages?
- 10: Could be from the same published picture book
- 7-9: Mostly consistent
- 4-6: Noticeable style changes
- 1-3: Pages from different books

4. TEXT RENDERING QUALITY (1-10)
Across ALL text in ALL pages:
- 10: Every word perfect
- 7-9: 1-2 minor issues
- 4-6: Several issues
- 1-3: Frequently wrong

5. STORY QUALITY (1-10)
- 10: Could be published
- 7-9: Strong with minor rough spots
- 4-6: Decent but formulaic
- 1-3: Doesn't make sense

6. LAYOUT VARIETY (1-10)
Different compositions across spreads?
- 10: Every spread uniquely composed
- 7-9: Good variety
- 4-6: Several look the same
- 1-3: Every page identical

7. COVER QUALITY (1-10)
Title integration, composition, appeal?
- 10: Award-winning
- 7-9: Professional
- 4-6: Forgettable
- 1-3: Would not pick up

8. EMOTIONAL IMPACT (1-10)
Does it make you FEEL something?
- 10: Genuine emotional response
- 7-9: Warm feeling
- 4-6: Pleasant but forgettable
- 1-3: No connection

For each dimension below 8, provide:
1. WHAT went wrong
2. WHY it happened (root cause)
3. HOW to fix it (specific prompt change)

Suggest up to 3 prompt system improvements.

Return ONLY valid JSON:
{
  "overallScore": 1-10,
  "scores": {
    "characterConsistency": { "score": N, "notes": "..." },
    "photoLikeness": { "score": N, "notes": "..." },
    "artStyleConsistency": { "score": N, "notes": "..." },
    "textRendering": { "score": N, "notes": "..." },
    "storyQuality": { "score": N, "notes": "..." },
    "layoutVariety": { "score": N, "notes": "..." },
    "coverQuality": { "score": N, "notes": "..." },
    "emotionalImpact": { "score": N, "notes": "..." }
  },
  "topIssue": "The single biggest thing to fix",
  "promptSuggestions": [
    {
      "type": "add|change|remove|enforce",
      "target": "which prompt section",
      "current": "current text if changing",
      "suggested": "new text",
      "reasoning": "why",
      "expectedImpact": "high|medium|low"
    }
  ],
  "wouldRecommend": true/false,
  "buyerReadiness": 1-10
}`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_KEY not configured' });
  }

  const { bookId, images, storyTexts, artStyle, heroName, title } = req.body || {};

  if (!bookId) {
    return res.status(400).json({ error: 'bookId is required' });
  }

  try {
    // Build content array with all images
    const content = [];

    // Add story context
    content.push({
      type: 'text',
      text: `BOOK: "${title || 'Untitled'}"
ART STYLE: ${artStyle || 'unknown'}
HERO: ${heroName || 'unknown'}

STORY TEXT:
${(storyTexts || []).map((t, i) => `Page ${i + 1}: ${typeof t === 'string' ? t : `Left: "${t.left || ''}" Right: "${t.right || ''}"`}`).join('\n')}

Review the following images from this book:`,
    });

    // Add each image
    const imageKeys = ['cover', 'spread_0', 'spread_1', 'spread_2', 'spread_3', 'spread_4', 'backCover'];
    const validImages = [];

    for (const key of imageKeys) {
      const url = images?.[key];
      if (url && typeof url === 'string' && url.startsWith('http')) {
        content.push({
          type: 'text',
          text: `\n--- ${key.toUpperCase()} ---`,
        });
        content.push({
          type: 'image',
          source: { type: 'url', url },
        });
        validImages.push(key);
      }
    }

    if (validImages.length === 0) {
      return res.json({ skipped: true, reason: 'No valid image URLs' });
    }

    // Add the scoring prompt
    content.push({
      type: 'text',
      text: POST_GAME_PROMPT,
    });

    // Call Claude for analysis
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
        messages: [{ role: 'user', content }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Post-game analysis API error:', data.error?.message);
      return res.status(response.status).json({
        error: data.error?.message || 'Analysis API error',
      });
    }

    const text = data.content.map(b => b.text || '').join('').trim();

    let analysis;
    try {
      const cleaned = text.replace(/```json\s*|```\s*/g, '').trim();
      analysis = JSON.parse(cleaned);
    } catch {
      console.warn('Post-game analysis parse error:', text.substring(0, 200));
      return res.json({ skipped: true, reason: 'Parse error', rawText: text.substring(0, 500) });
    }

    // Save to Supabase
    await logPostGameAnalysis(bookId, analysis);

    // Log event
    await logEvent('postgame_complete', {
      bookId,
      overallScore: analysis.overallScore,
      topIssue: analysis.topIssue,
    });

    return res.json({ success: true, analysis });
  } catch (err) {
    console.error('Post-game analysis error:', err);
    return res.status(500).json({ error: err.message });
  }
}
