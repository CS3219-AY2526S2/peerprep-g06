import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'fs'

dotenv.config()

function readSecret(path: string, fallback?: string) {
  try {
    return fs.readFileSync(path, 'utf8').trim()
  } catch {
    return fallback
  }
}

const SUPABASE_URL = readSecret('/run/secrets/supabase_url', process.env.SUPABASE_URL)
const SUPABASE_SERVICE_ROLE_KEY = readSecret(
  '/run/secrets/supabase_service_role_key',
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase credentials')
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)