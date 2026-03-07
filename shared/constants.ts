// shared/constants.ts
import { Difficulty } from './types';

export const DIFFICULTIES = [
  {
    id: 'easy' as Difficulty,
    label: 'Easy',
    color: 'text-success',
    description: 'Warm-up problems',
  },
  {
    id: 'medium' as Difficulty,
    label: 'Medium',
    color: 'text-warning',
    description: 'Standard interview level',
  },
  {
    id: 'hard' as Difficulty,
    label: 'Hard',
    color: 'text-destructive',
    description: 'Advanced challenges',
  },
] as const;
