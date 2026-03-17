import { Difficulty } from "./user";

export interface Match {
    id: string;
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

export enum MatchStatus {
    PENDING = 'PENDING',
    MATCHED = 'MATCHED',
    TIMED_OUT = 'TIMED_OUT',
}
