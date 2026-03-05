import Stripe from 'stripe';

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const { tier, storySessionId } = req.body;

  if (!tier || !storySessionId) {
    return res.status(400).json({ error: 'tier and storySessionId are required' });
  }

  const amount = tier === 'premium' ? 1999 : 999;
  const description = tier === 'premium'
    ? 'StoriKids Premium Story (10 pages + Family Vault)'
    : 'StoriKids Standard Story (6 pages)';

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
    res.status(500).json({ error: err.message });
  }
}
