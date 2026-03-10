import { Request, Response } from 'express';
import { supabase } from '../lib/supabase';

export class UserController {
  static healthCheck(req: Request, res: Response) {
    res.json({ status: 'User service is running' });
  }

  static async createUser(req: Request, res: Response) {
    try {
      const { id, email, display_name } = req.body;

      if (!id || !email) {
        return res.status(400).json({ error: 'Missing required fields: id, email' });
      }

      const { data, error } = await supabase
        .from('profiles')
        .insert([{ id, email, display_name }])
        .select();

      if (error) {
        console.error('Error creating profile:', error);
        return res.status(400).json({ error: error.message });
      }

      res.status(201).json({ success: true, data });
    } catch (err: any) {
      console.error('Server error:', err);
      res.status(500).json({ error: err.message });
    }
  }
}
