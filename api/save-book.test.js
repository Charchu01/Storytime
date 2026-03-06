import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase-admin before importing handler
vi.mock('./lib/supabase-admin.js', () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'user-123' } }),
      insert: vi.fn().mockReturnThis(),
    }),
    rpc: vi.fn().mockResolvedValue({}),
  },
}));

import handler from './save-book.js';

function mockReq(overrides = {}) {
  return {
    method: 'POST',
    body: {},
    ...overrides,
  };
}

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) { res.statusCode = code; return res; },
    json(data) { res.body = data; return res; },
  };
  return res;
}

describe('save-book handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 405 for non-POST methods', async () => {
    const req = mockReq({ method: 'GET' });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
    expect(res.body.error).toBe('Method not allowed');
  });

  it('returns 405 for PUT method', async () => {
    const req = mockReq({ method: 'PUT' });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
    expect(res.body.error).toBe('Method not allowed');
  });

  it('returns 400 when book data is missing', async () => {
    const req = mockReq({ body: { pages: [] } });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('book data required');
  });

  it('returns 400 when body is empty', async () => {
    const req = mockReq({ body: {} });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('book data required');
  });

  it('returns 400 when book is null', async () => {
    const req = mockReq({ body: { book: null } });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('book data required');
  });

  it('accepts valid POST with book data and returns bookId', async () => {
    const { supabaseAdmin } = await import('./lib/supabase-admin.js');

    // Mock the chain: from('books').insert(...).select('id').single()
    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: 'book-abc-123' },
      error: null,
    });
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });

    // Mock from('users') chain
    const mockUserSingle = vi.fn().mockResolvedValue({ data: null });
    const mockUserEq = vi.fn().mockReturnValue({ single: mockUserSingle });
    const mockUserSelect = vi.fn().mockReturnValue({ eq: mockUserEq });

    // Mock from('activity_log') chain
    const mockActivityInsert = vi.fn().mockResolvedValue({});

    supabaseAdmin.from.mockImplementation((table) => {
      if (table === 'books') return { insert: mockInsert };
      if (table === 'users') return { select: mockUserSelect };
      if (table === 'activity_log') return { insert: mockActivityInsert };
      if (table === 'book_pages') return { insert: vi.fn().mockResolvedValue({ error: null }) };
      return { insert: vi.fn().mockResolvedValue({}) };
    });

    const req = mockReq({
      body: {
        book: { title: 'My Story', tier: 'standard', style: 'watercolor' },
        pages: [{ page_type: 'cover', image_url: 'https://example.com/img.jpg' }],
      },
    });
    const res = mockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.bookId).toBe('book-abc-123');
  });
});
