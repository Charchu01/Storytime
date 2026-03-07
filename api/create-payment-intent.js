import Stripe from 'stripe';
import { rateLimit } from './lib/rate-limiter.js';

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const rl = rateLimit(req, { key: 'create-payment', limit: 10, windowMs: 60000 });
  if (!rl.allowed) {
    res.setHeader('Retry-After', Math.ceil((rl.resetAt - Date.now()) / 1000));
    return res.status(429).json({ error: 'Too many requests. Please try again in a moment.' });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'STRIPE_SECRET_KEY not configured' });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const { tier, storySessionId } = req.body;

  if (!tier || !storySessionId) {
    return res.status(400).json({ error: 'tier and storySessionId are required' });
  }
  if (tier !== 'standard' && tier !== 'premium') {
    return res.status(400).json({ error: 'tier must be "standard" or "premium"' });
  }

  const amount = tier === 'premium' ? 1999 : 999;
  const description = tier === 'premium'
    ? 'Storytime Premium Story (10 pages + Family Vault)'
    : 'Storytime Standard Story (6 pages)';

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      description,
      metadata: { tier, storySessionId },
    });
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error('create-payment-intent error:', err);
    res.status(500).json({ error: 'Payment setup failed. Please try again.' });
  }
}
