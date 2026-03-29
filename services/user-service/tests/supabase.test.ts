describe('Supabase Client', () => {
  const mockCreateClient = jest.fn();

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    jest.doMock('@supabase/supabase-js', () => ({
      createClient: mockCreateClient,
    }));

    // ✅ prevent dotenv from overriding env
    jest.doMock('dotenv', () => ({
      config: jest.fn(),
    }));

    process.env = {
      ...process.env,
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_KEY: 'test-key',
    };
  });

  it('should create supabase client with correct config', () => {
    require('../src/lib/supabase');

    expect(mockCreateClient).toHaveBeenCalledWith('https://test.supabase.co', 'test-key');
  });

  it('should throw error if env vars missing', () => {
    jest.resetModules();

    jest.doMock('dotenv', () => ({
      config: jest.fn(),
    }));

    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_KEY;

    expect(() => {
      require('../src/lib/supabase');
    }).toThrow('Missing Supabase environment variables');
  });
});
