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
      const { id: user_id } = req.params;

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

  static async approveAdmin(req: Request, res: Response) {
    try {
      const { id: request_id } = req.params;

      // Get the user_id from the request
      const { data: request, error: fetchError } = await supabase
        .from('admin_requests')
        .select('user_id')
        .eq('id', request_id)
        .single();

      if (fetchError || !request) {
        return res.status(404).json({ error: 'Request not found' });
      }

      // Update admin_requests status
      const { error: requestError } = await supabase
        .from('admin_requests')
        .update({ status: 'approved' })
        .eq('id', request_id);

      if (requestError) throw requestError;

      // Update profiles role to admin
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ role: 'admin', is_requesting_admin: false })
        .eq('id', request.user_id);

      if (profileError) throw profileError;

      res.status(200).json({ success: true });
    } catch (err: any) {
      console.error('Server error:', err);
      res.status(500).json({ error: err.message });
    }
  }
}
