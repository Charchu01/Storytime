import { timingSafeEqual } from 'crypto';

/**
 * Constant-time string comparison to prevent timing attacks.
 * Returns true if both strings are equal, false otherwise.
 */
function safeCompare(a, b) {
  if (!a || !b) return false;
  try {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

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
    if (authHeader.startsWith('Bearer ') && safeCompare(authHeader.slice(7), adminPassword)) {
      return { authorized: true, method: 'bearer' };
    }
  }

  // Check x-admin-email header (set by client after login) against ADMIN_EMAILS
  // Requires BOTH a valid email AND the correct password to prevent header spoofing
  if (adminEmails.length && adminPassword) {
    const emailHeader = (req.headers?.['x-admin-email'] || '').trim().toLowerCase();
    const passwordHeader = req.headers?.['x-admin-password'] || '';
    if (emailHeader && adminEmails.includes(emailHeader) && safeCompare(passwordHeader, adminPassword)) {
      return { authorized: true, method: 'email' };
    }
  }

  // Check request body for email+password (used by the login endpoint)
  const body = req.body || {};
  if (adminEmails.length && adminPassword && body.email && body.password
    && adminEmails.includes(body.email.toLowerCase().trim())
    && safeCompare(body.password, adminPassword)) {
    return { authorized: true, method: 'email' };
  }
  if (adminPassword && body.password && safeCompare(body.password, adminPassword)) {
    return { authorized: true, method: 'password' };
  }

  return { authorized: false };
}
