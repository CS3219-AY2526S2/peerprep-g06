import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Request, Response } from 'express'
import {
  getAllQuestions,
  getRandomQuestion,
  getRandomQuestionByFilter,
  addQuestion,
  updateQuestion,
  deleteQuestion,
} from '../controllers/questionController'

vi.mock('../lib/supabase', () => {
  const builder = () => {
    const chain: any = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      contains: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
    }
    return chain
  }
  return {
    supabase: {
      from: vi.fn(() => builder()),
    },
  }
})

import { supabase } from '../lib/supabase'

const mockRes = () => {
  const res = {} as Response
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  return res
}

const mockReq = (overrides = {}) => ({ ...overrides } as Request)

beforeEach(() => vi.clearAllMocks())

describe('getAllQuestions', () => {
  it('returns all questions', async () => {
    const questions = [{ id: '1', title: 'Two Sum' }]
    vi.mocked(supabase.from).mockReturnValueOnce({
      select: vi.fn().mockResolvedValueOnce({ data: questions, error: null }),
    } as any)

    const req = mockReq()
    const res = mockRes()
    await getAllQuestions(req, res)

    expect(res.json).toHaveBeenCalledWith(questions)
  })

  it('returns 500 on error', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce({
      select: vi.fn().mockResolvedValueOnce({ data: null, error: { message: 'DB error' } }),
    } as any)

    const res = mockRes()
    await getAllQuestions(mockReq(), res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ error: 'DB error' })
  })
})

describe('getRandomQuestion', () => {
  it('returns a random question from the list', async () => {
    const questions = [{ id: '1' }, { id: '2' }, { id: '3' }]
    vi.mocked(supabase.from).mockReturnValueOnce({
      select: vi.fn().mockResolvedValueOnce({ data: questions, error: null }),
    } as any)

    const res = mockRes()
    await getRandomQuestion(mockReq(), res)

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: expect.any(String) }))
  })

  it('returns 404 when no questions exist', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce({
      select: vi.fn().mockResolvedValueOnce({ data: [], error: null }),
    } as any)

    const res = mockRes()
    await getRandomQuestion(mockReq(), res)

    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({ error: 'No questions found' })
  })

  it('returns 500 on error', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce({
      select: vi.fn().mockResolvedValueOnce({ data: null, error: { message: 'DB error' } }),
    } as any)

    const res = mockRes()
    await getRandomQuestion(mockReq(), res)

    expect(res.status).toHaveBeenCalledWith(500)
  })
})

describe('getRandomQuestionByFilter', () => {
  it('returns a filtered random question', async () => {
    const questions = [{ id: '1', difficulty: 'easy', topic: ['Arrays'] }]
    vi.mocked(supabase.from).mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      contains: vi.fn().mockResolvedValueOnce({ data: questions, error: null }),
    } as any)

    const req = mockReq({ params: { difficulty: 'easy', topic: 'Arrays' } })
    const res = mockRes()
    await getRandomQuestionByFilter(req, res)

    expect(res.json).toHaveBeenCalledWith(questions[0])
  })

  it('returns 404 when no matching questions', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      contains: vi.fn().mockResolvedValueOnce({ data: [], error: null }),
    } as any)

    const req = mockReq({ params: { difficulty: 'hard', topic: 'Graphs' } })
    const res = mockRes()
    await getRandomQuestionByFilter(req, res)

    expect(res.status).toHaveBeenCalledWith(404)
  })
})

describe('addQuestion', () => {
  it('inserts and returns the new question with 201', async () => {
    const newQuestion = { id: '1', title: 'Two Sum' }
    vi.mocked(supabase.from).mockReturnValueOnce({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValueOnce({ data: [newQuestion], error: null }),
    } as any)

    const req = mockReq({ body: { title: 'Two Sum' } })
    const res = mockRes()
    await addQuestion(req, res)

    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith([newQuestion])
  })

  it('returns 500 on insert error', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValueOnce({ data: null, error: { message: 'Insert failed' } }),
    } as any)

    const res = mockRes()
    await addQuestion(mockReq({ body: {} }), res)

    expect(res.status).toHaveBeenCalledWith(500)
  })
})

describe('updateQuestion', () => {
  it('updates and returns the question', async () => {
    const updated = { id: '1', title: 'Updated' }
    vi.mocked(supabase.from).mockReturnValueOnce({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValueOnce({ data: [updated], error: null }),
    } as any)

    const req = mockReq({ params: { id: '1' }, body: { title: 'Updated' } })
    const res = mockRes()
    await updateQuestion(req, res)

    expect(res.json).toHaveBeenCalledWith([updated])
  })

  it('returns 404 when question not found', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValueOnce({ data: [], error: null }),
    } as any)

    const req = mockReq({ params: { id: 'nonexistent' }, body: {} })
    const res = mockRes()
    await updateQuestion(req, res)

    expect(res.status).toHaveBeenCalledWith(404)
  })
})

describe('deleteQuestion', () => {
  it('deletes and returns the question', async () => {
    const deleted = { id: '1', title: 'Two Sum' }
    vi.mocked(supabase.from).mockReturnValueOnce({
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValueOnce({ data: [deleted], error: null }),
    } as any)

    const req = mockReq({ params: { id: '1' } })
    const res = mockRes()
    await deleteQuestion(req, res)

    expect(res.json).toHaveBeenCalledWith([deleted])
  })

  it('returns 404 when question not found', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce({
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValueOnce({ data: [], error: null }),
    } as any)

    const req = mockReq({ params: { id: 'nonexistent' } })
    const res = mockRes()
    await deleteQuestion(req, res)

    expect(res.status).toHaveBeenCalledWith(404)
  })
})