import { kv } from '@vercel/kv';
import { logEvent } from './lib/admin-logger.js';

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action } = req.body || {};

  try {
    switch (action) {
      // ── Create new experiment ───────────────────────────────
      case 'create': {
        const { hypothesis, target, variantAName, variantAPrompt, variantBName, variantBPrompt } = req.body;

        const id = `exp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const experiment = {
          id,
          created: new Date().toISOString(),
          status: 'running',
          hypothesis: hypothesis || '',
          target: target || '',
          variantA: {
            name: variantAName || 'Control (current)',
            promptFragment: variantAPrompt || '',
            bookCount: 0,
            avgTextScore: 0,
            avgOverall: 0,
          },
          variantB: {
            name: variantBName || 'Variant B',
            promptFragment: variantBPrompt || '',
            bookCount: 0,
            avgTextScore: 0,
            avgOverall: 0,
          },
          result: null,
        };

        await kv.set(`admin:experiments:${id}`, experiment);
        await kv.zadd('admin:experiments_index', { score: Date.now(), member: id });
        await logEvent('experiment_created', { id, hypothesis });

        return res.json({ success: true, experiment });
      }

      // ── Get active variant for a target ─────────────────────
      case 'get_variant': {
        const { target } = req.body;
        const expIds = await kv.zrange('admin:experiments_index', 0, -1, { rev: true }) || [];

        for (const id of expIds) {
          const exp = await kv.get(`admin:experiments:${id}`);
          if (exp && exp.status === 'running' && exp.target === target) {
            // Random assignment: 50/50
            const variant = Math.random() < 0.5 ? 'A' : 'B';
            const promptFragment = variant === 'B' ? exp.variantB.promptFragment : exp.variantA.promptFragment;
            return res.json({
              experimentId: exp.id,
              variant,
              promptFragment,
            });
          }
        }

        return res.json({ experimentId: null, variant: null, promptFragment: null });
      }

      // ── Record book result for experiment ───────────────────
      case 'record_result': {
        const { experimentId, variant, scores } = req.body;
        if (!experimentId) return res.status(400).json({ error: 'experimentId required' });

        const exp = await kv.get(`admin:experiments:${experimentId}`);
        if (!exp) return res.status(404).json({ error: 'Experiment not found' });

        const v = variant === 'B' ? exp.variantB : exp.variantA;
        v.bookCount = (v.bookCount || 0) + 1;

        if (scores?.textScore !== undefined) {
          v.avgTextScore = ((v.avgTextScore || 0) * (v.bookCount - 1) + scores.textScore) / v.bookCount;
        }
        if (scores?.overallScore !== undefined) {
          v.avgOverall = ((v.avgOverall || 0) * (v.bookCount - 1) + scores.overallScore) / v.bookCount;
        }

        // Check if we should conclude the experiment
        const minBooks = 25;
        const minConfidence = 0.90;
        const minImprovement = 0.3;

        if (exp.variantA.bookCount >= minBooks && exp.variantB.bookCount >= minBooks) {
          const diff = exp.variantB.avgOverall - exp.variantA.avgOverall;
          const absDiff = Math.abs(diff);

          // Simple confidence estimate (not real p-value but practical)
          const totalBooks = exp.variantA.bookCount + exp.variantB.bookCount;
          const confidence = Math.min(0.99, 0.5 + (absDiff * Math.sqrt(totalBooks)) / 10);

          if (confidence >= minConfidence && absDiff >= minImprovement) {
            const winner = diff > 0 ? 'B' : 'A';
            exp.status = 'concluded';
            exp.result = {
              winner,
              improvement: absDiff.toFixed(2),
              confidence: confidence.toFixed(3),
              concludedAt: new Date().toISOString(),
              promoted: false,
            };

            await logEvent('experiment_concluded', {
              id: exp.id,
              winner,
              improvement: absDiff.toFixed(2),
            });
          }
        }

        await kv.set(`admin:experiments:${experimentId}`, exp);
        return res.json({ success: true, experiment: exp });
      }

      // ── Promote winner ──────────────────────────────────────
      case 'promote': {
        const { experimentId } = req.body;
        if (!experimentId) return res.status(400).json({ error: 'experimentId required' });

        const exp = await kv.get(`admin:experiments:${experimentId}`);
        if (!exp) return res.status(404).json({ error: 'Experiment not found' });
        if (!exp.result) return res.status(400).json({ error: 'Experiment not concluded' });

        const winnerVariant = exp.result.winner === 'B' ? exp.variantB : exp.variantA;

        // Save winning prompt as override
        if (exp.target && winnerVariant.promptFragment) {
          await kv.set(`admin:prompts:${exp.target}`, winnerVariant.promptFragment);
        }

        exp.status = 'promoted';
        exp.result.promoted = true;
        exp.result.promotedAt = new Date().toISOString();

        await kv.set(`admin:experiments:${experimentId}`, exp);

        await logEvent('experiment_promoted', {
          id: exp.id,
          target: exp.target,
          winner: exp.result.winner,
        });

        return res.json({ success: true, experiment: exp });
      }

      // ── Auto-generate variant from insights ─────────────────
      case 'auto_generate': {
        const apiKey = process.env.ANTHROPIC_KEY;
        if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_KEY not configured' });

        const { currentPromptSection, weakDimension, avgScore, topIssues } = req.body;

        const genPrompt = `You are an AI prompt engineer. The following prompt section is underperforming on "${weakDimension}" (avg score: ${avgScore}/10).

CURRENT PROMPT SECTION:
"""
${currentPromptSection}
"""

COMMON ISSUES:
${(topIssues || []).join('\n')}

Generate an improved version. Rules:
- Keep the same general structure
- Be SPECIFIC about what to change and why
- Don't make it 3x longer — surgical improvements
- Focus on the specific weakness

Return JSON:
{
  "variantName": "Short description",
  "newPromptSection": "The improved text",
  "reasoning": "Why this should work better",
  "expectedImpact": "Which scores should improve and by how much"
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
            messages: [{ role: 'user', content: genPrompt }],
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          return res.status(response.status).json({ error: data.error?.message });
        }

        const text = data.content.map(b => b.text || '').join('').trim();
        try {
          const cleaned = text.replace(/```json\s*|```\s*/g, '').trim();
          const variant = JSON.parse(cleaned);
          return res.json({ success: true, variant });
        } catch {
          return res.json({ success: false, reason: 'Parse error' });
        }
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err) {
    console.error('Prompt variant error:', err);
    return res.status(500).json({ error: err.message });
  }
}
