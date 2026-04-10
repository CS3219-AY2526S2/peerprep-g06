import { Request, Response } from 'express';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('../src/lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

import { UserController } from '../src/controllers/userController';
import { supabase } from '../src/lib/supabase';

const mockRes = () => {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

describe('UserController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('healthCheck', () => {
    it('should return status message', () => {
      const req = {} as Request;
      const res = mockRes();
      UserController.healthCheck(req, res);
      expect(res.json).toHaveBeenCalledWith({ status: 'User service is running' });
    });
  });

  describe('getProfile', () => {
    it('should return user profile when query succeeds', async () => {
      const req = { user: { id: 'user-123' } } as any as Request;
      const res = mockRes();

      const single = vi.fn().mockResolvedValue({
        data: { id: 'user-123', username: 'alice' },
        error: null,
      });
      const eq = vi.fn().mockReturnValue({ single });
      const select = vi.fn().mockReturnValue({ eq });
      (supabase.from as any).mockReturnValue({ select });

      await UserController.getProfile(req, res);

      expect(supabase.from).toHaveBeenCalledWith('profiles');
      expect(select).toHaveBeenCalledWith('*');
      expect(eq).toHaveBeenCalledWith('id', 'user-123');
      expect(single).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ id: 'user-123', username: 'alice' });
    });

    it('should return 500 when supabase returns an error', async () => {
      const req = { user: { id: 'user-123' } } as any as Request;
      const res = mockRes();
      vi.spyOn(console, 'error').mockImplementation(() => undefined);

      const single = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Query failed' },
      });
      const eq = vi.fn().mockReturnValue({ single });
      const select = vi.fn().mockReturnValue({ eq });
      (supabase.from as any).mockReturnValue({ select });

      await UserController.getProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Query failed' });
    });

    it('should return 500 when request is missing authenticated user', async () => {
      const req = {} as Request;
      const res = mockRes();
      vi.spyOn(console, 'error').mockImplementation(() => undefined);

      await UserController.getProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
    });
  });

  describe('getNameById', () => {
    it('should return display name when user exists', async () => {
      const req = { params: { userId: 'user-123' } } as any as Request;
      const res = mockRes();

      const single = vi.fn().mockResolvedValue({
        data: { display_name: 'Alice' },
        error: null,
      });
      const eq = vi.fn().mockReturnValue({ single });
      const select = vi.fn().mockReturnValue({ eq });
      (supabase.from as any).mockReturnValue({ select });

      await UserController.getNameById(req, res);

      expect(supabase.from).toHaveBeenCalledWith('profiles');
      expect(select).toHaveBeenCalledWith('display_name');
      expect(eq).toHaveBeenCalledWith('id', 'user-123');
      expect(res.json).toHaveBeenCalledWith({ name: 'Alice' });
    });

    it('should return 500 when supabase returns an error', async () => {
      const req = { params: { userId: 'user-123' } } as any as Request;
      const res = mockRes();
      vi.spyOn(console, 'error').mockImplementation(() => undefined);

      const single = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Query failed' },
      });
      const eq = vi.fn().mockReturnValue({ single });
      const select = vi.fn().mockReturnValue({ eq });
      (supabase.from as any).mockReturnValue({ select });

      await UserController.getNameById(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Query failed' });
    });

    it('should return 500 when userId param is missing', async () => {
      const req = { params: {} } as any as Request;
      const res = mockRes();
      vi.spyOn(console, 'error').mockImplementation(() => undefined);

      const single = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'invalid input' },
      });
      const eq = vi.fn().mockReturnValue({ single });
      const select = vi.fn().mockReturnValue({ eq });
      (supabase.from as any).mockReturnValue({ select });

      await UserController.getNameById(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
