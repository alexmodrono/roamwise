'use client';
import './fonts-editor.css';

import { useEffect, useRef } from 'react';
import { EditorState, Transaction } from '@codemirror/state';
import { EditorView, drawSelection, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, HighlightStyle, foldGutter, foldKeymap, indentOnInput, indentUnit, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { yaml } from '@codemirror/lang-yaml';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';

// Catppuccin Latte: https://catppuccin.com/palette/
const latteHighlight = HighlightStyle.define([
  { tag: tags.comment, color: '#9ca0b0', fontStyle: 'italic' },
  { tag: [tags.propertyName, tags.attributeName], color: '#1e66f5' },
  { tag: [tags.string, tags.special(tags.string)], color: '#40a02b' },
  { tag: [tags.number, tags.bool, tags.null], color: '#fe640b' },
  { tag: [tags.keyword, tags.typeName], color: '#8839ef' },
  { tag: [tags.operator, tags.punctuation], color: '#7c7f93' },
  { tag: [tags.meta, tags.labelName], color: '#179299' },
  { tag: tags.invalid, color: '#d20f39', textDecoration: 'underline' },
]);

const theme = EditorView.theme({
  '&': { height: 'min(65vh, 720px)', minHeight: '320px', backgroundColor: '#eff1f5', color: '#4c4f69', fontSize: '14px' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { overflow: 'auto', fontFamily: 'var(--font-code), ui-monospace, monospace', lineHeight: '1.8' },
  '.cm-content': { fontFamily: 'var(--font-code), ui-monospace, monospace', padding: '16px 0', caretColor: '#dc8a78' },
  '.cm-line': { padding: '0 16px 0 8px' },
  '.cm-gutters': { backgroundColor: '#e6e9ef', color: '#9ca0b0', borderRight: '1px solid #eef0f3', paddingRight: '6px' },
  '.cm-activeLineGutter': { backgroundColor: '#ccd0da', color: '#4c4f69' },
  '.cm-activeLine': { backgroundColor: '#e6e9ef' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: '#acb0be55' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#dc8a78' },
  '.cm-selectionMatch': { backgroundColor: '#17929922' },
  '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: '#fe640b44' },
  '.cm-matchingBracket': { backgroundColor: '#acb0be44', color: '#179299' },
  '.cm-foldPlaceholder': { backgroundColor: '#ccd0da', borderColor: '#bcc0cc', color: '#6c6f85' },
  '.cm-button': { backgroundImage: 'none', backgroundColor: '#ccd0da', borderColor: '#bcc0cc', color: '#4c4f69', borderRadius: '4px' },
  '.cm-searchMatch': { backgroundColor: '#df8e1d33' },
  '.cm-panels': { backgroundColor: '#e6e9ef', color: '#4c4f69' },
  '.cm-search': { padding: '8px', fontFamily: 'inherit', fontSize: '13px' },
  '.cm-textfield': { border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#eff1f5', color: '#4c4f69' },
});

export default function YamlEditor({ value, onChange, readOnly = false }: { value: string; onChange: (value: string) => void; readOnly?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<EditorView | null>(null);
  const current = useRef({ value, onChange });
  useEffect(() => { current.current = { value, onChange }; }, [value, onChange]);

  useEffect(() => {
    if (!host.current) return;
    const view = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: current.current.value,
        extensions: [
          yaml(), lineNumbers(), foldGutter(), history(), drawSelection(), bracketMatching(),
          indentOnInput(), indentUnit.of('  '), EditorState.tabSize.of(2),
          syntaxHighlighting(latteHighlight), highlightSelectionMatches(),
          ...(!readOnly ? [highlightActiveLine(), highlightActiveLineGutter()] : []),
          keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, ...foldKeymap, ...(!readOnly ? [indentWithTab] : [])]),
          EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly),
          EditorView.contentAttributes.of({ 'aria-label': 'Trip YAML source', 'aria-readonly': String(readOnly), 'aria-describedby': 'yaml-editor-help', tabindex: '0', spellcheck: 'false' }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged && update.transactions.some((transaction) => transaction.annotation(Transaction.userEvent))) {
              current.current.onChange(update.state.doc.toString());
            }
          }),
          theme,
        ],
      }),
    });
    editor.current = view;
    return () => { editor.current = null; view.destroy(); };
  }, [readOnly]);

  useEffect(() => {
    const view = editor.current;
    if (!view || view.state.doc.toString() === value) return;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value }, annotations: Transaction.addToHistory.of(false) });
  }, [value]);

  return <div className="overflow-hidden rounded-xl border border-[#ccd0da] bg-[#eff1f5] shadow-sm focus-within:ring-2 focus-within:ring-[#7287fd]/30">
    <div className="flex items-center justify-between border-b border-[#ccd0da] bg-[#e6e9ef] px-4 py-2 text-xs text-[#6c6f85]"><span className="font-mono">trip.yaml</span><span>{readOnly ? 'Read-only' : 'YAML · 2-space indent'}</span></div>
    <div ref={host} />
  </div>;
}
