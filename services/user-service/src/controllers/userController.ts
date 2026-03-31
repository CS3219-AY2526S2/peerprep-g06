import { Request, Response } from 'express';
import { supabase } from '../lib/supabase';

export class UserController {
  static healthCheck(req: Request, res: Response) {
    res.json({ status: 'User service is running' });
  }

  static async getProfile(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id; // From auth middleware

      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();

      if (error) throw error;

      res.json(data);
    } catch (err: any) {
      console.error('Server error:', err);
      res.status(500).json({ error: err.message });
    }
  }
}
