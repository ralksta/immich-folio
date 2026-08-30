import type { DoctorLevel } from '@/lib/admin/doctor';

/** The three tones `status-badge-btn` is styled for. */
export type BadgeTone = 'connected' | 'disconnected' | 'unknown';

export interface SystemHealthInput {
  statusLoading: boolean;
  setupIncomplete: boolean;
  /** `immichIndicator.className` — 'ok', 'error' or 'unknown'. */
  immich: string;
  doctorLevel: DoctorLevel | null;
}

/**
 * What the dashboard's status badge should say, and in which colour.
 *
 * The two used to be decided separately: a four-level nested ternary for the
 * class and a six-level one for the text, over the same four inputs but in a
 * different order. They disagreed in exactly two states (#539):
 *
 * - Immich unreachable while the doctor also warns — the class matched `warn`
 *   first and painted the badge neutral, while the text reported "System
 *   Degraded". The more serious of the two conditions decided the words and the
 *   less serious one decided the colour.
 * - A refetch while a previous run had reported an error — the class had no
 *   loading case at all, so the badge stayed red under "Checking...".
 *
 * The text's ordering wins here, because it is the one that reads most-severe
 * first and the only one that accounted for loading. Deciding both together is
 * the point: a third condition can no longer be added to one and forgotten in
 * the other.
 */
export function systemHealth({
  statusLoading,
  setupIncomplete,
  immich,
  doctorLevel,
}: SystemHealthInput): { tone: BadgeTone; label: string } {
  if (statusLoading) return { tone: 'unknown', label: 'Checking...' };
  // An installation that was never finished is not a fault, so it stays neutral
  // rather than red — the same reasoning that gave it its own label (#507).
  if (setupIncomplete) return { tone: 'unknown', label: 'Setup Incomplete' };
  if (immich === 'error') return { tone: 'disconnected', label: 'System Degraded' };
  if (doctorLevel === 'error') return { tone: 'disconnected', label: 'Needs Attention' };
  if (doctorLevel === 'warn') return { tone: 'unknown', label: 'Check Diagnostics' };
  if (immich === 'ok') return { tone: 'connected', label: 'System OK' };
  return { tone: 'unknown', label: 'Status Unknown' };
}
