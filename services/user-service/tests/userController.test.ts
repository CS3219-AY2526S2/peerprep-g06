import { Request, Response } from 'express';
import { UserController } from '../src/controllers/userController';

describe('UserController', () => {
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
  });

  describe('healthCheck', () => {
    it('should return status message', () => {
      UserController.healthCheck(mockRequest as Request, mockResponse as Response);

      expect(mockJson).toHaveBeenCalledWith({ status: 'User service is running' });
    });
  });
});
