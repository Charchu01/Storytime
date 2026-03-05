import Stripe from 'stripe';
import { kv } from '@vercel/kv';
import getRawBody from 'raw-body';

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
    const { storySessionId, tier } = event.data.object.metadata;
    if (storySessionId) {
      await kv.set(`paid:${storySessionId}`, {
        paid: true,
        tier,
        paidAt: new Date().toISOString(),
      }, { ex: 86400 });
    }
  }

  res.json({ received: true });
}
