// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { NavLink } from '../NavLink';

/**
 * isActivePath is covered on its own in lib/__tests__/navActive.test.ts. What
 * this adds is the part that was never verified: that the decision actually
 * reaches the markup — the class the CSS has been waiting for since the header
 * was written, and the aria-current that had no equivalent anywhere.
 *
 * The routes below are the ones the reference site really serves.
 */

const mockPathname = vi.hoisted(() => ({ value: '/' }));

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname.value,
}));

afterEach(cleanup);

const at = (pathname: string) => {
  mockPathname.value = pathname;
};

describe('NavLink', () => {
  it('marks the current page in both the class and aria-current', () => {
    at('/deutschland');
    render(<NavLink href="/deutschland">Deutschland</NavLink>);

    const link = screen.getByRole('link', { name: 'Deutschland' });
    expect(link.className).toContain('active');
    expect(link.getAttribute('aria-current')).toBe('page');
  });

  it('leaves a link that is not current untouched', () => {
    at('/polen');
    render(<NavLink href="/deutschland">Deutschland</NavLink>);

    const link = screen.getByRole('link', { name: 'Deutschland' });
    expect(link.className).not.toContain('active');
    // Absent, not "false": aria-current="false" is a value screen readers
    // announce differently from the attribute simply not being there.
    expect(link.getAttribute('aria-current')).toBeNull();
  });

  it('keeps the base class alongside the active one, so the link still looks like a link', () => {
    at('/map');
    render(<NavLink href="/map">Karte</NavLink>);

    expect(screen.getByRole('link', { name: 'Karte' }).className).toContain('header__nav-link');
  });

  it('marks the subpage while viewing one of its albums', () => {
    at('/deutschland/kloster-chorin');
    render(
      <>
        <NavLink href="/">Start</NavLink>
        <NavLink href="/deutschland">Deutschland</NavLink>
        <NavLink href="/polen">Polen</NavLink>
      </>,
    );

    expect(screen.getByRole('link', { name: 'Deutschland' }).className).toContain('active');
    expect(screen.getByRole('link', { name: 'Start' }).className).not.toContain('active');
    expect(screen.getByRole('link', { name: 'Polen' }).className).not.toContain('active');
  });

  it('marks exactly one link across a full header', () => {
    at('/deutschland/an-der-ostsee');
    render(
      <>
        <NavLink href="/">Start</NavLink>
        <NavLink href="/deutschland">Deutschland</NavLink>
        <NavLink href="/polen">Polen</NavLink>
        <NavLink href="/japan">Japan</NavLink>
        <NavLink href="/south-korea">south-korea</NavLink>
        <NavLink href="/about">Über mich</NavLink>
        <NavLink href="/map">Karte</NavLink>
      </>,
    );

    const marked = screen
      .getAllByRole('link')
      .filter((el) => el.getAttribute('aria-current') === 'page');

    expect(marked).toHaveLength(1);
    expect(marked[0].textContent).toBe('Deutschland');
  });

  it('marks nothing on a page outside the navigation', () => {
    at('/impressum');
    render(
      <>
        <NavLink href="/">Start</NavLink>
        <NavLink href="/about">Über mich</NavLink>
      </>,
    );

    expect(
      screen.getAllByRole('link').filter((el) => el.getAttribute('aria-current') === 'page'),
    ).toHaveLength(0);
  });
});
