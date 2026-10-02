// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { JournalEditor } from '../journal/JournalEditor';
import { EssayBlockEditor } from '../EssayBlockEditor';
import { InlineMarkdownField } from '../InlineMarkdownField';
import { NotificationProvider } from '../Notifications';
import { ConfirmProvider } from '../ConfirmDialog';

/**
 * Text blocks are edited as markdown, not as the HTML the parser stores (A-5).
 * A reloaded entry used to show `<strong>` and `<a href=…>` in the textarea,
 * text typed into a tag was lost on save, and typed `**bold**` stayed literal
 * in the live preview until the first save.
 */

const ID = '3f1c9a52-8d4e-4b7a-9c1d-0e2f3a4b5c6d';
const ENTRY = [
  '---',
  'title: "Trip"',
  '---',
  '',
  'Hello **bold** and [Immich](https://immich.app).',
  '',
  '> A *quoted* line -- Someone',
  '',
  `![${ID}:wide](A **nice** view)`,
  '',
  '::facts',
  'Distance: **21** km',
].join('\n');

beforeEach(() => {
  // The live preview's FadeIn reveals at once under reduced motion instead of
  // needing IntersectionObserver.
  window.matchMedia = ((query: string) => ({
    matches: query.includes('reduce'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        const sent = JSON.parse(init.body as string) as { rawMarkdown: string };
        return new Response(
          JSON.stringify({
            success: true,
            entry: { slug: 'trip', rawMarkdown: sent.rawMarkdown },
            version: 'v2',
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({ entry: { slug: 'trip', rawMarkdown: ENTRY }, version: 'v1' }),
        { status: 200 },
      );
    }),
  );
  // Node 26 defines its own global localStorage (undefined without
  // --localstorage-file), which shadows jsdom's; give the editor a working one.
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
  window.sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function renderJournal() {
  render(
    <NotificationProvider>
      <ConfirmProvider>
        <JournalEditor slug="trip" onBack={() => {}} />
      </ConfirmProvider>
    </NotificationProvider>,
  );
  return (await screen.findByLabelText('Text')) as HTMLTextAreaElement;
}

/** The entry as the editor would save it, read from the Raw Markdown view. */
function rawMarkdown(): string {
  fireEvent.click(screen.getByRole('button', { name: 'Raw Markdown' }));
  const value = (screen.getByPlaceholderText('Write Markdown here...') as HTMLTextAreaElement)
    .value;
  fireEvent.click(screen.getByRole('button', { name: 'Visual Blocks' }));
  return value;
}

describe('journal editor: text blocks as markdown (A-5)', () => {
  it('shows the markdown source, not the stored HTML, after a load', async () => {
    const text = await renderJournal();
    expect(text.value).toBe('Hello **bold** and [Immich](https://immich.app).');
    expect(screen.getByDisplayValue('A *quoted* line')).toBeTruthy();
    expect(screen.getByDisplayValue('A **nice** view')).toBeTruthy();
    expect(screen.getByDisplayValue('**21** km')).toBeTruthy();
    expect(document.body.querySelector('textarea, input')).toBeTruthy();
    for (const field of document.body.querySelectorAll('textarea, input')) {
      expect((field as HTMLInputElement).value).not.toMatch(/<(strong|em|a)\b/);
    }
  });

  it('renders typed markdown in the live preview before any save', async () => {
    const text = await renderJournal();
    fireEvent.change(text, { target: { value: 'Now **strong** text.' } });
    const preview = document.querySelector('.journal-preview-frame')!;
    expect(preview.innerHTML).toContain('<strong>strong</strong>');
    expect(preview.textContent).not.toContain('**strong**');
    // What was typed stays as typed.
    expect(text.value).toBe('Now **strong** text.');
  });

  it('keeps text typed inside a link label or bold run', async () => {
    const text = await renderJournal();
    fireEvent.change(text, {
      target: { value: 'Hello **bold and more** and [Immich Photos](https://immich.app).' },
    });
    expect(rawMarkdown()).toContain(
      'Hello **bold and more** and [Immich Photos](https://immich.app).',
    );
  });

  it('writes the same file when the content is unchanged', async () => {
    const text = await renderJournal();
    const original = text.value;
    fireEvent.change(text, { target: { value: `${original} extra` } });
    fireEvent.change(screen.getByLabelText('Text'), { target: { value: original } });
    expect(rawMarkdown()).toBe(ENTRY);
  });

  it('keeps `__` as typed while the file gets the canonical form', async () => {
    const text = await renderJournal();
    fireEvent.change(text, { target: { value: 'An __underscored__ word' } });
    expect(text.value).toBe('An __underscored__ word');
    expect(rawMarkdown()).toContain('An **underscored** word');
  });
});

describe('journal editor: mode toggles (A-18)', () => {
  // Rendered as admin-btn-xs, the active mode carried admin-btn-primary, whose
  // background the size class overrode: both modes looked the same.
  it('mark the active mode, starting on Visual Blocks and Desktop', async () => {
    await renderJournal();
    const pressed = (name: string) =>
      screen.getByRole('button', { name }).getAttribute('aria-pressed');

    expect(pressed('Visual Blocks')).toBe('true');
    expect(pressed('Raw Markdown')).toBe('false');
    expect(pressed('Desktop')).toBe('true');
    expect(pressed('Mobile')).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: 'Raw Markdown' }));
    expect(pressed('Visual Blocks')).toBe('false');
    expect(pressed('Raw Markdown')).toBe('true');
    expect(screen.getByRole('button', { name: 'Raw Markdown' }).className).toContain('active');
  });
});

describe('InlineMarkdownField', () => {
  function Harness({ initial }: { initial: string }) {
    const [html, setHtml] = useState(initial);
    return (
      <>
        <InlineMarkdownField aria-label="Field" html={html} onChange={setHtml} />
        <button type="button" onClick={() => setHtml('<em>replaced</em>')}>
          Replace
        </button>
        <output data-testid="html">{html}</output>
      </>
    );
  }

  it('hands back HTML and re-reads it only on an outside change', () => {
    render(<Harness initial="<strong>x</strong>" />);
    const field = screen.getByLabelText('Field') as HTMLInputElement;
    expect(field.value).toBe('**x**');
    fireEvent.change(field, { target: { value: 'a [half](http' } });
    expect(field.value).toBe('a [half](http');
    fireEvent.change(field, { target: { value: 'a & b <c>' } });
    expect(screen.getByTestId('html').textContent).toBe('a &amp; b &lt;c&gt;');
    expect(field.value).toBe('a & b <c>');
    fireEvent.click(screen.getByRole('button', { name: 'Replace' }));
    expect(field.value).toBe('*replaced*');
  });
});

describe('essay block editor: text blocks as markdown (A-5)', () => {
  it('shows markdown and serializes an edit through the renderer', () => {
    const onChange = vi.fn();
    render(
      <EssayBlockEditor
        markdown={'Some *italic* and [a link](https://immich.app).'}
        onChange={onChange}
      />,
    );
    const text = screen.getByDisplayValue(
      'Some *italic* and [a link](https://immich.app).',
    ) as HTMLTextAreaElement;
    fireEvent.change(text, {
      target: { value: 'Some *italic* and [a longer link](https://immich.app).' },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      'Some *italic* and [a longer link](https://immich.app).',
    );
  });
});
