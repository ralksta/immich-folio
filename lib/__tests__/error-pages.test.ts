import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import NotFound from '@/app/not-found';
import ErrorPage from '@/app/error';

// Uses createElement rather than JSX because vitest.config.ts only includes
// lib/__tests__/**/*.test.ts — a .tsx file here would never run.

describe('not-found page', () => {
  const html = () => renderToStaticMarkup(createElement(NotFound));

  it('uses the themed empty-state styling rather than raw markup', () => {
    expect(html()).toContain('empty-state');
  });

  it('offers a way back to the gallery', () => {
    expect(html()).toContain('href="/"');
  });

  // notFound() means Immich answered and the content is genuinely gone. If this
  // page hedged with "try again", a real 404 would look like a transient fault.
  it('does not suggest the problem is temporary', () => {
    expect(html()).not.toMatch(/try again|temporar|unavailable/i);
  });
});

describe('error page', () => {
  const render = (error: Error & { digest?: string }) =>
    renderToStaticMarkup(createElement(ErrorPage, { error, reset: () => {} }));

  it('offers a retry and a way back to the gallery', () => {
    const html = render(new Error('boom'));
    expect(html).toContain('Try again');
    expect(html).toContain('href="/"');
  });

  it('surfaces the Next.js digest so a report can be traced to a log line', () => {
    const html = render(Object.assign(new Error('boom'), { digest: 'abc123def' }));
    expect(html).toContain('abc123def');
  });

  it('omits the reference line when there is no digest', () => {
    expect(render(new Error('boom'))).not.toContain('Reference:');
  });

  // Error messages reaching this component can carry internal detail — an
  // upstream URL, a header, a config value. Never echo them to a visitor.
  it('does not leak the raw error message', () => {
    const html = render(new Error('connect ECONNREFUSED 10.0.0.5:2283 x-api-key=hunter2'));
    expect(html).not.toContain('hunter2');
    expect(html).not.toContain('10.0.0.5');
    expect(html).not.toContain('ECONNREFUSED');
  });

  // The counterpart assertion to the not-found page: this one *should* frame the
  // failure as transient, because that is what an Immich outage is.
  it('frames the failure as temporary', () => {
    expect(render(new Error('boom'))).toMatch(/temporary/i);
  });
});
