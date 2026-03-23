// Minimal Supabase auth helper used to verify notification sockets.
// We call the Auth API directly with the service key instead of pulling user-service into this service.
import { config } from '../config/env';

interface SupabaseUserResponse {
  id: string;
  email?: string;
}

export async function getSupabaseUser(accessToken: string): Promise<SupabaseUserResponse | null> {
  if (!config.supabase.url || !config.supabase.serviceKey) {
    throw new Error('Missing Supabase environment variables for collaboration-service');
  }

  const response = await fetch(`${config.supabase.url}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: config.supabase.serviceKey,
    },
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as SupabaseUserResponse;
}
