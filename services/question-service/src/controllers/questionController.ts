import { Request, Response } from 'express';
import { supabase } from '../lib/supabase';

export async function getAllQuestions(_req: Request, res: Response) {
  const { data, error } = await supabase.from('questions').select('*');

  if (error) return res.status(500).json({ error: error.message });

  res.json(data);
}

export async function getQuestionById(req: Request, res: Response) {
  const { id } = req.params;

  const { data, error } = await supabase.from('questions').select('*').eq('id', id).single();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Question not found' });

  res.json(data);
}

export async function getRandomQuestionByFilter(req: Request, res: Response) {
  const { difficulty, topic } = req.params;
  const startedAt = Date.now();

  console.log(
    `[question-service] Fetching random question for difficulty="${difficulty}" topic="${topic}"`,
  );

  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .eq('difficulty', difficulty)
    .contains('topic', [topic]);

  if (error) {
    console.error(
      `[question-service] Failed random question query after ${Date.now() - startedAt}ms`,
      error,
    );
    return res.status(500).json({ error: error.message });
  }

  if (!data || data.length === 0) {
    console.warn(
      `[question-service] No random question found after ${Date.now() - startedAt}ms for difficulty="${difficulty}" topic="${topic}"`,
    );
    return res.status(404).json({ error: 'No questions found' });
  }

  const random = data[Math.floor(Math.random() * data.length)];
  console.log(
    `[question-service] Random question selected after ${Date.now() - startedAt}ms from ${data.length} candidates`,
  );
  res.json(random);
}

export async function addQuestion(req: Request, res: Response) {
  const { data, error } = await supabase.from('questions').insert(req.body).select();

  if (error) return res.status(500).json({ error: error.message });

  res.status(201).json(data);
}

export async function updateQuestion(req: Request, res: Response) {
  const { id } = req.params;

  const { data, error } = await supabase.from('questions').update(req.body).eq('id', id).select();

  if (error) return res.status(500).json({ error: error.message });
  if (!data || data.length === 0) return res.status(404).json({ error: 'Question not found' });

  res.json(data);
}

export async function deleteQuestion(req: Request, res: Response) {
  const { id } = req.params;

  const { data, error } = await supabase.from('questions').delete().eq('id', id).select();

  if (error) return res.status(500).json({ error: error.message });
  if (!data || data.length === 0) return res.status(404).json({ error: 'Question not found' });

  res.json(data);
}
