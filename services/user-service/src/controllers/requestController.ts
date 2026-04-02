import { Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { RequestService } from '../services/requestService';

export class RequestController {
  static async getAdminRequests(req: Request, res: Response) {
    try {
      const data = await RequestService.getRequests('promote');
      res.json(data);
    } catch (err: any) {
      res.status(err.statusCode ?? 500).json({ error: err.message });
    }
  }

  static async requestAdmin(req: Request, res: Response) {
    try {
      const user_id = req.params.id as string;
      if (!user_id) return res.status(400).json({ error: 'Missing user_id' });
      await RequestService.createRequest(user_id, 'promote');
      res.status(201).json({ success: true });
    } catch (err: any) {
      res.status(err.statusCode ?? 500).json({ error: err.message });
    }
  }

  static async approveAdmin(req: Request, res: Response) {
    try {
      const user_id = req.params.id as string;
      await RequestService.resolveRequest(user_id, 'promote', true);
      res.status(200).json({ success: true });
    } catch (err: any) {
      res.status(err.statusCode ?? 500).json({ error: err.message });
    }
  }

  static async rejectAdmin(req: Request, res: Response) {
    try {
      const user_id = req.params.id as string;
      await RequestService.resolveRequest(user_id, 'promote', false);
      res.status(200).json({ success: true });
    } catch (err: any) {
      res.status(err.statusCode ?? 500).json({ error: err.message });
    }
  }

  static async getDemoteRequests(req: Request, res: Response) {
    try {
      const data = await RequestService.getRequests('demote');
      res.json(data);
    } catch (err: any) {
      res.status(err.statusCode ?? 500).json({ error: err.message });
    }
  }

  static async requestDemote(req: Request, res: Response) {
    try {
      const user_id = req.params.id as string;
      if (!user_id) return res.status(400).json({ error: 'Missing user_id' });
      await RequestService.createRequest(user_id, 'demote');
      res.status(201).json({ success: true });
    } catch (err: any) {
      res.status(err.statusCode ?? 500).json({ error: err.message });
    }
  }

  static async approveDemote(req: Request, res: Response) {
    try {
      const user_id = req.params.id as string;
      await RequestService.resolveRequest(user_id, 'demote', true);
      res.status(200).json({ success: true });
    } catch (err: any) {
      res.status(err.statusCode ?? 500).json({ error: err.message });
    }
  }

  static async rejectDemote(req: Request, res: Response) {
    try {
      const user_id = req.params.id as string;
      await RequestService.resolveRequest(user_id, 'demote', false);
      res.status(200).json({ success: true });
    } catch (err: any) {
      res.status(err.statusCode ?? 500).json({ error: err.message });
    }
  }
}
