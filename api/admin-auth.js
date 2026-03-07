import { checkAdminAuth } from './lib/admin-auth-check.js';
import { rateLimit } from './lib/rate-limiter.js';

export const config = { maxDuration: 10 };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Tight rate limit on auth endpoint to prevent brute-force attacks
  const rl = rateLimit(req, { key: 'admin-auth', limit: 5, windowMs: 60000 });
  if (!rl.allowed) {
    res.setHeader('Retry-After', Math.ceil((rl.resetAt - Date.now()) / 1000));
    return res.status(429).json({
      error: 'Too many login attempts. Please try again later.',
      retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000),
    });
  }

  const result = checkAdminAuth(req);
  if (!result.authorized) {
    return res.status(401).json({ authorized: false, error: 'Unauthorized' });
  }

  return res.json({ authorized: true, method: result.method });
}
