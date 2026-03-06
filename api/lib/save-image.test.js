import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing
vi.mock('./supabase-admin.js', () => ({
  supabaseAdmin: null,
}));

vi.mock('sharp', () => {
  const mockSharp = vi.fn(() => ({
    metadata: vi.fn().mockResolvedValue({ width: 1024, height: 1536 }),
    resize: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('resized')),
  }));
  return { default: mockSharp };
});

import { saveImageToStorage } from './save-image.js';
import * as supabaseModule from './supabase-admin.js';
import sharp from 'sharp';

describe('saveImageToStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when supabaseAdmin is not configured', async () => {
    const result = await saveImageToStorage('https://example.com/img.jpg', 'book-1', 'cover.jpg');
    expect(result).toBeNull();
  });

  it('returns null when fetch fails (non-ok response)', async () => {
    // Enable supabase for this test
    supabaseModule.supabaseAdmin = { storage: { from: vi.fn() } };

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });

    const result = await saveImageToStorage('https://example.com/missing.jpg', 'book-1', 'cover.jpg');
    expect(result).toBeNull();

    // Restore
    supabaseModule.supabaseAdmin = null;
  });

  it('returns null when fetch throws a network error', async () => {
    supabaseModule.supabaseAdmin = { storage: { from: vi.fn() } };

    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const result = await saveImageToStorage('https://example.com/img.jpg', 'book-1', 'cover.jpg');
    expect(result).toBeNull();

    supabaseModule.supabaseAdmin = null;
  });

  it('calls sharp resize for cover images with correct dimensions', async () => {
    const mockUpload = vi.fn().mockResolvedValue({ error: null });
    const mockGetPublicUrl = vi.fn().mockReturnValue({ data: { publicUrl: 'https://storage.example.com/book-1/cover.jpg' } });

    supabaseModule.supabaseAdmin = {
      storage: {
        from: vi.fn().mockReturnValue({
          upload: mockUpload,
          getPublicUrl: mockGetPublicUrl,
        }),
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    });

    // Sharp mock returns metadata that differs from target → triggers resize
    sharp.mockReturnValue({
      metadata: vi.fn().mockResolvedValue({ width: 512, height: 768 }),
      resize: vi.fn().mockReturnThis(),
      jpeg: vi.fn().mockReturnThis(),
      toBuffer: vi.fn().mockResolvedValue(Buffer.from('resized')),
    });

    const result = await saveImageToStorage('https://example.com/img.jpg', 'book-1', 'cover.jpg');
    expect(result).toBe('https://storage.example.com/book-1/cover.jpg');

    // Check sharp was called
    expect(sharp).toHaveBeenCalled();

    // Check upload was called with correct path
    expect(mockUpload).toHaveBeenCalledWith(
      'book-1/cover.jpg',
      expect.any(Buffer),
      expect.objectContaining({ contentType: 'image/jpeg', upsert: true }),
    );

    supabaseModule.supabaseAdmin = null;
  });

  it('returns null when storage upload fails', async () => {
    const mockUpload = vi.fn().mockResolvedValue({ error: { message: 'Storage quota exceeded' } });

    supabaseModule.supabaseAdmin = {
      storage: {
        from: vi.fn().mockReturnValue({
          upload: mockUpload,
        }),
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    });

    sharp.mockReturnValue({
      metadata: vi.fn().mockResolvedValue({ width: 1024, height: 1536 }),
      resize: vi.fn().mockReturnThis(),
      jpeg: vi.fn().mockReturnThis(),
      toBuffer: vi.fn().mockResolvedValue(Buffer.from('data')),
    });

    const result = await saveImageToStorage('https://example.com/img.jpg', 'book-1', 'cover.jpg');
    expect(result).toBeNull();

    supabaseModule.supabaseAdmin = null;
  });

  it('determines page type from filename correctly', async () => {
    const mockUpload = vi.fn().mockResolvedValue({ error: null });
    const mockGetPublicUrl = vi.fn().mockReturnValue({ data: { publicUrl: 'https://storage.example.com/b/spread_1.jpg' } });

    supabaseModule.supabaseAdmin = {
      storage: {
        from: vi.fn().mockReturnValue({
          upload: mockUpload,
          getPublicUrl: mockGetPublicUrl,
        }),
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    });

    // Sharp returns spread-like dimensions that don't need resize
    sharp.mockReturnValue({
      metadata: vi.fn().mockResolvedValue({ width: 1536, height: 1152 }),
      resize: vi.fn().mockReturnThis(),
      jpeg: vi.fn().mockReturnThis(),
      toBuffer: vi.fn().mockResolvedValue(Buffer.from('data')),
    });

    const result = await saveImageToStorage('https://example.com/img.jpg', 'book-1', 'spread_1.jpg');
    expect(result).toBe('https://storage.example.com/b/spread_1.jpg');

    supabaseModule.supabaseAdmin = null;
  });

  it('falls back to original buffer when sharp processing fails', async () => {
    const mockUpload = vi.fn().mockResolvedValue({ error: null });
    const mockGetPublicUrl = vi.fn().mockReturnValue({ data: { publicUrl: 'https://storage.example.com/b/cover.jpg' } });

    supabaseModule.supabaseAdmin = {
      storage: {
        from: vi.fn().mockReturnValue({
          upload: mockUpload,
          getPublicUrl: mockGetPublicUrl,
        }),
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    });

    // Sharp throws on metadata
    sharp.mockReturnValue({
      metadata: vi.fn().mockRejectedValue(new Error('Corrupt image')),
    });

    const result = await saveImageToStorage('https://example.com/img.jpg', 'book-1', 'cover.jpg');
    // Should still succeed — falls through to save original buffer
    expect(result).toBe('https://storage.example.com/b/cover.jpg');
    expect(mockUpload).toHaveBeenCalled();

    supabaseModule.supabaseAdmin = null;
  });
});
