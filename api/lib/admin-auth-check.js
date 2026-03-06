/**
 * Shared admin authentication check.
 * Returns { authorized: true, method } on success, { authorized: false } on failure.
 * Fails closed: if no auth credentials are configured, access is DENIED.
 */
export function checkAdminAuth(req) {
  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
  const adminPassword = process.env.ADMIN_PASSWORD || '';

  // If nothing is configured, deny access — never fail open
  if (!adminEmails.length && !adminPassword) {
    return { authorized: false };
  }

  // Check Authorization header for Bearer token matching ADMIN_PASSWORD
  if (adminPassword) {
    const authHeader = req.headers?.authorization || '';
    if (authHeader.startsWith('Bearer ') && authHeader.slice(7) === adminPassword) {
      return { authorized: true, method: 'bearer' };
    }
  }

  // Check x-admin-email header (set by client after login) against ADMIN_EMAILS
  if (adminEmails.length) {
    const emailHeader = (req.headers?.['x-admin-email'] || '').trim().toLowerCase();
    if (emailHeader && adminEmails.includes(emailHeader)) {
      return { authorized: true, method: 'email' };
    }
  }

  // Check request body for email/password (used by the login endpoint)
  const body = req.body || {};
  if (adminEmails.length && body.email && adminEmails.includes(body.email.toLowerCase().trim())) {
    return { authorized: true, method: 'email' };
  }
  if (adminPassword && body.password && body.password === adminPassword) {
    return { authorized: true, method: 'password' };
  }

  return { authorized: false };
}
