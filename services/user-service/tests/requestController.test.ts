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

    // Suppress console.error logs
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

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

    it('should handle errors', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: null, error: new Error('DB error') }),
      } as any);

      await RequestController.getAdminRequests(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({ error: 'DB error' });
    });
  });

  describe('requestAdmin', () => {
    it('should create admin request successfully', async () => {
      mockRequest.params = { id: 'user123' };

      // Chain: .from().select().eq().eq().single()
      mockFrom
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        } as any)
        // .from().insert()
        .mockReturnValueOnce({
          insert: jest.fn().mockResolvedValue({ error: null }),
        } as any)
        // .from().update().eq()
        .mockReturnValueOnce({
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ error: null }),
        } as any);

      await RequestController.requestAdmin(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(201);
      expect(mockJson).toHaveBeenCalledWith({ success: true });
    });

    it('should return error if user_id missing', async () => {
      mockRequest.params = {};

      await RequestController.requestAdmin(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Missing user_id' });
    });

    it('should return error if already requested', async () => {
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
  });

  describe('approveAdmin', () => {
    it('should approve admin request', async () => {
      mockRequest.params = { id: 'request123' };

      // .from().select().eq().single()
      mockFrom
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: { user_id: 'user123' }, error: null }),
        } as any)
        // .from().update().eq()
        .mockReturnValueOnce({
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ error: null }),
        } as any)
        // .from().update().eq()
        .mockReturnValueOnce({
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ error: null }),
        } as any);

      await RequestController.approveAdmin(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({ success: true });
    });

    it('should return error if request not found', async () => {
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
  });

  describe('rejectAdmin', () => {
    it('should reject admin request', async () => {
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
  });
});
