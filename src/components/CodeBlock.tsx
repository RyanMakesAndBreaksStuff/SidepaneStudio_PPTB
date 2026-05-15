// src/components/CodeBlock.tsx
import * as React from 'react';
import { useState, useMemo, useCallback } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { theme } from '../theme/tokens';
import { Callout } from './Callout';

export interface CodeBlockProps {
  code: string;
  lang?: 'js' | 'json';
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

type HlSpan = { start: number; end: number; color: string; italic?: boolean };

function collectSpans(safe: string, patterns: Array<{ re: RegExp; color: string; italic?: boolean }>): HlSpan[] {
  const spans: HlSpan[] = [];
  for (const { re, color, italic } of patterns) {
    for (const m of safe.matchAll(re)) {
      spans.push({ start: m.index!, end: m.index! + m[0].length, color, italic });
    }
  }
  spans.sort((a, b) => a.start - b.start || b.end - a.end);
  const accepted: HlSpan[] = [];
  let cursor = 0;
  for (const s of spans) {
    if (s.start >= cursor) { accepted.push(s); cursor = s.end; }
  }
  return accepted;
}

function renderSpans(safe: string, spans: HlSpan[]): string {
  let out = '';
  let pos = 0;
  for (const s of spans) {
    out += safe.slice(pos, s.start);
    const style = `color:${s.color}${s.italic ? ';font-style:italic' : ''}`;
    out += `<span style="${style}">${safe.slice(s.start, s.end)}</span>`;
    pos = s.end;
  }
  return out + safe.slice(pos);
}

function highlight(code: string, lang: string): string {
  const safe = escapeHtml(code);
  if (lang === 'json') {
    return renderSpans(safe, collectSpans(safe, [
      { re: /&quot;(?:[^&]|&(?!quot;))*&quot;(?=\s*:)/g, color: '#9CDCFE' },
      { re: /(?<=:\s*)&quot;(?:[^&]|&(?!quot;))*&quot;/g, color: '#CE9178' },
      { re: /(?<=:\s*)(true|false|null)/g, color: '#569CD6' },
      { re: /(?<=:\s*)-?\d+\.?\d*/g, color: '#B5CEA8' },
    ]));
  }
  return renderSpans(safe, collectSpans(safe, [
    { re: /\/\/[^\n]*/g, color: '#6A9955', italic: true },
    { re: /\/\*[\s\S]*?\*\//g, color: '#6A9955', italic: true },
    { re: /&quot;(?:[^&]|\\.)*&quot;/g, color: '#CE9178' },
    { re: /\b(var|let|const|function|async|await|return|if|delete|window|true|false|null)\b/g, color: '#569CD6' },
    { re: /\b\d+\b/g, color: '#B5CEA8' },
  ]));
}

export function CodeBlock({ code, lang = 'js' }: CodeBlockProps): React.ReactElement {
  const { isDark } = useTheme();
  const T = theme(isDark);
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState(false);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(code)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2200); })
      .catch(() => setFallback(true));
  }, [code]);

  const highlighted = useMemo(() => highlight(code, lang), [code, lang]);

  return (
    <div>
      <div style={{ background: '#1E1E1E', borderRadius: T.rM, border: '1px solid #333', overflow: 'hidden' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 12px', background: '#252526', borderBottom: '1px solid #3E3E42',
        }}>
          <span style={{ fontFamily: T.mono, fontSize: 10, color: '#9CDCFE', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px' }}>
            {lang === 'json' ? 'JSON' : 'JavaScript'}
          </span>
          <button
            onClick={copy}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '3px 9px', background: 'rgba(255,255,255,.08)',
              border: '1px solid rgba(255,255,255,.12)', borderRadius: T.rS,
              color: copied ? '#4EC9B0' : 'rgba(255,255,255,.75)',
              fontSize: 11, fontFamily: T.font, cursor: 'pointer',
            }}
          >
            {copied ? '✓ Copied!' : '📋 Copy'}
          </button>
        </div>
        <div style={{ padding: '14px', overflowX: 'auto' }}>
          <pre
            style={{ fontFamily: T.mono, fontSize: 12, lineHeight: 1.65, color: '#D4D4D4', margin: 0, whiteSpace: 'pre' }}
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        </div>
      </div>
      {fallback && (
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Callout type="warn" icon="⚠">Clipboard access blocked. Click the text below to select all, then copy manually (Ctrl+C).</Callout>
          <textarea
            readOnly
            value={code}
            onClick={e => (e.target as HTMLTextAreaElement).select()}
            style={{ width: '100%', height: 80, fontFamily: T.mono, fontSize: 11, padding: 8, borderRadius: T.rM, border: `1px solid ${T.stroke1}`, resize: 'none' }}
          />
        </div>
      )}
    </div>
  );
}
