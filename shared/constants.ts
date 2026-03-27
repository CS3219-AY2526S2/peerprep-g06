// shared/constants.ts
import { Difficulty } from './types';

export const DIFFICULTIES = [
  {
    id: Difficulty.EASY,
    label: 'Easy',
    color: 'text-success',
    description: 'Warm-up problems',
  },
  {
    id: Difficulty.MEDIUM,
    label: 'Medium',
    color: 'text-warning',
    description: 'Standard interview level',
  },
  {
    id: Difficulty.HARD,
    label: 'Hard',
    color: 'text-destructive',
    description: 'Advanced challenges',
  },
] as const;

export const LANGUAGES = [
    { id: 'javascript', label: 'JavaScript' },
    { id: 'python', label: 'Python' },
    { id: 'java', label: 'Java' },
    { id: 'cpp', label: 'C++' },
    { id: 'typescript', label: 'TypeScript' },
    { id: 'go', label: 'Go' },
] as const;
