import { Request, Response } from 'express';
import { RequestController } from '../src/controllers/requestController';
import { supabase } from '../src/lib/supabase';

jest.mock('../src/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

const mockFrom = supabase.from as jest.Mock;

describe('RequestController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnThis();
    mockRequest = {};
    mockResponse = {
      json: mockJson,
      status: mockStatus,
    };
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  // ─── getAdminRequests ────────────────────────────────────────────────────────

  describe('getAdminRequests', () => {
    it('should return pending admin requests', async () => {
      const mockData = [{ id: 1, status: 'pending' }];

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: mockData, error: null }),
      } as any);

      await RequestController.getAdminRequests(mockRequest as Request, mockResponse as Response);

      expect(mockJson).toHaveBeenCalledWith(mockData);
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
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: mockData, error: null }),
      } as any);

      await RequestController.getAdminRequests(mockRequest as Request, mockResponse as Response);

      expect(mockJson).toHaveBeenCalledWith(mockData);
    });

    it('should handle DB errors with 500', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: null, error: new Error('DB error') }),
      } as any);

      await RequestController.getAdminRequests(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({ error: 'DB error' });
    });
  });

  // ─── requestAdmin ────────────────────────────────────────────────────────────

  describe('requestAdmin', () => {
    it('should create admin request successfully', async () => {
      mockRequest.params = { id: 'user123' };

      mockFrom
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        } as any)
        .mockReturnValueOnce({
          insert: jest.fn().mockResolvedValue({ error: null }),
        } as any)
        .mockReturnValueOnce({
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ error: null }),
        } as any);

      await RequestController.requestAdmin(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(201);
      expect(mockJson).toHaveBeenCalledWith({ success: true });
    });

    it('should return 400 if user_id is missing', async () => {
      mockRequest.params = {};

      await RequestController.requestAdmin(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Missing user_id' });
    });

    it('should return 400 if already requested', async () => {
      mockRequest.params = { id: 'user123' };

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { id: 1 }, error: null }),
      } as any);

      await RequestController.requestAdmin(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Already requested admin access' });
    });

    it('should return 500 if insert into admin_requests fails', async () => {
      mockRequest.params = { id: 'user123' };

      mockFrom
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        } as any)
        .mockReturnValueOnce({
          insert: jest.fn().mockResolvedValue({ error: new Error('Insert failed') }),
        } as any);

      await RequestController.requestAdmin(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Insert failed' });
    });

    it('should return 500 if updating profiles fails', async () => {
      mockRequest.params = { id: 'user123' };

      mockFrom
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        } as any)
        .mockReturnValueOnce({
          insert: jest.fn().mockResolvedValue({ error: null }),
        } as any)
        .mockReturnValueOnce({
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ error: new Error('Profile update failed') }),
        } as any);

      await RequestController.requestAdmin(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Profile update failed' });
    });
  });

  // ─── approveAdmin ────────────────────────────────────────────────────────────

  describe('approveAdmin', () => {
    it('should approve admin request successfully', async () => {
      mockRequest.params = { id: 'request123' };

      mockFrom
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: { user_id: 'user123' }, error: null }),
        } as any)
        .mockReturnValueOnce({
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ error: null }),
        } as any)
        .mockReturnValueOnce({
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ error: null }),
        } as any);

      await RequestController.approveAdmin(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({ success: true });
    });

    it('should return 404 if request not found', async () => {
      mockRequest.params = { id: 'request123' };

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: new Error('Not found') }),
      } as any);

      await RequestController.approveAdmin(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Request not found' });
    });

    it('should return 404 if fetch succeeds but data is null', async () => {
      mockRequest.params = { id: 'request123' };

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      } as any);

      await RequestController.approveAdmin(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Request not found' });
    });

    it('should return 500 if updating admin_requests status fails', async () => {
      mockRequest.params = { id: 'request123' };

      mockFrom
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: { user_id: 'user123' }, error: null }),
        } as any)
        .mockReturnValueOnce({
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ error: new Error('Status update failed') }),
        } as any);

      await RequestController.approveAdmin(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Status update failed' });
    });

    it('should return 500 if updating profile role fails', async () => {
      mockRequest.params = { id: 'request123' };

      mockFrom
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: { user_id: 'user123' }, error: null }),
        } as any)
        .mockReturnValueOnce({
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ error: null }),
        } as any)
        .mockReturnValueOnce({
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ error: new Error('Role update failed') }),
        } as any);

      await RequestController.approveAdmin(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Role update failed' });
    });
  });

  // ─── rejectAdmin ─────────────────────────────────────────────────────────────

  describe('rejectAdmin', () => {
    it('should reject admin request successfully', async () => {
      mockRequest.params = { id: 'request123' };

      mockFrom
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: { user_id: 'user123' }, error: null }),
        } as any)
        .mockReturnValueOnce({
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ error: null }),
        } as any)
        .mockReturnValueOnce({
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ error: null }),
        } as any);

      await RequestController.rejectAdmin(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({ success: true });
    });

    it('should return 404 if request not found', async () => {
      mockRequest.params = { id: 'request123' };

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: new Error('Not found') }),
      } as any);

      await RequestController.rejectAdmin(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Request not found' });
    });

    it('should return 404 if fetch succeeds but data is null', async () => {
      mockRequest.params = { id: 'request123' };

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      } as any);

      await RequestController.rejectAdmin(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Request not found' });
    });

    it('should return 500 if updating request status fails', async () => {
      mockRequest.params = { id: 'request123' };

      mockFrom
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: { user_id: 'user123' }, error: null }),
        } as any)
        .mockReturnValueOnce({
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ error: new Error('Reject status failed') }),
        } as any);

      await RequestController.rejectAdmin(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Reject status failed' });
    });

    it('should return 500 if updating profile fails', async () => {
      mockRequest.params = { id: 'request123' };

      mockFrom
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: { user_id: 'user123' }, error: null }),
        } as any)
        .mockReturnValueOnce({
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ error: null }),
        } as any)
        .mockReturnValueOnce({
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ error: new Error('Profile reset failed') }),
        } as any);

      await RequestController.rejectAdmin(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Profile reset failed' });
    });
  });
});
