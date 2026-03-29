import { Request, Response, NextFunction } from 'express';
import { authenticate } from '../src/middleware/authMiddleware';

// ✅ Mock the Supabase module inline
jest.mock('../src/lib/supabase', () => {
  return {
    supabase: {
      auth: {
        getUser: jest.fn(),
      },
      from: jest.fn(),
    },
  };
});

// Import supabase AFTER jest.mock so TypeScript sees the mocked version
import { supabase } from '../src/lib/supabase';

describe('authMiddleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnThis();
    mockNext = jest.fn();
    mockRequest = {};
    mockResponse = { json: mockJson, status: mockStatus };
    jest.clearAllMocks();
  });

  describe('authenticate', () => {
    const middleware = authenticate('admin');

    it('should call next if authenticated and has correct role', async () => {
      mockRequest.headers = { authorization: 'Bearer token123' };

      // ✅ cast to jest.Mock
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: { id: 'user123' } },
        error: null,
      });

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockSingle = jest.fn().mockResolvedValue({ data: { role: 'admin' } });

      (supabase.from as jest.Mock).mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
      });

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 401 if no authorization header', async () => {
      mockRequest.headers = {};

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({ error: 'No authorization header' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 if invalid token', async () => {
      mockRequest.headers = { authorization: 'Bearer invalid' };

      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: null },
        error: new Error('Invalid token'),
      });

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Invalid token' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 if insufficient permissions', async () => {
      mockRequest.headers = { authorization: 'Bearer token123' };

      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: { id: 'user123' } },
        error: null,
      });

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockSingle = jest.fn().mockResolvedValue({ data: { role: 'user' } });

      (supabase.from as jest.Mock).mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
      });

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(403);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Insufficient permissions' });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
