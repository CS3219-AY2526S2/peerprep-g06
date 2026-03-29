import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { authenticate } from '../src/middleware/authMiddleware';

vi.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  },
}));

import { supabase } from '../src/lib/supabase';

const mockRes = () => {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

const mockNext: NextFunction = vi.fn();

beforeEach(() => vi.clearAllMocks());

describe('authenticate middleware', () => {
  const middleware = authenticate('admin');

  it('returns 401 if no authorization header', async () => {
    const req = { headers: {} } as Request;
    const res = mockRes();
    await middleware(req, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'No authorization header' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('returns 401 if token is invalid', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Invalid JWT' },
    } as any);

    const req = { headers: { authorization: 'Bearer badtoken' } } as Request;
    const res = mockRes();
    await middleware(req, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('returns 403 if insufficient permissions', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
      data: { user: { id: 'user-123' } },
      error: null,
    } as any);

    vi.mocked(supabase.from).mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValueOnce({ data: { role: 'user' }, error: null }),
    } as any);

    const req = { headers: { authorization: 'Bearer validtoken' } } as Request;
    const res = mockRes();
    await middleware(req, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Insufficient permissions' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('calls next() if user has correct role', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
      data: { user: { id: 'user-123' } },
      error: null,
    } as any);

    vi.mocked(supabase.from).mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValueOnce({ data: { role: 'admin' }, error: null }),
    } as any);

    const req = { headers: { authorization: 'Bearer validtoken' } } as Request;
    const res = mockRes();
    await middleware(req, res, mockNext);
    expect(mockNext).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
