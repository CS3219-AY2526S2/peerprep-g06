import { User } from "../types/user";
import crypto from 'crypto';

export function createSessionId(user1: User, user2: User, startTime: number): string {
    // create a hash from a combination of the session's start time and the users' ids
    const userId1 = user1.id;
    const userId2 = user2.id;
    const hash = crypto.createHash('sha256').update(`${startTime}-${userId1}-${userId2}`).digest('hex').substring(0, 8);
    return hash;
}