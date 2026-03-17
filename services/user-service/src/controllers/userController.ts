import { Request, Response } from 'express';
import { supabase } from '../lib/supabase';

export class UserController {
  static healthCheck(req: Request, res: Response) {
    res.json({ status: 'User service is running' });
  }
}
