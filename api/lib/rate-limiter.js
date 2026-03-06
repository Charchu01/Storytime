/**
 * In-memory sliding-window rate limiter for Vercel serverless functions.
 *
 * Why in-memory instead of Supabase:
 * - Zero latency — no DB round-trip on every request
 * - No extra cost — doesn't consume Supabase quota
 * - Good enough — on Vercel, a single instance handles bursts from one IP;
 *   even across cold starts, the most common abuse pattern (one IP hammering
 *   an endpoint) is caught within each instance's lifetime.
 * - Graceful — worst case on instance recycle is a brief window reset,
 *   not an open door.
 */

const windows = new Map();

// Clean up stale entries every 5 minutes to prevent memory leaks
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup(now) {
  for (const [key, entry] of windows) {
    if (now - entry.windowStart > entry.windowMs * 2) {
      windows.delete(key);
    }
  }
  lastCleanup = now;
}

/**
 * @param {object} req - Vercel request object
 * @param {{ key: string, limit: number, windowMs: number }} opts
 * @returns {{ allowed: boolean, remaining: number, resetAt: number }}
 */
export function rateLimit(req, { key, limit, windowMs }) {
  const now = Date.now();

  // Periodic cleanup
  if (now - lastCleanup > CLEANUP_INTERVAL_MS) {
    cleanup(now);
  }

  const ip = extractIp(req);
  const mapKey = `${ip}:${key}`;
  const entry = windows.get(mapKey);

  if (!entry || now - entry.windowStart >= windowMs) {
    // New window
    windows.set(mapKey, { count: 1, windowStart: now, windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  // Existing window
  entry.count += 1;
  const resetAt = entry.windowStart + windowMs;

  if (entry.count > limit) {
    return { allowed: false, remaining: 0, resetAt };
  }

  return { allowed: true, remaining: limit - entry.count, resetAt };
}

function extractIp(req) {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (forwarded) {
    // x-forwarded-for can be comma-separated; first value is the client
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}
