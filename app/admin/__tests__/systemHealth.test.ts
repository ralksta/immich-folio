import { describe, it, expect } from 'vitest';
import { systemHealth, type SystemHealthInput } from '../components/systemHealth';

const base: SystemHealthInput = {
  statusLoading: false,
  setupIncomplete: false,
  immich: 'ok',
  doctorLevel: null,
};
const health = (over: Partial<SystemHealthInput> = {}) => systemHealth({ ...base, ...over });

describe('systemHealth', () => {
  it('reports a healthy system', () => {
    expect(health()).toEqual({ tone: 'connected', label: 'System OK' });
  });

  it('stays neutral while loading', () => {
    expect(health({ statusLoading: true })).toEqual({ tone: 'unknown', label: 'Checking...' });
  });

  it('keeps the badge neutral while a stale error is being rechecked', () => {
    // The class used to have no loading case, so a doctor error left over from
    // the previous run painted the badge red under "Checking..." (#539).
    expect(health({ statusLoading: true, immich: 'unknown', doctorLevel: 'error' })).toEqual({
      tone: 'unknown',
      label: 'Checking...',
    });
  });

  it('treats an unfinished install as neutral, not as a fault', () => {
    expect(health({ setupIncomplete: true, immich: 'error' })).toEqual({
      tone: 'unknown',
      label: 'Setup Incomplete',
    });
  });

  it('lets an unreachable Immich outrank a doctor warning', () => {
    // The class matched `warn` first and went neutral while the text said
    // "System Degraded" — the less serious condition decided the colour (#539).
    expect(health({ immich: 'error', doctorLevel: 'warn' })).toEqual({
      tone: 'disconnected',
      label: 'System Degraded',
    });
  });

  it('reports a doctor error when Immich itself is fine', () => {
    expect(health({ doctorLevel: 'error' })).toEqual({
      tone: 'disconnected',
      label: 'Needs Attention',
    });
  });

  it('reports a doctor warning as neutral', () => {
    expect(health({ doctorLevel: 'warn' })).toEqual({
      tone: 'unknown',
      label: 'Check Diagnostics',
    });
  });

  it('falls back to unknown when Immich is neither ok nor in error', () => {
    expect(health({ immich: 'unknown' })).toEqual({ tone: 'unknown', label: 'Status Unknown' });
  });

  it('never pairs a label with a tone that contradicts it', () => {
    const expected: Record<string, string> = {
      'Checking...': 'unknown',
      'Setup Incomplete': 'unknown',
      'System Degraded': 'disconnected',
      'Needs Attention': 'disconnected',
      'Check Diagnostics': 'unknown',
      'System OK': 'connected',
      'Status Unknown': 'unknown',
    };
    for (const statusLoading of [false, true]) {
      for (const setupIncomplete of [false, true]) {
        for (const immich of ['ok', 'error', 'unknown']) {
          for (const doctorLevel of [null, 'ok', 'warn', 'error'] as const) {
            const { tone, label } = health({ statusLoading, setupIncomplete, immich, doctorLevel });
            expect(expected[label], `${label} with tone ${tone}`).toBe(tone);
          }
        }
      }
    }
  });
});
