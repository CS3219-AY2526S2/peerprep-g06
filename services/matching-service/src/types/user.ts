import { MatchStatus, Difficulty } from '@shared/types';

export { Difficulty };

export interface User {
  id: string;
  socketId: string;
  difficulty: Difficulty;
  topics: string[];
  language: string;
  joinedAt: Date;
  status: MatchStatus;
}
