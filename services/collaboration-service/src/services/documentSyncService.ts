// In-memory Yjs document manager for active collaboration sessions.
// This module loads persisted snapshots from Redis, applies incremental updates,
// and periodically writes the current converged state back to storage.
import { Buffer } from 'buffer';
import * as Y from 'yjs';
import { getDocumentSnapshot, saveDocumentSnapshot } from './sessionPersistence';
import { SessionDocumentSnapshot } from '../types/session';

const DOCUMENT_TEXT_KEY = 'code';
const SNAPSHOT_PERSIST_DEBOUNCE_MS = 500;

interface ActiveDocument {
  doc: Y.Doc;
  language: string;
  persistTimer?: NodeJS.Timeout;
}

const activeDocuments = new Map<string, ActiveDocument>();

function encodeUpdateBase64(update: Uint8Array): string {
  return Buffer.from(update).toString('base64');
}

function decodeUpdateBase64(encodedUpdate: string): Uint8Array {
  return new Uint8Array(Buffer.from(encodedUpdate, 'base64'));
}

function buildSnapshot(
  sessionId: string,
  language: string,
  doc: Y.Doc,
  updatedAt: string,
): SessionDocumentSnapshot {
  return {
    sessionId,
    language,
    content: encodeUpdateBase64(Y.encodeStateAsUpdate(doc)),
    format: 'yjs-update-base64',
    updatedAt,
  };
}

function loadDocumentFromSnapshot(snapshot: SessionDocumentSnapshot | null): {
  doc: Y.Doc;
  language: string;
  migratedFromPlainText: boolean;
} {
  const doc = new Y.Doc();
  const language = snapshot?.language ?? '';

  if (!snapshot) {
    return { doc, language, migratedFromPlainText: false };
  }

  if (snapshot.format === 'yjs-update-base64') {
    Y.applyUpdate(doc, decodeUpdateBase64(snapshot.content));
    return { doc, language, migratedFromPlainText: false };
  }

  const text = doc.getText(DOCUMENT_TEXT_KEY);
  if (snapshot.content.length > 0) {
    text.insert(0, snapshot.content);
  }

  return { doc, language, migratedFromPlainText: true };
}

async function persistSnapshot(sessionId: string): Promise<void> {
  const activeDocument = activeDocuments.get(sessionId);
  if (!activeDocument) {
    return;
  }

  if (activeDocument.persistTimer) {
    clearTimeout(activeDocument.persistTimer);
    activeDocument.persistTimer = undefined;
  }

  await saveDocumentSnapshot(
    buildSnapshot(sessionId, activeDocument.language, activeDocument.doc, new Date().toISOString()),
  );
}

function scheduleSnapshotPersist(sessionId: string): void {
  const activeDocument = activeDocuments.get(sessionId);
  if (!activeDocument) {
    return;
  }

  if (activeDocument.persistTimer) {
    clearTimeout(activeDocument.persistTimer);
  }

  activeDocument.persistTimer = setTimeout(() => {
    void persistSnapshot(sessionId);
  }, SNAPSHOT_PERSIST_DEBOUNCE_MS);
}

async function getOrCreateActiveDocument(sessionId: string): Promise<ActiveDocument> {
  const existingDocument = activeDocuments.get(sessionId);
  if (existingDocument) {
    return existingDocument;
  }

  const snapshot = await getDocumentSnapshot(sessionId);
  const { doc, language, migratedFromPlainText } = loadDocumentFromSnapshot(snapshot);
  const activeDocument: ActiveDocument = { doc, language };
  activeDocuments.set(sessionId, activeDocument);

  if (migratedFromPlainText) {
    await saveDocumentSnapshot(buildSnapshot(sessionId, language, doc, new Date().toISOString()));
  }

  return activeDocument;
}

export interface DocumentSyncPayload {
  sessionId: string;
  language: string;
  update: string;
  updatedAt: string;
  format: 'yjs-update-base64';
}

export async function getDocumentSyncPayload(sessionId: string): Promise<DocumentSyncPayload> {
  const activeDocument = await getOrCreateActiveDocument(sessionId);

  return {
    sessionId,
    language: activeDocument.language,
    update: encodeUpdateBase64(Y.encodeStateAsUpdate(activeDocument.doc)),
    updatedAt: new Date().toISOString(),
    format: 'yjs-update-base64',
  };
}

export async function applyDocumentUpdate(
  sessionId: string,
  encodedUpdate: string,
): Promise<DocumentSyncPayload> {
  const activeDocument = await getOrCreateActiveDocument(sessionId);
  const decodedUpdate = decodeUpdateBase64(encodedUpdate);

  Y.applyUpdate(activeDocument.doc, decodedUpdate);
  const updatedAt = new Date().toISOString();
  scheduleSnapshotPersist(sessionId);

  return {
    sessionId,
    language: activeDocument.language,
    update: encodedUpdate,
    updatedAt,
    format: 'yjs-update-base64',
  };
}
