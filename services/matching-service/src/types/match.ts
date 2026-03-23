import { Difficulty } from './user';
import { Question } from './question';
export interface Match {
    id: string;
    user1Id: string;
    user2Id: string;
    commonTopic: string;
    question: Question;
    difficulty: Difficulty;
    commonLanguage: string;
    createdAt: Date;
    status: MatchStatus;
}

export enum MatchStatus {
    PENDING = 'PENDING',
    MATCHED = 'MATCHED',
    TIMED_OUT = 'TIMED_OUT',
}
