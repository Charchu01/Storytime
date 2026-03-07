import { supabaseAdmin } from './lib/supabase-admin.js';
import { logEvent } from './lib/admin-logger.js';

export const config = { maxDuration: 30 };

const sb = supabaseAdmin;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!sb) {
    return res.status(503).json({ error: 'Supabase not configured' });
  }

  const { action } = req.body || {};

  if (!action) {
    return res.status(400).json({ error: 'action is required' });
  }

  try {
    switch (action) {
      // ── Create new experiment ───────────────────────────────
      case 'create': {
        const { hypothesis, target, variantAName, variantAPrompt, variantBName, variantBPrompt } = req.body;

        const id = `exp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const experiment = {
          id,
          hypothesis: hypothesis || '',
          target: target || '',
          status: 'running',
          variant_a: {
            name: variantAName || 'Control (current)',
            promptFragment: variantAPrompt || '',
            bookCount: 0,
            avgTextScore: 0,
            avgOverall: 0,
          },
          variant_b: {
            name: variantBName || 'Variant B',
            promptFragment: variantBPrompt || '',
            bookCount: 0,
            avgTextScore: 0,
            avgOverall: 0,
          },
          result: null,
        };

        await sb.from('admin_experiments').insert(experiment);
        await logEvent('experiment_created', { id, hypothesis });

        return res.json({
          success: true,
          experiment: {
            ...experiment,
            variantA: experiment.variant_a,
            variantB: experiment.variant_b,
          },
        });
      }

      // ── Get active variant for a target ─────────────────────
      case 'get_variant': {
        const { target } = req.body;
        const { data: experiments } = await sb.from('admin_experiments')
          .select('*')
          .eq('status', 'running')
          .eq('target', target)
          .limit(1);

        const exp = experiments?.[0];
        if (!exp) {
          return res.json({ experimentId: null, variant: null, promptFragment: null });
        }

        // Random assignment: 50/50
        const variant = Math.random() < 0.5 ? 'A' : 'B';
        const promptFragment = variant === 'B' ? exp.variant_b.promptFragment : exp.variant_a.promptFragment;
        return res.json({
          experimentId: exp.id,
          variant,
          promptFragment,
        });
      }

      // ── Record book result for experiment ───────────────────
      case 'record_result': {
        const { experimentId, variant, scores } = req.body;
        if (!experimentId) return res.status(400).json({ error: 'experimentId required' });

        const { data: exp } = await sb.from('admin_experiments')
          .select('*')
          .eq('id', experimentId)
          .single();

        if (!exp) return res.status(404).json({ error: 'Experiment not found' });

        const v = variant === 'B' ? exp.variant_b : exp.variant_a;
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

        if (exp.variant_a.bookCount >= minBooks && exp.variant_b.bookCount >= minBooks) {
          const diff = exp.variant_b.avgOverall - exp.variant_a.avgOverall;
          const absDiff = Math.abs(diff);

          const totalBooks = exp.variant_a.bookCount + exp.variant_b.bookCount;
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

        await sb.from('admin_experiments')
          .update({
            variant_a: exp.variant_a,
            variant_b: exp.variant_b,
            status: exp.status,
            result: exp.result,
            updated_at: new Date().toISOString(),
          })
          .eq('id', experimentId);

        return res.json({
          success: true,
          experiment: { ...exp, variantA: exp.variant_a, variantB: exp.variant_b },
        });
      }

      // ── Promote winner ──────────────────────────────────────
      case 'promote': {
        const { experimentId } = req.body;
        if (!experimentId) return res.status(400).json({ error: 'experimentId required' });

        const { data: exp } = await sb.from('admin_experiments')
          .select('*')
          .eq('id', experimentId)
          .single();

        if (!exp) return res.status(404).json({ error: 'Experiment not found' });
        if (!exp.result) return res.status(400).json({ error: 'Experiment not concluded' });

        const winnerVariant = exp.result.winner === 'B' ? exp.variant_b : exp.variant_a;

        // Save winning prompt as override
        if (exp.target && winnerVariant.promptFragment) {
          await sb.from('admin_config').upsert({
            key: `prompt:${exp.target}`,
            value: winnerVariant.promptFragment,
            updated_at: new Date().toISOString(),
          });
        }

        exp.status = 'promoted';
        exp.result.promoted = true;
        exp.result.promotedAt = new Date().toISOString();

        await sb.from('admin_experiments')
          .update({
            status: exp.status,
            result: exp.result,
            updated_at: new Date().toISOString(),
          })
          .eq('id', experimentId);

        await logEvent('experiment_promoted', {
          id: exp.id,
          target: exp.target,
          winner: exp.result.winner,
        });

        return res.json({
          success: true,
          experiment: { ...exp, variantA: exp.variant_a, variantB: exp.variant_b },
        });
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
