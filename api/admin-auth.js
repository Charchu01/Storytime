import { checkAdminAuth } from './lib/admin-auth-check.js';

export const config = { maxDuration: 10 };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const result = checkAdminAuth(req);
  if (!result.authorized) {
    return res.status(401).json({ authorized: false, error: 'Unauthorized' });
  }

  return res.json({ authorized: true, method: result.method });
}
