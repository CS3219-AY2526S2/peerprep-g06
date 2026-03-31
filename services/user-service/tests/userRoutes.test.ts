import { vi, describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

vi.mock('../src/middleware/authMiddleware', () => ({
  authenticate: vi.fn(() => (req: any, res: any, next: any) => next()),
}));

vi.mock('../src/controllers/userController', () => ({
  UserController: { healthCheck: vi.fn(), getProfile: vi.fn() },
}));

vi.mock('../src/controllers/requestController', () => ({
  RequestController: {
    requestAdmin: vi.fn(),
    getAdminRequests: vi.fn(),
    approveAdmin: vi.fn(),
    rejectAdmin: vi.fn(),
    requestDemote: vi.fn(),
    getDemoteRequests: vi.fn(),
    approveDemote: vi.fn(),
    rejectDemote: vi.fn(),
  },
}));

import userRoutes from '../src/routes/userRoutes';
import { UserController } from '../src/controllers/userController';
import { RequestController } from '../src/controllers/requestController';
import type { Mock } from 'vitest';

describe('User Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/users', userRoutes);
    vi.clearAllMocks();
  });

  describe('GET /users/health', () => {
    it('should call UserController.healthCheck', async () => {
      (UserController.healthCheck as Mock).mockImplementation((req, res) =>
        res.json({ status: 'User service is running' }),
      );
      const res = await request(app).get('/users/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'User service is running' });
      expect(UserController.healthCheck).toHaveBeenCalled();
    });
  });

  describe('POST /users/:id/admin-request', () => {
    it('should call RequestController.requestAdmin', async () => {
      (RequestController.requestAdmin as Mock).mockImplementation((req, res) =>
        res.status(201).json({ success: true }),
      );
      const res = await request(app).post('/users/123/admin-request');
      expect(res.status).toBe(201);
      expect(res.body).toEqual({ success: true });
      expect(RequestController.requestAdmin).toHaveBeenCalled();
    });
  });

  describe('GET /users/admin-requests', () => {
    it('should call controller with auth middleware', async () => {
      (RequestController.getAdminRequests as Mock).mockImplementation((req, res) => res.json([]));
      const res = await request(app).get('/users/admin-requests');
      expect(res.status).toBe(200);
      expect(RequestController.getAdminRequests).toHaveBeenCalled();
    });
  });

  describe('PATCH /users/admin-requests/:id/approve', () => {
    it('should call approveAdmin', async () => {
      (RequestController.approveAdmin as Mock).mockImplementation((req, res) =>
        res.status(200).json({ success: true }),
      );
      const res = await request(app).patch('/users/admin-requests/123/approve');
      expect(res.status).toBe(200);
      expect(RequestController.approveAdmin).toHaveBeenCalled();
    });
  });

  describe('PATCH /users/admin-requests/:id/reject', () => {
    it('should call rejectAdmin', async () => {
      (RequestController.rejectAdmin as Mock).mockImplementation((req, res) =>
        res.status(200).json({ success: true }),
      );
      const res = await request(app).patch('/users/admin-requests/123/reject');
      expect(res.status).toBe(200);
      expect(RequestController.rejectAdmin).toHaveBeenCalled();
    });
  });
});
