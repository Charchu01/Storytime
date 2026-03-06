import Stripe from 'stripe';
import { kv } from '@vercel/kv';
import getRawBody from 'raw-body';
import { logRevenue, logEvent as logAdminEvent } from './lib/admin-logger.js';

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
    const { storySessionId, tier } = pi.metadata;
    if (storySessionId) {
      await kv.set(`paid:${storySessionId}`, {
        paid: true,
        tier,
        paidAt: new Date().toISOString(),
      }, { ex: 86400 });

      // Admin logging: revenue
      const amount = pi.amount ? pi.amount / 100 : (tier === 'premium' ? 19.99 : 9.99);
      await logRevenue({
        status: 'succeeded',
        amount,
        tier,
        sessionId: storySessionId,
        stripeId: pi.id,
      }).catch(() => {});
    }
  }

  if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object;
    const { storySessionId, tier } = pi.metadata || {};
    await logRevenue({
      status: 'failed',
      amount: 0,
      tier,
      sessionId: storySessionId,
      stripeId: pi.id,
    }).catch(() => {});
  }

  res.json({ received: true });
}
