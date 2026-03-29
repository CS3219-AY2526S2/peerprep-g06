import request from 'supertest';
import express from 'express';

// ✅ MUST mock BEFORE importing routes
jest.mock('../src/middleware/authMiddleware', () => ({
  authenticate: jest.fn(() => (req: any, res: any, next: any) => next()),
}));

jest.mock('../src/controllers/userController', () => ({
  UserController: {
    healthCheck: jest.fn(),
  },
}));

jest.mock('../src/controllers/requestController', () => ({
  RequestController: {
    requestAdmin: jest.fn(),
    getAdminRequests: jest.fn(),
    approveAdmin: jest.fn(),
    rejectAdmin: jest.fn(),
  },
}));

import userRoutes from '../src/routes/userRoutes';
import { UserController } from '../src/controllers/userController';
import { RequestController } from '../src/controllers/requestController';

describe('User Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/users', userRoutes);
    jest.clearAllMocks();
  });

  // ----------------------
  // HEALTH CHECK
  // ----------------------
  describe('GET /users/health', () => {
    it('should call UserController.healthCheck', async () => {
      (UserController.healthCheck as jest.Mock).mockImplementation((req, res) => {
        return res.json({ status: 'User service is running' });
      });

      const res = await request(app).get('/users/health');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'User service is running' });
      expect(UserController.healthCheck).toHaveBeenCalled();
    });
  });

  // ----------------------
  // REQUEST ADMIN
  // ----------------------
  describe('POST /users/:id/admin-request', () => {
    it('should call RequestController.requestAdmin', async () => {
      (RequestController.requestAdmin as jest.Mock).mockImplementation((req, res) => {
        return res.status(201).json({ success: true });
      });

      const res = await request(app).post('/users/123/admin-request');

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ success: true });
      expect(RequestController.requestAdmin).toHaveBeenCalled();
    });
  });

  // ----------------------
  // GET ADMIN REQUESTS (AUTH)
  // ----------------------
  describe('GET /users/admin-requests', () => {
    it('should call controller with auth middleware', async () => {
      (RequestController.getAdminRequests as jest.Mock).mockImplementation((req, res) => {
        return res.json([]);
      });

      const res = await request(app).get('/users/admin-requests');

      expect(res.status).toBe(200);
      expect(RequestController.getAdminRequests).toHaveBeenCalled();
    });
  });

  // ----------------------
  // APPROVE ADMIN
  // ----------------------
  describe('PATCH /users/admin-requests/:id/approve', () => {
    it('should call approveAdmin', async () => {
      (RequestController.approveAdmin as jest.Mock).mockImplementation((req, res) => {
        return res.status(200).json({ success: true });
      });

      const res = await request(app).patch('/users/admin-requests/123/approve');

      expect(res.status).toBe(200);
      expect(RequestController.approveAdmin).toHaveBeenCalled();
    });
  });

  // ----------------------
  // REJECT ADMIN
  // ----------------------
  describe('PATCH /users/admin-requests/:id/reject', () => {
    it('should call rejectAdmin', async () => {
      (RequestController.rejectAdmin as jest.Mock).mockImplementation((req, res) => {
        return res.status(200).json({ success: true });
      });

      const res = await request(app).patch('/users/admin-requests/123/reject');

      expect(res.status).toBe(200);
      expect(RequestController.rejectAdmin).toHaveBeenCalled();
    });
  });
});
