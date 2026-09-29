// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import NewPageDialog from '../components/page-builder/NewPageDialog';

afterEach(cleanup);

const taken = { subpages: [], albums: [], journal: [] };

function setup() {
  const onCreate = vi.fn();
  render(
    <NewPageDialog
      taken={taken}
      existingPageSlugs={[]}
      creating={false}
      onCreate={onCreate}
      onClose={() => {}}
    />,
  );
  return { onCreate, slug: screen.getByLabelText('URL') as HTMLInputElement };
}

/** Type one key at a time into a controlled input, as a person does. */
function typeKeys(input: HTMLInputElement, text: string) {
  for (const ch of text) fireEvent.change(input, { target: { value: input.value + ch } });
}

describe('NewPageDialog slug field', () => {
  it('takes a hyphen typed between two words', () => {
    const { slug, onCreate } = setup();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'About' } });
    // Select all and retype: the first key replaces the derived slug.
    fireEvent.change(slug, { target: { value: 'a' } });
    typeKeys(slug, 'bout-us');
    expect(slug.value).toBe('about-us');

    fireEvent.click(screen.getByRole('button', { name: 'Create page' }));
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ slug: 'about-us' }));
  });

  it('creates the finished slug when the field ends in a hyphen', () => {
    const { slug, onCreate } = setup();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Pricing' } });
    typeKeys(slug, '-');
    expect(slug.value).toBe('pricing-');

    fireEvent.click(screen.getByRole('button', { name: 'Create page' }));
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ slug: 'pricing' }));
  });

  it('derives a readable slug from a German title', () => {
    const { slug } = setup();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Preise für Paare' } });
    expect(slug.value).toBe('preise-fur-paare');
  });
});
