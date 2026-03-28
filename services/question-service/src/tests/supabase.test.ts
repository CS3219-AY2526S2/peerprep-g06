import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('fs')
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: vi.fn(), auth: { getUser: vi.fn() } })),
}))

import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

const mockReadFileSync = fs.readFileSync as ReturnType<typeof vi.fn>
const mockCreateClient = createClient as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('supabaseClient', () => {
  it('reads credentials from secret files when available', async () => {
    mockReadFileSync
      .mockReturnValueOnce('https://secret-url.supabase.co')
      .mockReturnValueOnce('secret-service-role-key')

    await import('../lib/supabase')

    expect(mockCreateClient).toHaveBeenCalledWith(
      'https://secret-url.supabase.co',
      'secret-service-role-key'
    )
  })

  it('falls back to environment variables when secret files are missing', async () => {
    mockReadFileSync.mockImplementation(() => {
      throw new Error('File not found')
    })

    vi.stubEnv('SUPABASE_URL', 'https://env-url.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'env-service-role-key')

    await import('../lib/supabase')

    expect(mockCreateClient).toHaveBeenCalledWith(
      'https://env-url.supabase.co',
      'env-service-role-key'
    )
  })

  it('throws when neither secret files nor environment variables are set', async () => {
    mockReadFileSync.mockImplementation(() => {
      throw new Error('File not found')
    })

    vi.stubEnv('SUPABASE_URL', '')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')

    await expect(import('../lib/supabase')).rejects.toThrow(
      'Missing Supabase credentials'
    )
  })

  it('exports a supabase client instance', async () => {
    mockReadFileSync
      .mockReturnValueOnce('https://secret-url.supabase.co')
      .mockReturnValueOnce('secret-service-role-key')

    const { supabase } = await import('../lib/supabase')

    expect(supabase).toBeDefined()
    expect(supabase.from).toBeDefined()
    expect(supabase.auth).toBeDefined()
  })
})