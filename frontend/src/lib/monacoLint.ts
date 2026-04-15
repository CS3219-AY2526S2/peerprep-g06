import type * as Monaco from 'monaco-editor';

const SIMPLE_LINT_OWNER = 'peerprep-simple-lint';
const MAX_LINE_LENGTH = 120;

let diagnosticsConfigured = false;

function createMarker(
  message: string,
  severity: Monaco.MarkerSeverity,
  lineNumber: number,
  startColumn: number,
  endColumn: number,
): Monaco.editor.IMarkerData {
  return {
    message,
    severity,
    startLineNumber: lineNumber,
    startColumn,
    endLineNumber: lineNumber,
    endColumn: Math.max(endColumn, startColumn + 1),
  };
}

function buildBracketMarkers(
  source: string,
  language: string,
  monaco: typeof Monaco,
): Monaco.editor.IMarkerData[] {
  const markers: Monaco.editor.IMarkerData[] = [];
  const stack: Array<{
    char: '(' | '[' | '{';
    lineNumber: number;
    column: number;
  }> = [];
  const closingToOpening: Record<string, '(' | '[' | '{'> = {
    ')': '(',
    ']': '[',
    '}': '{',
  };

  let lineNumber = 1;
  let column = 1;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const nextChar = source[index + 1];

    if (char === '\n') {
      lineNumber += 1;
      column = 1;
      inLineComment = false;
      escaped = false;
      continue;
    }

    if (inLineComment) {
      column += 1;
      continue;
    }

    if (inBlockComment) {
      if (char === '*' && nextChar === '/') {
        inBlockComment = false;
        index += 1;
        column += 2;
        continue;
      }
      column += 1;
      continue;
    }

    if (inSingleQuote || inDoubleQuote || inTemplate) {
      if (!escaped) {
        if (inSingleQuote && char === "'") {
          inSingleQuote = false;
        } else if (inDoubleQuote && char === '"') {
          inDoubleQuote = false;
        } else if (inTemplate && char === '`') {
          inTemplate = false;
        }
      }
      escaped = !escaped && char === '\\';
      column += 1;
      continue;
    }

    if (char === '/' && nextChar === '/') {
      inLineComment = true;
      column += 2;
      index += 1;
      continue;
    }

    if (char === '/' && nextChar === '*') {
      inBlockComment = true;
      column += 2;
      index += 1;
      continue;
    }

    if (language === 'python' && char === '#') {
      inLineComment = true;
      column += 1;
      continue;
    }

    if (char === "'") {
      inSingleQuote = true;
      column += 1;
      continue;
    }

    if (char === '"') {
      inDoubleQuote = true;
      column += 1;
      continue;
    }

    if (char === '`') {
      inTemplate = true;
      column += 1;
      continue;
    }

    if (char === '(' || char === '[' || char === '{') {
      stack.push({
        char,
        lineNumber,
        column,
      });
      column += 1;
      continue;
    }

    if (char === ')' || char === ']' || char === '}') {
      const expectedOpening = closingToOpening[char];
      const lastOpening = stack.pop();

      if (!lastOpening || lastOpening.char !== expectedOpening) {
        markers.push(
          createMarker(
            `Unmatched closing "${char}"`,
            monaco.MarkerSeverity.Error,
            lineNumber,
            column,
            column + 1,
          ),
        );
      }

      column += 1;
      continue;
    }

    column += 1;
  }

  for (const opening of stack) {
    markers.push(
      createMarker(
        `Unclosed "${opening.char}"`,
        monaco.MarkerSeverity.Error,
        opening.lineNumber,
        opening.column,
        opening.column + 1,
      ),
    );
  }

  return markers;
}

function buildLineMarkers(source: string, monaco: typeof Monaco): Monaco.editor.IMarkerData[] {
  const markers: Monaco.editor.IMarkerData[] = [];
  const lines = source.split('\n');

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const indentation = line.match(/^[ \t]+/)?.[0] ?? '';

    if (indentation.includes(' ') && indentation.includes('\t')) {
      markers.push(
        createMarker(
          'Avoid mixing tabs and spaces in indentation',
          monaco.MarkerSeverity.Warning,
          lineNumber,
          1,
          indentation.length + 1,
        ),
      );
    }

    const trailingWhitespaceMatch = line.match(/[ \t]+$/);
    if (trailingWhitespaceMatch) {
      const startColumn = line.length - trailingWhitespaceMatch[0].length + 1;
      markers.push(
        createMarker(
          'Trailing whitespace',
          monaco.MarkerSeverity.Warning,
          lineNumber,
          startColumn,
          line.length + 1,
        ),
      );
    }

    if (line.length > MAX_LINE_LENGTH) {
      markers.push(
        createMarker(
          `Line exceeds ${MAX_LINE_LENGTH} characters`,
          monaco.MarkerSeverity.Warning,
          lineNumber,
          MAX_LINE_LENGTH + 1,
          line.length + 1,
        ),
      );
    }
  });

  return markers;
}

export function configureMonacoDiagnostics(monaco: typeof Monaco): void {
  if (diagnosticsConfigured) {
    return;
  }

  const monacoTypeScript = (monaco.languages as { typescript?: any }).typescript;
  if (!monacoTypeScript) {
    diagnosticsConfigured = true;
    return;
  }

  const compilerOptions = {
    allowNonTsExtensions: true,
    target: monacoTypeScript.ScriptTarget?.ES2020,
    module: monacoTypeScript.ModuleKind?.ESNext,
    noEmit: true,
    strict: false,
  };

  monacoTypeScript.javascriptDefaults?.setCompilerOptions(compilerOptions);
  monacoTypeScript.typescriptDefaults?.setCompilerOptions(compilerOptions);
  monacoTypeScript.javascriptDefaults?.setDiagnosticsOptions({
    noSyntaxValidation: false,
    noSemanticValidation: false,
  });
  monacoTypeScript.typescriptDefaults?.setDiagnosticsOptions({
    noSyntaxValidation: false,
    noSemanticValidation: false,
  });

  diagnosticsConfigured = true;
}

export function applySimpleLintMarkers(
  monaco: typeof Monaco,
  model: Monaco.editor.ITextModel,
  language: string,
): void {
  const source = model.getValue();
  const markers = [
    ...buildLineMarkers(source, monaco),
    ...buildBracketMarkers(source, language, monaco),
  ];

  monaco.editor.setModelMarkers(model, SIMPLE_LINT_OWNER, markers);
}

export function clearSimpleLintMarkers(
  monaco: typeof Monaco,
  model: Monaco.editor.ITextModel,
): void {
  monaco.editor.setModelMarkers(model, SIMPLE_LINT_OWNER, []);
}
