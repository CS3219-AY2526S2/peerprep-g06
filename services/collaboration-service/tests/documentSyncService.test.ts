import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';

const getDocumentSnapshot = vi.fn();
const saveDocumentSnapshot = vi.fn();

vi.mock('../src/services/sessionPersistence', () => ({
  getDocumentSnapshot,
  saveDocumentSnapshot,
}));

vi.mock('../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

function encodeYjsText(value: string): string {
  const doc = new Y.Doc();
  doc.getText('code').insert(0, value);
  const encoded = Buffer.from(Y.encodeStateAsUpdate(doc)).toString('base64');
  doc.destroy();
  return encoded;
}

describe('documentSyncService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    const { disposeDocument } = await import('../src/services/documentSyncService');
    await disposeDocument('session-plain');
    await disposeDocument('session-yjs');
    await disposeDocument('session-update');
  });

  it('returns plain text directly from plain-text snapshots', async () => {
    const { getPlainTextFromDocumentSnapshot } =
      await import('../src/services/documentSyncService');

    expect(
      getPlainTextFromDocumentSnapshot({
        sessionId: 'session-plain',
        language: 'typescript',
        content: 'console.log(1);',
        format: 'plain-text',
        updatedAt: '2026-04-16T00:00:00.000Z',
      }),
    ).toBe('console.log(1);');
  });

  it('decodes persisted Yjs snapshots into plain text', async () => {
    const { getPlainTextFromDocumentSnapshot } =
      await import('../src/services/documentSyncService');

    expect(
      getPlainTextFromDocumentSnapshot({
        sessionId: 'session-yjs',
        language: 'typescript',
        content: encodeYjsText('hello world'),
        format: 'yjs-update-base64',
        updatedAt: '2026-04-16T00:00:00.000Z',
      }),
    ).toBe('hello world');
  });

  it('migrates a plain-text snapshot into a Yjs sync payload', async () => {
    getDocumentSnapshot.mockResolvedValueOnce({
      sessionId: 'session-plain',
      language: 'typescript',
      content: 'starter code',
      format: 'plain-text',
      updatedAt: '2026-04-16T00:00:00.000Z',
    });

    const { getDocumentSyncPayload, getPlainTextFromDocumentSnapshot } =
      await import('../src/services/documentSyncService');

    const payload = await getDocumentSyncPayload('session-plain');
    expect(payload).toEqual(
      expect.objectContaining({
        sessionId: 'session-plain',
        language: 'typescript',
        format: 'yjs-update-base64',
      }),
    );
    expect(
      getPlainTextFromDocumentSnapshot({
        sessionId: payload.sessionId,
        language: payload.language,
        content: payload.update,
        format: payload.format,
        updatedAt: payload.updatedAt,
      }),
    ).toBe('starter code');
    expect(saveDocumentSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-plain',
        format: 'yjs-update-base64',
      }),
    );
  });

  it('applies document updates and can flush them on dispose', async () => {
    getDocumentSnapshot.mockResolvedValueOnce(null);

    const { applyDocumentUpdate, disposeDocument, getDocumentSyncPayload } =
      await import('../src/services/documentSyncService');

    const doc = new Y.Doc();
    doc.getText('code').insert(0, 'updated text');
    const encodedUpdate = Buffer.from(Y.encodeStateAsUpdate(doc)).toString('base64');
    doc.destroy();

    await expect(applyDocumentUpdate('session-update', encodedUpdate)).resolves.toEqual(
      expect.objectContaining({
        sessionId: 'session-update',
        update: encodedUpdate,
      }),
    );

    const payload = await getDocumentSyncPayload('session-update');
    expect(payload.update).toBeTruthy();

    await disposeDocument('session-update', true);
    expect(saveDocumentSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-update',
        format: 'yjs-update-base64',
      }),
    );
  });
});
