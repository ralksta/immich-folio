'use client';

import { useState, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { inlineHtmlToMarkdown, renderInlineMarkdown } from '@/lib/journal';

type SharedProps = {
  /**
   * The block field as the parser stores it: HTML from renderInlineMarkdown
   * (a paragraph's `html`, a quote's `text`, a caption, a fact value).
   */
  html: string | undefined;
  /** Receives the field as HTML again, rendered from what was typed. */
  onChange: (html: string) => void;
};

type InputProps = SharedProps & {
  multiline?: false;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>;

type TextareaProps = SharedProps & {
  multiline: true;
} & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'>;

/**
 * A text field for an inline-markdown block field (A-5).
 *
 * Blocks hold rendered HTML, since that is what the public page and the live
 * preview show. The editors used to put that HTML straight into the field: a
 * reloaded entry showed `<strong>` and `<a href="…">` in the textarea, text
 * typed into a tag was lost on save, and typed `**bold**` stayed literal in
 * the preview until a save re-parsed the file.
 *
 * The field shows the markdown source instead and hands every edit back
 * rendered, so the preview is right while typing and the serializer writes
 * the same markdown for an untouched block. What was typed is kept as typed:
 * deriving the field from the HTML on every keystroke would rewrite `__x__`
 * to `**x**`, or drop a half-typed link, under the cursor. The field re-reads
 * the HTML only when it changes from outside (markdown mode, a reorder, a
 * restore).
 */
export function InlineMarkdownField(props: InputProps | TextareaProps) {
  const html = props.html ?? '';
  const [text, setText] = useState(() => inlineHtmlToMarkdown(html));
  const [shownHtml, setShownHtml] = useState(html);
  if (html !== shownHtml) {
    setShownHtml(html);
    setText(inlineHtmlToMarkdown(html));
  }

  const update = (next: string) => {
    const nextHtml = renderInlineMarkdown(next);
    setText(next);
    setShownHtml(nextHtml);
    props.onChange(nextHtml);
  };

  if (props.multiline) {
    const { html: _html, onChange: _onChange, multiline: _multiline, ...rest } = props;
    return <textarea {...rest} value={text} onChange={(e) => update(e.target.value)} />;
  }
  const { html: _html, onChange: _onChange, multiline: _multiline, ...rest } = props;
  return <input type="text" {...rest} value={text} onChange={(e) => update(e.target.value)} />;
}
