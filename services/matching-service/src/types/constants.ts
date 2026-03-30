// request:<userId> set to 30 seconds
export const MATCH_PENDING_TTL = parseInt(process.env.MATCHING_TIMEOUT_MS || '30000') / 1000;
// lock:match:<userId> set to 5 seconds
export const MATCH_LOCK_TTL = 5;
// request:<userId> set to 60 seconds
export const MATCH_MATCHED_TTL = 60;
// request:<userId> set to 30 seconds
export const MATCH_TIMEOUT_TTL = 30;
// match:<matchId> set to 5 minutes
export const MATCH_HANDOFF_TTL = 300;
