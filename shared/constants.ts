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
