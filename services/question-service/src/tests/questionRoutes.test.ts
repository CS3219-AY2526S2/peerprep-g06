import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import questionRoutes from '../routes/questionRoutes'

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  },
}))

vi.mock('../middleware/authMiddleware', () => ({
  authenticate: vi.fn((_req: any, _res: any, next: any) => next()),
}))

import { supabase } from '../lib/supabase'

const app = express()
app.use(express.json())
app.use('/questions', questionRoutes)

beforeEach(() => vi.clearAllMocks())

describe('GET /questions', () => {
  it('returns all questions', async () => {
    const questions = [{ id: '1', title: 'Two Sum' }]
    vi.mocked(supabase.from).mockReturnValueOnce({
      select: vi.fn().mockResolvedValueOnce({ data: questions, error: null }),
    } as any)

    const res = await request(app).get('/questions')
    expect(res.status).toBe(200)
    expect(res.body).toEqual(questions)
  })

  it('returns 500 on DB error', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce({
      select: vi.fn().mockResolvedValueOnce({ data: null, error: { message: 'DB error' } }),
    } as any)

    const res = await request(app).get('/questions')
    expect(res.status).toBe(500)
  })
})

describe('GET /questions/random', () => {
  it('returns a random question', async () => {
    const questions = [{ id: '1' }, { id: '2' }]
    vi.mocked(supabase.from).mockReturnValueOnce({
      select: vi.fn().mockResolvedValueOnce({ data: questions, error: null }),
    } as any)

    const res = await request(app).get('/questions/random')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('id')
  })

  it('returns 404 when no questions exist', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce({
      select: vi.fn().mockResolvedValueOnce({ data: [], error: null }),
    } as any)

    const res = await request(app).get('/questions/random')
    expect(res.status).toBe(404)
  })
})

describe('GET /questions/random/:difficulty/:topic', () => {
  it('returns a filtered random question', async () => {
    const questions = [{ id: '1', difficulty: 'easy', topic: ['Arrays'] }]
    vi.mocked(supabase.from).mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      contains: vi.fn().mockResolvedValueOnce({ data: questions, error: null }),
    } as any)

    const res = await request(app).get('/questions/random/easy/Arrays')
    expect(res.status).toBe(200)
    expect(res.body).toEqual(questions[0])
  })

  it('returns 404 when no matching questions', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      contains: vi.fn().mockResolvedValueOnce({ data: [], error: null }),
    } as any)

    const res = await request(app).get('/questions/random/hard/Graphs')
    expect(res.status).toBe(404)
  })
})

describe('POST /questions/add', () => {
  it('creates a question and returns 201', async () => {
    const newQuestion = { id: '1', title: 'Two Sum' }
    vi.mocked(supabase.from).mockReturnValueOnce({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValueOnce({ data: [newQuestion], error: null }),
    } as any)

    const res = await request(app)
      .post('/questions/add')
      .send({ title: 'Two Sum' })

    expect(res.status).toBe(201)
    expect(res.body).toEqual([newQuestion])
  })

  it('returns 500 on insert error', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValueOnce({ data: null, error: { message: 'Insert failed' } }),
    } as any)

    const res = await request(app).post('/questions/add').send({})
    expect(res.status).toBe(500)
  })
})

describe('PUT /questions/:id/update', () => {
  it('updates a question', async () => {
    const updated = { id: '1', title: 'Updated' }
    vi.mocked(supabase.from).mockReturnValueOnce({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValueOnce({ data: [updated], error: null }),
    } as any)

    const res = await request(app)
      .put('/questions/1/update')
      .send({ title: 'Updated' })

    expect(res.status).toBe(200)
    expect(res.body).toEqual([updated])
  })

  it('returns 404 when question not found', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValueOnce({ data: [], error: null }),
    } as any)

    const res = await request(app).put('/questions/nonexistent/update').send({})
    expect(res.status).toBe(404)
  })
})

describe('DELETE /questions/:id/delete', () => {
  it('deletes a question', async () => {
    const deleted = { id: '1', title: 'Two Sum' }
    vi.mocked(supabase.from).mockReturnValueOnce({
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValueOnce({ data: deleted, error: null }),
    } as any)

    const res = await request(app).delete('/questions/1/delete')
    expect(res.status).toBe(200)
    expect(res.body).toEqual(deleted)
  })

  it('returns 404 when question not found', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce({
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValueOnce({ data: [], error: null }),
    } as any)

    const res = await request(app).delete('/questions/nonexistent/delete')
    expect(res.status).toBe(404)
  })
})