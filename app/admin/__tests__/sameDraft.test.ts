import { describe, it, expect } from 'vitest';
import { sameDraft } from '../components/sameDraft';

/**
 * "Unsaved changes" stayed up after an edit was typed back to the saved value
 * (QA A-19): the editors only ever set their dirty flag. They now also compare
 * with the saved state, which has to see through what an undone edit leaves.
 */
describe('sameDraft', () => {
  it('is false for a real change', () => {
    expect(sameDraft({ title: 'A' }, { title: 'B' })).toBe(false);
    expect(sameDraft({ navLinks: [{ label: 'A' }] }, { navLinks: [] })).toBe(false);
    expect(sameDraft({ albums: ['a', 'b'] }, { albums: ['b', 'a'] })).toBe(false);
  });

  it('ignores key order — a deleted key typed again moves to the end', () => {
    expect(
      sameDraft(
        { theme: { accent: '#fff', preset: 'noir' } },
        {
          theme: { preset: 'noir', accent: '#fff' },
        },
      ),
    ).toBe(true);
  });

  it('ignores the empty parent objects a settings edit creates', () => {
    expect(sameDraft({ title: 'A', contact: {} }, { title: 'A' })).toBe(true);
    expect(sameDraft({ theme: { fonts: {} } }, {})).toBe(true);
  });

  it('ignores undefined, which the YAML never holds', () => {
    expect(sameDraft({ title: 'A', subtitle: undefined }, { title: 'A' })).toBe(true);
  });
});
