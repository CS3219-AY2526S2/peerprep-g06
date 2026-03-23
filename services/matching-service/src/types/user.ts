import { MatchStatus } from "./match";

export interface User {
    id: string;
    socketId: string;
    difficulty: Difficulty;
    topics: string[];
    language: string;
    joinedAt: Date;
    status: MatchStatus;
}

export enum Difficulty {
    EASY = 'EASY',
    MEDIUM = 'MEDIUM',
    HARD = 'HARD',
}