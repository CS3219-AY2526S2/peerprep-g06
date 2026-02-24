import express from 'express'
import cors from 'cors'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'fs'

function readSecret(path: string, fallback?: string) {
  try {
    return fs.readFileSync(path, 'utf8').trim()
  } catch {
    return fallback
  }
}

dotenv.config() 

const app = express()
app.use(cors())
app.use(express.json())

const SUPABASE_URL =
  readSecret('/run/secrets/supabase_url', process.env.SUPABASE_URL)

const SUPABASE_SERVICE_ROLE_KEY =
  readSecret('/run/secrets/supabase_service_role_key', process.env.SUPABASE_SERVICE_ROLE_KEY)

// Supabase client
const supabase = createClient(
  SUPABASE_URL!,
  SUPABASE_SERVICE_ROLE_KEY!
)

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

// GET questions
app.get('/questions', async (_req, res) => {
  const { data, error } = await supabase
    .from('questions')
    .select('*')

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  res.json(data)
})

// POST question
app.post('/questions', async (req, res) => {
  const { data, error } = await supabase
    .from('questions')
    .insert(req.body)
    .select()

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  res.json(data)
})

const PORT = process.env.PORT || 3001

app.listen(PORT, () => {
  console.log(`Question service running on port ${PORT}`)
})
