export interface MatchRequest {
    userId: string;
    socketId: string;
    difficulty: 'EASY' | 'MEDIUM' | 'HARD';
    languages: string[];
    joinedAt: Date;
    status: 'PENDING' | 'MATCHED' | 'CANCELLED' | 'TIMED_OUT';
}

export interface MatchResponse {
    matchId: string;
    user1Id: string;
    user2Id: string;
    commonTopic: string;
    difficulty: 'EASY' | 'MEDIUM' | 'HARD';
    commonLanguage: string;
    createdAt: Date;
}
