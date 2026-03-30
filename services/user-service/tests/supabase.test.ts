import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('Supabase Client', () => {
  const mockCreateClient = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    vi.doMock('@supabase/supabase-js', () => ({
      createClient: mockCreateClient,
    }));

    vi.doMock('dotenv', () => ({
      default: { config: vi.fn() },
    }));

    process.env = {
      ...process.env,
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_KEY: 'test-key',
    };
  });

  it('should create supabase client with correct config', async () => {
    const { supabase } = await import('../src/lib/supabase');
    expect(mockCreateClient).toHaveBeenCalledWith('https://test.supabase.co', 'test-key');
  });

  it('should throw error if env vars missing', async () => {
    vi.resetModules();
    vi.doMock('dotenv', () => ({ default: { config: vi.fn() } }));
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_KEY;
    await expect(() => import('../src/lib/supabase')).rejects.toThrow(
      'Missing Supabase environment variables',
    );
  });
});
