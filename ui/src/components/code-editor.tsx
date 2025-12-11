/**
 * Code Editor Component
 * Lightweight JSON editor with syntax highlighting, line numbers, and validation
 * Uses react-simple-code-editor + prism-react-renderer for minimal bundle size (~18KB)
 */

import { useState, useCallback, useMemo } from 'react';
import Editor from 'react-simple-code-editor';
import { Highlight, themes } from 'prism-react-renderer';
import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: 'json' | 'yaml';
  readonly?: boolean;
  className?: string;
  minHeight?: string;
}

interface ValidationResult {
  valid: boolean;
  error?: string;
  line?: number;
}

/**
 * Validate JSON and extract error location
 */
function validateJson(code: string): ValidationResult {
  if (!code.trim()) {
    return { valid: true };
  }

  try {
    JSON.parse(code);
    return { valid: true };
  } catch (e) {
    const error = e as SyntaxError;
    const message = error.message;

    // Try to extract line number from error message
    // Format: "... at position X" or "... at line Y column Z"
    const posMatch = message.match(/position (\d+)/);
    if (posMatch) {
      const pos = parseInt(posMatch[1], 10);
      const lines = code.substring(0, pos).split('\n');
      return {
        valid: false,
        error: message,
        line: lines.length,
      };
    }

    return {
      valid: false,
      error: message,
    };
  }
}

export function CodeEditor({
  value,
  onChange,
  language = 'json',
  readonly = false,
  className,
  minHeight = '300px',
}: CodeEditorProps) {
  const { isDark } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  // Validate on every change for JSON
  const validation = useMemo(() => {
    if (language === 'json') {
      return validateJson(value);
    }
    return { valid: true };
  }, [value, language]);

  // Highlight function using prism-react-renderer
  const highlightCode = useCallback(
    (code: string) => (
      <Highlight theme={isDark ? themes.nightOwl : themes.github} code={code} language={language}>
        {({ tokens, getLineProps, getTokenProps }) => (
          <>
            {tokens.map((line, i) => (
              <div
                key={i}
                {...getLineProps({ line })}
                className={cn('table-row', validation.line === i + 1 && 'bg-destructive/20')}
              >
                <span className="table-cell pr-4 text-right text-muted-foreground select-none opacity-50 text-xs w-8">
                  {i + 1}
                </span>
                <span className="table-cell">
                  {line.map((token, key) => (
                    <span key={key} {...getTokenProps({ token })} />
                  ))}
                </span>
              </div>
            ))}
          </>
        )}
      </Highlight>
    ),
    [isDark, language, validation.line]
  );

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Editor container */}
      <div
        className={cn(
          'relative rounded-md border overflow-hidden',
          'bg-muted/30',
          isFocused && 'ring-2 ring-ring ring-offset-2 ring-offset-background',
          readonly && 'opacity-70 cursor-not-allowed',
          !validation.valid && 'border-destructive'
        )}
        style={{ minHeight }}
      >
        <Editor
          value={value}
          onValueChange={readonly ? () => {} : onChange}
          highlight={highlightCode}
          key={isDark ? 'dark' : 'light'}
          padding={12}
          disabled={readonly}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          textareaClassName={cn(
            'focus:outline-none font-mono text-sm',
            readonly && 'cursor-not-allowed'
          )}
          preClassName="font-mono text-sm"
          style={{
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontSize: '0.875rem',
            minHeight,
          }}
        />
      </div>

      {/* Validation status */}
      <div className="flex items-center gap-2 mt-2 text-xs">
        {validation.valid ? (
          <span className="flex items-center gap-1 text-muted-foreground">
            <CheckCircle2 className="w-3 h-3 text-green-500" />
            Valid {language.toUpperCase()}
          </span>
        ) : (
          <span className="flex items-center gap-1 text-destructive">
            <AlertCircle className="w-3 h-3" />
            {validation.error}
            {validation.line && ` (line ${validation.line})`}
          </span>
        )}
        {readonly && <span className="ml-auto text-muted-foreground">(Read-only)</span>}
      </div>
    </div>
  );
}
