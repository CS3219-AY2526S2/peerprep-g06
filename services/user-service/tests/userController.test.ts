import { Request, Response } from 'express';
import { UserController } from '../src/controllers/userController';
import { vi, describe, it, expect } from 'vitest';

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
