export interface User {
    id: string;
    socketId: string;
    difficulty: Difficulty;
    topics: string[];
    languages: string[];
    joinedAt: Date;
    status: MatchStatus;
}

export interface MatchResponse {
    matchId: string;
    user1Id: string;
    user2Id: string;
    commonTopic: string;
    difficulty: Difficulty;
    commonLanguage: string;
    createdAt: Date;
}

export type MatchStatus = 'PENDING' | 'MATCHED' | 'CANCELLED' | 'TIMED_OUT';

export enum Difficulty {
    EASY = 'EASY',
    MEDIUM = 'MEDIUM',
    HARD = 'HARD',
}
