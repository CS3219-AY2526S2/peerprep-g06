export interface User {
    id: string;
    socketId: string;
    difficulty: Difficulty;
    topics: string[];
    language: string;
    joinedAt: Date;
    status: MatchStatus;
}

export interface Match {
    matchId: string;
    user1Id: string;
    user2Id: string;
    commonTopic: string;
    questionId: string;
    difficulty: Difficulty;
    commonLanguage: string;
    createdAt: Date;
    status: MatchStatus;
    sessionId: string;
}

export type MatchStatus = 'PENDING' | 'MATCHED' | 'CANCELLED' | 'TIMED_OUT';

export enum Difficulty {
    EASY = 'EASY',
    MEDIUM = 'MEDIUM',
    HARD = 'HARD',
}
