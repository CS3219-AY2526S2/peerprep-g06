export enum Difficulty {
    EASY = 'easy',
    MEDIUM = 'medium',
    HARD = 'hard',
}

export interface Question {
    id: string;
    title: string;
    description: string;
    difficulty: string;
    topic: string;
}

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

export interface MatchFoundPayload {
    matchId: string;
    question: Question;
    peerId: string;
    difficulty: Difficulty;
    topic: string;
    language: string;
}
