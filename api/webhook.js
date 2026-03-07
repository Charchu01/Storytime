import Stripe from 'stripe';
import getRawBody from 'raw-body';
import { logRevenue, logEvent as logAdminEvent } from './lib/admin-logger.js';
import { supabaseAdmin } from './lib/supabase-admin.js';

export const config = { maxDuration: 30, api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  let event;
  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(
      rawBody,
      req.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object;
    const { storySessionId, tier } = pi.metadata || {};
    if (storySessionId) {
      // Record payment in Supabase (replaces Vercel KV)
      if (supabaseAdmin) {
        const { error: upsertErr } = await supabaseAdmin.from('payment_records').upsert({
          session_id: storySessionId,
          paid: true,
          tier,
          stripe_payment_intent_id: pi.id,
          paid_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 86400 * 1000).toISOString(),
        }, { onConflict: 'session_id' });
        if (upsertErr) {
          console.error('PAYMENT_RECORD_UPSERT_FAILED:', pi.id, upsertErr.message);
        }
      }

      // Admin logging: revenue — await before response
      const amount = pi.amount ? pi.amount / 100 : (tier === 'premium' ? 19.99 : 9.99);
      try {
        await logRevenue({
          status: 'succeeded',
          amount,
          tier,
          sessionId: storySessionId,
          stripeId: pi.id,
        });
      } catch (logErr) {
        console.error('REVENUE_LOG_FAILED (succeeded):', pi.id, logErr.message);
      }
    }
  }

  if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object;
    const { storySessionId, tier } = pi.metadata || {};
    try {
      await logRevenue({
        status: 'failed',
        amount: 0,
        tier,
        sessionId: storySessionId,
        stripeId: pi.id,
      });
    } catch (logErr) {
      console.error('REVENUE_LOG_FAILED (failed):', pi.id, logErr.message);
    }
  }

  res.json({ received: true });
}
