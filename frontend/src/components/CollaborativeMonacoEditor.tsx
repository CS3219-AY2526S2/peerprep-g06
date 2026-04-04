import { useEffect, useRef } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import { MonacoBinding } from 'y-monaco';
import * as Y from 'yjs';

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

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    const model = editor.getModel();
    if (model) {
      monaco.editor.setModelLanguage(model, language || 'javascript');
    }
  };

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

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border/80 bg-background/80 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Code Editor</p>
          <p className="text-xs text-muted-foreground">
            {statusMessage || 'Edits are shared with your partner in real time.'}
          </p>
        </div>
        <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-primary">
          {language}
        </span>
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
