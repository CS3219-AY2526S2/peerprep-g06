import { Request, Response } from 'express';
import { supabase } from '../lib/supabase';

export class RequestController {
  static async getAdminRequests(req: Request, res: Response) {
    try {
      const { data, error } = await supabase
        .from('admin_requests')
        .select(
          `
        id,
        status,
        created_at,
        profiles (
          id,
          email,
          display_name
        )
      `,
        )
        .eq('status', 'pending'); // ← only show pending ones

      if (error) throw error;

      res.json(data);
    } catch (err: any) {
      console.error('Server error:', err);
      res.status(500).json({ error: err.message });
    }
  }

  static async requestAdmin(req: Request, res: Response) {
    try {
      const { user_id } = req.body;

      if (!user_id) {
        return res.status(400).json({ error: 'Missing user_id' });
      }

      // Check if already requested
      const existing = await supabase
        .from('admin_requests')
        .select('id')
        .eq('user_id', user_id)
        .eq('status', 'pending')
        .single();

      if (existing.data) {
        return res.status(400).json({ error: 'Already requested admin access' });
      }

      // Insert into admin_requests
      const { error: requestError } = await supabase.from('admin_requests').insert([{ user_id }]);

      if (requestError) throw requestError;

      // Update profiles
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ is_requesting_admin: true })
        .eq('id', user_id);

      if (profileError) throw profileError;

      res.status(201).json({ success: true });
    } catch (err: any) {
      console.error('Server error:', err);
      res.status(500).json({ error: err.message });
    }
  }
}
