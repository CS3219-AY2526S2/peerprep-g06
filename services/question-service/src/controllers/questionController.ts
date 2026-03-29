import { Request, Response } from 'express'
import { supabase } from '../lib/supabase'

export async function getAllQuestions(_req: Request, res: Response) {
  const { data, error } = await supabase.from('questions').select('*')

  if (error) return res.status(500).json({ error: error.message })

  res.json(data)
}

export async function getRandomQuestion(_req: Request, res: Response) {
  const { data, error } = await supabase.from('questions').select('*')

  if (error) return res.status(500).json({ error: error.message })
  if (!data || data.length === 0) return res.status(404).json({ error: 'No questions found' })

  const random = data[Math.floor(Math.random() * data.length)]
  res.json(random)
}

export async function getRandomQuestionByFilter(req: Request, res: Response) {
  const { difficulty, topic } = req.params

  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .eq('difficulty', difficulty)
    .contains('topic', [topic])

  if (error) return res.status(500).json({ error: error.message })
  if (!data || data.length === 0) return res.status(404).json({ error: 'No questions found' })

  const random = data[Math.floor(Math.random() * data.length)]
  res.json(random)
}

export async function addQuestion(req: Request, res: Response) {
  const { data, error } = await supabase
    .from('questions')
    .insert(req.body)
    .select()

  if (error) return res.status(500).json({ error: error.message })

  res.status(201).json(data)
}

export async function updateQuestion(req: Request, res: Response) {
  const { id } = req.params

  const { data, error } = await supabase
    .from('questions')
    .update(req.body)
    .eq('id', id)
    .select()

  if (error) return res.status(500).json({ error: error.message })
  if (!data || data.length === 0) return res.status(404).json({ error: 'Question not found' })

  res.json(data)
}

export async function deleteQuestion(req: Request, res: Response) {
  const { id } = req.params

  const { data, error } = await supabase
    .from('questions')
    .delete()
    .eq('id', id)
    .select()

  if (error) return res.status(500).json({ error: error.message })
  if (!data || data.length === 0) return res.status(404).json({ error: 'Question not found' })

  res.json(data)
}