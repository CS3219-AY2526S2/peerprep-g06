import { supabase } from '../lib/supabase';

export class RequestService {
  static async getRequests(type: 'promote' | 'demote') {
    const { data, error } = await supabase
      .from('admin_requests')
      .select(
        `
            id,
            type,
            status,
            created_at,
            profiles (
              id,
              email,
              display_name
            )
          `,
      )
      .eq('status', 'pending')
      .eq('type', type);

    if (error) throw error;

    return data;
  }

  static async createRequest(user_id: string, type: 'promote' | 'demote') {
    const existing = await supabase
      .from('admin_requests')
      .select('id')
      .eq('user_id', user_id)
      .eq('status', 'pending')
      .eq('type', type)
      .single();

    if (existing.data) throw { statusCode: 400, message: `Already requested ${type}` };

    const { error: requestError } = await supabase
      .from('admin_requests')
      .insert([{ user_id, type }]);
    if (requestError) throw requestError;

    const profileField = type === 'promote' ? 'is_requesting_admin' : 'is_requesting_demote';
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ [profileField]: true })
      .eq('id', user_id);
    if (profileError) throw profileError;
  }

  static async resolveRequest(request_id: string, type: 'promote' | 'demote', approved: boolean) {
    const { data: request, error: fetchError } = await supabase
      .from('admin_requests')
      .select('user_id')
      .eq('id', request_id)
      .eq('type', type)
      .single();

    if (fetchError || !request) throw { statusCode: 404, message: 'Request not found' };

    const { error: requestError } = await supabase
      .from('admin_requests')
      .update({ status: approved ? 'approved' : 'rejected' })
      .eq('id', request_id);
    if (requestError) throw requestError;

    const profileUpdate =
      type === 'promote'
        ? approved
          ? { role: 'admin', is_requesting_admin: false }
          : { is_requesting_admin: false }
        : approved
          ? { role: 'user', is_requesting_demote: false }
          : { is_requesting_demote: false };

    const { error: profileError } = await supabase
      .from('profiles')
      .update(profileUpdate)
      .eq('id', request.user_id);
    if (profileError) throw profileError;
  }
}
