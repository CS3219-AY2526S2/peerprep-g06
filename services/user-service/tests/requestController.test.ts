import { Request, Response } from 'express';
import { RequestController } from '../src/controllers/requestController';
import { supabase } from '../src/lib/supabase';
import { vi, describe, it, expect, beforeEach, type Mock } from 'vitest';

vi.mock('../src/lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

const mockFrom = supabase.from as Mock;

const mockRes = () => {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('RequestController', () => {
  describe('getAdminRequests', () => {
    it('should return pending admin requests', async () => {
      const mockData = [{ id: 1, status: 'pending' }];
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: mockData, error: null }),
          }),
        }),
      });
      const req = {} as Request;
      const res = mockRes();
      await RequestController.getAdminRequests(req, res);
      expect(res.json).toHaveBeenCalledWith(mockData);
    });

    it('should return requests with nested profiles shape', async () => {
      const mockData = [
        {
          id: 1,
          status: 'pending',
          created_at: '2024-01-01',
          profiles: { id: 'user1', email: 'a@b.com', display_name: 'Alice' },
        },
      ];
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: mockData, error: null }),
          }),
        }),
      });
      const req = {} as Request;
      const res = mockRes();
      await RequestController.getAdminRequests(req, res);
      expect(res.json).toHaveBeenCalledWith(mockData);
    });

    it('should handle DB errors with 500', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: new Error('DB error') }),
          }),
        }),
      });
      const req = {} as Request;
      const res = mockRes();
      await RequestController.getAdminRequests(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'DB error' });
    });
  });

  describe('requestAdmin', () => {
    it('should create admin request successfully', async () => {
      const req = { params: { id: 'user123' } } as unknown as Request;
      const res = mockRes();
      mockFrom
        .mockReturnValueOnce({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        })
        .mockReturnValueOnce({ insert: vi.fn().mockResolvedValue({ error: null }) })
        .mockReturnValueOnce({
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ error: null }),
        });
      await RequestController.requestAdmin(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('should return 400 if user_id is missing', async () => {
      const req = { params: {} } as unknown as Request;
      const res = mockRes();
      await RequestController.requestAdmin(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Missing user_id' });
    });

    it('should return 400 if already requested', async () => {
      const req = { params: { id: 'user123' } } as unknown as Request;
      const res = mockRes();
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 1 }, error: null }),
      });
      await RequestController.requestAdmin(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Already requested admin access' });
    });

    it('should return 500 if insert into admin_requests fails', async () => {
      const req = { params: { id: 'user123' } } as unknown as Request;
      const res = mockRes();
      mockFrom
        .mockReturnValueOnce({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        })
        .mockReturnValueOnce({
          insert: vi.fn().mockResolvedValue({ error: new Error('Insert failed') }),
        });
      await RequestController.requestAdmin(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Insert failed' });
    });

    it('should return 500 if updating profiles fails', async () => {
      const req = { params: { id: 'user123' } } as unknown as Request;
      const res = mockRes();
      mockFrom
        .mockReturnValueOnce({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        })
        .mockReturnValueOnce({ insert: vi.fn().mockResolvedValue({ error: null }) })
        .mockReturnValueOnce({
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ error: new Error('Profile update failed') }),
        });
      await RequestController.requestAdmin(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Profile update failed' });
    });
  });

  describe('approveAdmin', () => {
    it('should approve admin request successfully', async () => {
      const req = { params: { id: 'request123' } } as unknown as Request;
      const res = mockRes();
      mockFrom
        .mockReturnValueOnce({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { user_id: 'user123' }, error: null }),
        })
        .mockReturnValueOnce({
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ error: null }),
        })
        .mockReturnValueOnce({
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ error: null }),
        });
      await RequestController.approveAdmin(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('should return 404 if request not found', async () => {
      const req = { params: { id: 'request123' } } as unknown as Request;
      const res = mockRes();
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: new Error('Not found') }),
      });
      await RequestController.approveAdmin(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Request not found' });
    });

    it('should return 404 if fetch succeeds but data is null', async () => {
      const req = { params: { id: 'request123' } } as unknown as Request;
      const res = mockRes();
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      });
      await RequestController.approveAdmin(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Request not found' });
    });

    it('should return 500 if updating admin_requests status fails', async () => {
      const req = { params: { id: 'request123' } } as unknown as Request;
      const res = mockRes();
      mockFrom
        .mockReturnValueOnce({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { user_id: 'user123' }, error: null }),
        })
        .mockReturnValueOnce({
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ error: new Error('Status update failed') }),
        });
      await RequestController.approveAdmin(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Status update failed' });
    });

    it('should return 500 if updating profile role fails', async () => {
      const req = { params: { id: 'request123' } } as unknown as Request;
      const res = mockRes();
      mockFrom
        .mockReturnValueOnce({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { user_id: 'user123' }, error: null }),
        })
        .mockReturnValueOnce({
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ error: null }),
        })
        .mockReturnValueOnce({
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ error: new Error('Role update failed') }),
        });
      await RequestController.approveAdmin(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Role update failed' });
    });
  });

  describe('rejectAdmin', () => {
    it('should reject admin request successfully', async () => {
      const req = { params: { id: 'request123' } } as unknown as Request;
      const res = mockRes();
      mockFrom
        .mockReturnValueOnce({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { user_id: 'user123' }, error: null }),
        })
        .mockReturnValueOnce({
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ error: null }),
        })
        .mockReturnValueOnce({
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ error: null }),
        });
      await RequestController.rejectAdmin(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('should return 404 if request not found', async () => {
      const req = { params: { id: 'request123' } } as unknown as Request;
      const res = mockRes();
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: new Error('Not found') }),
      });
      await RequestController.rejectAdmin(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Request not found' });
    });

    it('should return 404 if fetch succeeds but data is null', async () => {
      const req = { params: { id: 'request123' } } as unknown as Request;
      const res = mockRes();
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      });
      await RequestController.rejectAdmin(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Request not found' });
    });

    it('should return 500 if updating request status fails', async () => {
      const req = { params: { id: 'request123' } } as unknown as Request;
      const res = mockRes();
      mockFrom
        .mockReturnValueOnce({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { user_id: 'user123' }, error: null }),
        })
        .mockReturnValueOnce({
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ error: new Error('Reject status failed') }),
        });
      await RequestController.rejectAdmin(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Reject status failed' });
    });

    it('should return 500 if updating profile fails', async () => {
      const req = { params: { id: 'request123' } } as unknown as Request;
      const res = mockRes();
      mockFrom
        .mockReturnValueOnce({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { user_id: 'user123' }, error: null }),
        })
        .mockReturnValueOnce({
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ error: null }),
        })
        .mockReturnValueOnce({
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ error: new Error('Profile reset failed') }),
        });
      await RequestController.rejectAdmin(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Profile reset failed' });
    });
  });
});
