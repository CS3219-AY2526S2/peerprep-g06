import { describe, expect, it, vi } from 'vitest';
import {
  buildAttemptHistoryEntries,
  getSessionAttemptHistoryContext,
  persistSessionAttemptHistory,
  saveAttemptHistoryEntries,
} from '../src/services/attemptHistory';
import { CollaborationSession } from '../src/types/session';

const baseSession: CollaborationSession = {
  sessionId: 'session-1',
  matchId: 'match-1',
  user1Id: 'user-1',
  user2Id: 'user-2',
  language: 'typescript',
  status: 'ended',
  gracePeriodMs: 30000,
  createdAt: '2026-04-16T00:00:00.000Z',
};

describe('attemptHistory', () => {
  it('builds one history row per participant', () => {
    expect(buildAttemptHistoryEntries(baseSession, 42, 'console.log(1);')).toEqual([
      {
        user_id: 'user-1',
        question_id: 42,
        session_id: 'session-1',
        partner_id: 'user-2',
        solution: 'console.log(1);',
      },
      {
        user_id: 'user-2',
        question_id: 42,
        session_id: 'session-1',
        partner_id: 'user-1',
        solution: 'console.log(1);',
      },
    ]);
  });

  it('persists entries with the Supabase merge-duplicates headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn(),
    });

    await saveAttemptHistoryEntries(
      [
        {
          user_id: 'user-1',
          question_id: 42,
          session_id: 'session-1',
          partner_id: 'user-2',
          solution: 'solution',
        },
      ],
      fetchMock as unknown as typeof fetch,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/rest/v1/history?on_conflict=session_id,user_id'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Prefer: 'resolution=merge-duplicates,return=minimal',
        }),
      }),
    );
  });

  it('throws when the Supabase write fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      text: vi.fn().mockResolvedValue('boom'),
    });

    await expect(
      saveAttemptHistoryEntries(
        [
          {
            user_id: 'user-1',
            question_id: 42,
            session_id: 'session-1',
            partner_id: 'user-2',
            solution: 'solution',
          },
        ],
        fetchMock as unknown as typeof fetch,
      ),
    ).rejects.toThrow('Failed to save attempt history: boom');
  });

  it('builds the attempt history context from persisted session data', async () => {
    const context = await getSessionAttemptHistoryContext('session-1', {
      getSession: vi.fn().mockResolvedValue(baseSession),
      getQuestionSnapshot: vi.fn().mockResolvedValue({
        id: '42',
        title: 'Two Sum',
        description: 'desc',
        difficulty: 'easy',
        topic: 'arrays',
      }),
      getDocumentSnapshot: vi.fn().mockResolvedValue({
        sessionId: 'session-1',
        language: 'typescript',
        content: 'plain text answer',
        format: 'plain-text',
        updatedAt: '2026-04-16T00:00:00.000Z',
      }),
    });

    expect(context).toEqual({
      session: baseSession,
      questionId: 42,
      solution: 'plain text answer',
    });
  });

  it('rejects malformed numeric question ids', async () => {
    await expect(
      getSessionAttemptHistoryContext('session-1', {
        getSession: vi.fn().mockResolvedValue(baseSession),
        getQuestionSnapshot: vi.fn().mockResolvedValue({
          id: 'bad-id',
          title: 'Two Sum',
          description: 'desc',
          difficulty: 'easy',
          topic: 'arrays',
        }),
        getDocumentSnapshot: vi.fn().mockResolvedValue(null),
      }),
    ).rejects.toThrow('Invalid numeric question id');
  });

  it('returns false when there is no persisted session history context', async () => {
    const saveAttemptHistoryEntriesMock = vi.fn();

    await expect(
      persistSessionAttemptHistory('session-1', {
        getSession: vi.fn().mockResolvedValue(null),
        getQuestionSnapshot: vi.fn(),
        getDocumentSnapshot: vi.fn(),
        saveAttemptHistoryEntries: saveAttemptHistoryEntriesMock,
      }),
    ).resolves.toBe(false);

    expect(saveAttemptHistoryEntriesMock).not.toHaveBeenCalled();
  });

  it('persists generated history rows when context exists', async () => {
    const saveAttemptHistoryEntriesMock = vi.fn().mockResolvedValue(undefined);

    await expect(
      persistSessionAttemptHistory('session-1', {
        getSession: vi.fn().mockResolvedValue(baseSession),
        getQuestionSnapshot: vi.fn().mockResolvedValue({
          id: '7',
          title: 'Merge Strings',
          description: 'desc',
          difficulty: 'easy',
          topic: 'strings',
        }),
        getDocumentSnapshot: vi.fn().mockResolvedValue({
          sessionId: 'session-1',
          language: 'typescript',
          content: 'solution',
          format: 'plain-text',
          updatedAt: '2026-04-16T00:00:00.000Z',
        }),
        saveAttemptHistoryEntries: saveAttemptHistoryEntriesMock,
      }),
    ).resolves.toBe(true);

    expect(saveAttemptHistoryEntriesMock).toHaveBeenCalledWith([
      {
        user_id: 'user-1',
        question_id: 7,
        session_id: 'session-1',
        partner_id: 'user-2',
        solution: 'solution',
      },
      {
        user_id: 'user-2',
        question_id: 7,
        session_id: 'session-1',
        partner_id: 'user-1',
        solution: 'solution',
      },
    ]);
  });
});
