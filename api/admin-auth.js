export const config = { maxDuration: 10 };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body || {};

  // Check against ADMIN_EMAILS env var (comma-separated list)
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  if (email && adminEmails.includes(email.toLowerCase())) {
    return res.json({ authorized: true, method: 'email' });
  }

  // Fallback: check password against ADMIN_PASSWORD env var
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminPassword && password === adminPassword) {
    return res.json({ authorized: true, method: 'password' });
  }

  // If no auth is configured, allow access (development mode)
  if (!adminEmails.length && !adminPassword) {
    return res.json({ authorized: true, method: 'none' });
  }

  return res.status(401).json({ authorized: false, error: 'Unauthorized' });
}
