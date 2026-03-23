import { logger } from '../utils/logger';
import { Question } from '../types/question';

const QUESTION_SERVICE_URL = process.env.QUESTION_SERVICE_URL || 'http://localhost:3003';


export async function getRandomQuestion(
    difficulty: string,
    topic: string,
): Promise<Question> {

    const response = await fetch(`${QUESTION_SERVICE_URL}/questions/random/${difficulty}/${topic}`);
    if (!response.ok) {
        throw new Error('Failed to get random question');
    }
    const data = await response.json() as Question;
    return data;
}