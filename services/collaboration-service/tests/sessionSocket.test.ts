import { createHash } from 'crypto';
import { describe, expect, it, vi } from 'vitest';
import { cleanupEndedSession, isStoredJoinTokenValid } from '../src/services/sessionSocket';
import { StoredJoinToken } from '../src/types/session';

describe('sessionSocket helpers', () => {
  it('accepts the expected join token for the intended user and session', () => {
    const record: StoredJoinToken = {
      tokenHash: createHash('sha256').update('join-token').digest('hex'),
      claims: {
        sessionId: 'session-1',
        userId: 'user-1',
        matchId: 'match-1',
        issuedAt: '2026-04-16T00:00:00.000Z',
        expiresAt: '2026-04-16T01:00:00.000Z',
      },
    };

    expect(
      isStoredJoinTokenValid(
        'session-1',
        'user-1',
        'join-token',
        record,
        '2026-04-16T00:30:00.000Z',
      ),
    ).toBe(true);
  });

  it('rejects expired or mismatched join tokens', () => {
    const record: StoredJoinToken = {
      tokenHash: createHash('sha256').update('join-token').digest('hex'),
      claims: {
        sessionId: 'session-1',
        userId: 'user-1',
        matchId: 'match-1',
        issuedAt: '2026-04-16T00:00:00.000Z',
        expiresAt: '2026-04-16T00:10:00.000Z',
      },
    };

    expect(
      isStoredJoinTokenValid(
        'session-1',
        'user-2',
        'join-token',
        record,
        '2026-04-16T00:05:00.000Z',
      ),
    ).toBe(false);
    expect(
      isStoredJoinTokenValid(
        'session-1',
        'user-1',
        'wrong-token',
        record,
        '2026-04-16T00:05:00.000Z',
      ),
    ).toBe(false);
    expect(
      isStoredJoinTokenValid(
        'session-1',
        'user-1',
        'join-token',
        record,
        '2026-04-16T00:30:00.000Z',
      ),
    ).toBe(false);
  });

  it('flushes, persists history, disposes, and deletes in cleanup order', async () => {
    const sequence: string[] = [];
    const namespace = {
      to: vi.fn(() => ({
        emit: vi.fn(),
      })),
    };

    await cleanupEndedSession(namespace as any, 'session-1', {
      updateSessionStatus: vi.fn(async () => {
        sequence.push('updateSessionStatus');
        return null;
      }),
      flushDocumentSnapshot: vi.fn(async () => {
        sequence.push('flushDocumentSnapshot');
      }),
      persistSessionAttemptHistory: vi.fn(async () => {
        sequence.push('persistSessionAttemptHistory');
      }),
      disposeDocument: vi.fn(async () => {
        sequence.push('disposeDocument');
      }),
      deleteSessionState: vi.fn(async () => {
        sequence.push('deleteSessionState');
      }),
    });

    expect(sequence).toEqual([
      'updateSessionStatus',
      'flushDocumentSnapshot',
      'persistSessionAttemptHistory',
      'disposeDocument',
      'deleteSessionState',
    ]);
  });

  it('still tears down the session if history persistence fails', async () => {
    const disposeDocument = vi.fn().mockResolvedValue(undefined);
    const deleteSessionState = vi.fn().mockResolvedValue(undefined);

    await cleanupEndedSession(
      {
        to: vi.fn(() => ({
          emit: vi.fn(),
        })),
      } as any,
      'session-1',
      {
        updateSessionStatus: vi.fn().mockResolvedValue(null),
        flushDocumentSnapshot: vi.fn().mockResolvedValue(undefined),
        persistSessionAttemptHistory: vi.fn().mockRejectedValue(new Error('supabase unavailable')),
        disposeDocument,
        deleteSessionState,
      },
    );

    expect(disposeDocument).toHaveBeenCalledWith('session-1');
    expect(deleteSessionState).toHaveBeenCalledWith('session-1');
  });
});
