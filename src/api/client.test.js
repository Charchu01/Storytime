import { describe, it, expect } from 'vitest';
import { friendlyError } from './client.js';

describe('friendlyError', () => {
  it('returns rate limit message for 429', () => {
    const msg = friendlyError(429);
    expect(msg).toContain('busy');
    expect(msg).toContain('Trying again');
  });

  it('returns server error message for 500', () => {
    const msg = friendlyError(500);
    expect(msg).toContain('Something went wrong on our end');
  });

  it('returns configuration message for 403', () => {
    const msg = friendlyError(403);
    expect(msg).toContain('configuration issue');
    expect(msg).toContain('contact support');
  });

  it('returns fallback when provided for unknown status', () => {
    const msg = friendlyError(418, 'Custom fallback message');
    expect(msg).toBe('Custom fallback message');
  });

  it('returns default fallback for unknown status with no fallback', () => {
    const msg = friendlyError(418);
    expect(msg).toContain('Something went wrong');
  });

  it('returns default fallback for undefined status', () => {
    const msg = friendlyError(undefined);
    expect(msg).toContain('Something went wrong');
  });

  it('prefers status-specific message over fallback for 429', () => {
    const msg = friendlyError(429, 'This should be ignored');
    expect(msg).toContain('busy');
    expect(msg).not.toBe('This should be ignored');
  });

  it('prefers status-specific message over fallback for 500', () => {
    const msg = friendlyError(500, 'This should be ignored');
    expect(msg).toContain('Something went wrong on our end');
  });

  it('prefers status-specific message over fallback for 403', () => {
    const msg = friendlyError(403, 'This should be ignored');
    expect(msg).toContain('configuration issue');
  });
});
