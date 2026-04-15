import { config } from '../config/env';
import { getPlainTextFromDocumentSnapshot } from './documentSyncService';
import { getDocumentSnapshot, getQuestionSnapshot, getSession } from './sessionPersistence';
import { CollaborationSession } from '../types/session';

const HISTORY_TABLE_NAME = 'history';

export interface HistoryEntry {
  user_id: string;
  question_id: number;
  session_id: string;
  partner_id: string;
  solution: string;
}

interface SessionAttemptHistoryContext {
  session: CollaborationSession;
  questionId: number;
  solution: string;
}

interface AttemptHistoryDependencies {
  getSession: typeof getSession;
  getQuestionSnapshot: typeof getQuestionSnapshot;
  getDocumentSnapshot: typeof getDocumentSnapshot;
  saveAttemptHistoryEntries: typeof saveAttemptHistoryEntries;
}

const defaultDependencies: AttemptHistoryDependencies = {
  getSession,
  getQuestionSnapshot,
  getDocumentSnapshot,
  saveAttemptHistoryEntries,
};

export function buildAttemptHistoryEntries(
  session: CollaborationSession,
  questionId: number,
  solution: string,
): HistoryEntry[] {
  return [
    {
      user_id: session.user1Id,
      question_id: questionId,
      session_id: session.sessionId,
      partner_id: session.user2Id,
      solution,
    },
    {
      user_id: session.user2Id,
      question_id: questionId,
      session_id: session.sessionId,
      partner_id: session.user1Id,
      solution,
    },
  ];
}

export async function saveAttemptHistoryEntries(
  entries: HistoryEntry[],
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  if (!config.supabase.url || !config.supabase.serviceKey) {
    throw new Error('Missing Supabase environment variables for collaboration-service');
  }

  const response = await fetchImpl(
    `${config.supabase.url}/rest/v1/${HISTORY_TABLE_NAME}?on_conflict=session_id,user_id`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: config.supabase.serviceKey,
        Authorization: `Bearer ${config.supabase.serviceKey}`,
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(entries),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to save attempt history: ${error}`);
  }
}

export async function getSessionAttemptHistoryContext(
  sessionId: string,
  deps: Pick<
    AttemptHistoryDependencies,
    'getSession' | 'getQuestionSnapshot' | 'getDocumentSnapshot'
  > = defaultDependencies,
): Promise<SessionAttemptHistoryContext | null> {
  const [session, question, snapshot] = await Promise.all([
    deps.getSession(sessionId),
    deps.getQuestionSnapshot(sessionId),
    deps.getDocumentSnapshot(sessionId),
  ]);

  if (!session || !question) {
    return null;
  }

  const questionId = Number(question.id);
  if (!Number.isSafeInteger(questionId) || questionId < 1) {
    throw new Error(`Invalid numeric question id for session history: ${question.id}`);
  }

  return {
    session,
    questionId,
    solution: getPlainTextFromDocumentSnapshot(snapshot),
  };
}

export async function persistSessionAttemptHistory(
  sessionId: string,
  deps: AttemptHistoryDependencies = defaultDependencies,
): Promise<boolean> {
  const context = await getSessionAttemptHistoryContext(sessionId, deps);
  if (!context) {
    return false;
  }

  await deps.saveAttemptHistoryEntries(
    buildAttemptHistoryEntries(context.session, context.questionId, context.solution),
  );
  return true;
}
