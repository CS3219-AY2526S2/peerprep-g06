import { Request, Response } from 'express';
import { vi, describe, it, expect } from 'vitest';

vi.mock('../src/lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

import { UserController } from '../src/controllers/userController';

const mockRes = () => {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

describe('UserController', () => {
  describe('healthCheck', () => {
    it('should return status message', () => {
      const req = {} as Request;
      const res = mockRes();
      UserController.healthCheck(req, res);
      expect(res.json).toHaveBeenCalledWith({ status: 'User service is running' });
    });
  });
});
