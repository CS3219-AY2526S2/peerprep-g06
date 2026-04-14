import { logger } from '../utils/logger';
import { Question } from '../../../../shared/types';

const QUESTION_SERVICE_URL = process.env.QUESTION_SERVICE_URL || 'http://localhost:3002';

export async function getRandomQuestion(difficulty: string, topic: string): Promise<Question> {
  const url = `${QUESTION_SERVICE_URL}/questions/random/${difficulty}/${topic}`;
  logger.info(`Fetching random question from: ${url}`);

  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.text();
    logger.error(`Question service returned ${response.status}: ${body}`);
    throw new Error(`Failed to get random question: ${response.status}`);
  }
  const data = (await response.json()) as Question;
  return data;
}
