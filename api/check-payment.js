import { supabaseAdmin } from './lib/supabase-admin.js';

export const config = { maxDuration: 10 };

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { sessionId } = req.query;
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('payment_records')
      .select('paid, tier')
      .eq('session_id', sessionId)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (error) throw error;

    res.json({ paid: !!data?.paid, tier: data?.tier || null });
  } catch (err) {
    console.error('check-payment error:', err);
    res.status(500).json({ error: err.message });
  }
}
