import { useEffect, useRef, useState } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import { MonacoBinding } from 'y-monaco';
import * as Y from 'yjs';
import {
  applySimpleLintMarkers,
  clearSimpleLintMarkers,
  configureMonacoDiagnostics,
} from '@/lib/monacoLint';

interface CollaborativeMonacoEditorProps {
  doc: Y.Doc | null;
  language: string;
  readOnly?: boolean;
  statusMessage?: string;
}

const DOCUMENT_TEXT_KEY = 'code';

export function CollaborativeMonacoEditor({
  doc,
  language,
  readOnly = false,
  statusMessage,
}: CollaborativeMonacoEditorProps) {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const bindingRef = useRef<MonacoBinding | null>(null);
  const [editorReady, setEditorReady] = useState(false);
  const [lintSummary, setLintSummary] = useState<{
    issueCount: number;
    highestSeverity: Monaco.MarkerSeverity | null;
    firstMessage: string | null;
  }>({
    issueCount: 0,
    highestSeverity: null,
    firstMessage: null,
  });

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    configureMonacoDiagnostics(monaco);
    setEditorReady(true);

    const model = editor.getModel();
    if (model) {
      monaco.editor.setModelLanguage(model, language || 'javascript');
    }
  };

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const model = editor?.getModel();
    if (!editor || !monaco || !model) {
      return;
    }

    const updateLintSummary = () => {
      const markers = monaco.editor.getModelMarkers({ resource: model.uri });
      const highestSeverity =
        markers.reduce<number>(
          (currentMax, marker) => Math.max(currentMax, marker.severity ?? 0),
          0,
        ) || null;

      setLintSummary({
        issueCount: markers.length,
        highestSeverity,
        firstMessage: markers[0]?.message ?? null,
      });
    };

    const runLint = () => {
      applySimpleLintMarkers(monaco, model, language || 'javascript');
      updateLintSummary();
    };

    runLint();
    const contentDisposable = model.onDidChangeContent(runLint);
    const markersDisposable = monaco.editor.onDidChangeMarkers((resources) => {
      if (resources.some((resource) => resource.toString() === model.uri.toString())) {
        updateLintSummary();
      }
    });

    return () => {
      contentDisposable.dispose();
      markersDisposable.dispose();
      clearSimpleLintMarkers(monaco, model);
      setLintSummary({
        issueCount: 0,
        highestSeverity: null,
        firstMessage: null,
      });
    };
  }, [editorReady, language]);

  useEffect(() => {
    if (!doc || !editorRef.current) {
      return;
    }

    const editor = editorRef.current;
    const model = editor.getModel();
    if (!model) {
      return;
    }

    const text = doc.getText(DOCUMENT_TEXT_KEY);
    bindingRef.current?.destroy();
    bindingRef.current = new MonacoBinding(text, model, new Set([editor]), undefined);

    return () => {
      bindingRef.current?.destroy();
      bindingRef.current = null;
    };
  }, [doc]);

  useEffect(() => {
    const model = editorRef.current?.getModel();
    if (!model || !editorRef.current) {
      return;
    }

    if (model.getLanguageId() !== language && language && monacoRef.current) {
      // The model already exists; swap language in place when session metadata changes.
      monacoRef.current.editor.setModelLanguage(model, language);
    }
  }, [language]);

  const lintToneClass =
    lintSummary.highestSeverity === monacoRef.current?.MarkerSeverity.Error
      ? 'border-destructive/20 bg-destructive/10 text-destructive'
      : lintSummary.issueCount > 0
        ? 'border-warning/20 bg-warning/10 text-warning'
        : 'border-success/20 bg-success/10 text-success';

  const lintLabel =
    lintSummary.issueCount === 0
      ? 'No lint issues'
      : `${lintSummary.issueCount} issue${lintSummary.issueCount === 1 ? '' : 's'} detected`;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border/80 bg-background/80 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Code Editor</p>
          <p className="text-xs text-muted-foreground">
            {statusMessage || 'Edits are shared with your partner in real time.'}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-primary">
            {language}
          </span>
          <span
            className={`max-w-[280px] rounded-full border px-3 py-1 text-right text-[11px] font-medium ${lintToneClass}`}
            title={lintSummary.firstMessage || lintLabel}
          >
            {lintLabel}
          </span>
        </div>
      </div>

      <Editor
        height="min(72vh, 760px)"
        defaultLanguage={language || 'javascript'}
        defaultValue=""
        onMount={handleMount}
        options={{
          automaticLayout: true,
          fontSize: 14,
          minimap: { enabled: false },
          readOnly,
          scrollBeyondLastLine: false,
          wordWrap: 'on',
        }}
        theme="vs-dark"
      />
    </div>
  );
}
