/**
 * ContextLens — Signal Scorer
 *
 * Input:  ContextPayload
 * Output: ScoredSignal[]
 *
 * Implements exactly 7 signals with the thresholds from the spec.
 * Each signal gets a Tabler icon class name for the WebView.
 */

import type { ContextPayload, ScoredSignal, SignalSeverity } from '../shared/types.js';

// ---------------------------------------------------------------------------
// Threshold constants
// ---------------------------------------------------------------------------

const AGE_CONCERN_DAYS = 7;     // account age < 7 days → concern
const AGE_WATCH_DAYS = 30;      // account age 7–30 days → watch
                                // account age > 30 days → clean

const REMOVALS_WATCH = 1;       // 1–2 removals → watch
const REMOVALS_CONCERN = 3;     // 3+ removals → concern

const REPORTS_WATCH = 1;        // 1–3 reports → watch
const REPORTS_CONCERN = 4;      // 4+ reports → concern

const MOD_NOTES_WATCH = 1;      // exactly 1 note → watch
const MOD_NOTES_CONCERN = 2;    // 2+ notes → concern

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function signal(
  id: string,
  label: string,
  value: string,
  severity: SignalSeverity,
  icon: string
): ScoredSignal {
  return { id, label, value, severity, icon };
}

// ---------------------------------------------------------------------------
// Signal 1 — Account Age
// ---------------------------------------------------------------------------

function scoreAccountAge(payload: ContextPayload): ScoredSignal {
  const days = payload.accountAgeDays;
  let severity: SignalSeverity;
  if (days < AGE_CONCERN_DAYS) severity = 'concern';
  else if (days < AGE_WATCH_DAYS) severity = 'watch';
  else severity = 'clean';

  const value = days === 1 ? '1 day old' : `${days} days old`;
  return signal('account_age', 'Account Age', value, severity, 'ti-calendar');
}

// ---------------------------------------------------------------------------
// Signal 2 — Subreddit Removals
// ---------------------------------------------------------------------------

function scoreRemovals(payload: ContextPayload): ScoredSignal {
  const count = payload.subredditRemovals.length;
  let severity: SignalSeverity;
  if (count >= REMOVALS_CONCERN) severity = 'concern';
  else if (count >= REMOVALS_WATCH) severity = 'watch';
  else severity = 'clean';

  const value = count === 0 ? 'None' : `${count} removal${count > 1 ? 's' : ''}`;
  return signal('removals', 'Removals Here', value, severity, 'ti-shield-x');
}

// ---------------------------------------------------------------------------
// Signal 3 — Reports
// ---------------------------------------------------------------------------

function scoreReports(payload: ContextPayload): ScoredSignal {
  const count = payload.subredditReports;
  let severity: SignalSeverity;
  if (count >= REPORTS_CONCERN) severity = 'concern';
  else if (count >= REPORTS_WATCH) severity = 'watch';
  else severity = 'clean';

  const value = count === 0 ? 'None' : `${count} report${count > 1 ? 's' : ''}`;
  return signal('reports', 'Reports Here', value, severity, 'ti-flag');
}

// ---------------------------------------------------------------------------
// Signal 4 — Posting Burst
// ---------------------------------------------------------------------------

function scorePostingBurst(payload: ContextPayload): ScoredSignal {
  const severity: SignalSeverity = payload.postingBurst ? 'concern' : 'clean';
  const value = payload.postingBurst ? 'Yes — >10 posts/day' : 'No';
  return signal('posting_burst', 'Posting Burst', value, severity, 'ti-bolt');
}

// ---------------------------------------------------------------------------
// Signal 5 — Mod Notes
// ---------------------------------------------------------------------------

function scoreModNotes(payload: ContextPayload): ScoredSignal {
  const count = payload.modNotes.length;
  let severity: SignalSeverity;
  if (count >= MOD_NOTES_CONCERN) severity = 'concern';
  else if (count >= MOD_NOTES_WATCH) severity = 'watch';
  else severity = 'clean';

  const value = count === 0 ? 'None' : `${count} note${count > 1 ? 's' : ''}`;
  return signal('mod_notes', 'Mod Notes', value, severity, 'ti-notes');
}

// ---------------------------------------------------------------------------
// Signal 6 — Toolbox Warning Notes
// ---------------------------------------------------------------------------

function scoreToolboxNotes(payload: ContextPayload): ScoredSignal {
  const count = payload.toolboxNotes.length;
  const severity: SignalSeverity = count > 0 ? 'concern' : 'clean';
  const value = count === 0 ? 'None' : `${count} Toolbox note${count > 1 ? 's' : ''}`;
  return signal('toolbox_notes', 'Toolbox Notes', value, severity, 'ti-alert-triangle');
}

// ---------------------------------------------------------------------------
// Signal 7 — Profile Visibility
// ---------------------------------------------------------------------------

function scoreProfileVisibility(payload: ContextPayload): ScoredSignal {
  const severity: SignalSeverity = payload.isPrivateProfile ? 'concern' : 'clean';
  const value = payload.isPrivateProfile ? 'Private' : 'Public';
  return signal('profile_visibility', 'Profile', value, severity, 'ti-lock');
}

// ---------------------------------------------------------------------------
// Signal 8 — Karma / activity
// ---------------------------------------------------------------------------

function scoreKarmaActivity(payload: ContextPayload): ScoredSignal {
  const { totalKarma, recentCommentCount } = payload;
  return {
    id: 'karma_activity',
    label: 'Karma / activity',
    value: totalKarma < 10 && recentCommentCount === 0 
      ? `${payload.totalKarma} karma, no recent comments`
      : `${payload.totalKarma} karma`,
    severity: payload.totalKarma < 10 && payload.recentCommentCount === 0 
      ? 'watch' 
      : 'clean',
    icon: 'ti-chart-bar'
  };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Score all signals for a given ContextPayload.
 * Returns signals sorted: concern first, then watch, then clean.
 */
export function scoreSignals(payload: ContextPayload): ScoredSignal[] {
  const signals: ScoredSignal[] = [
    scoreAccountAge(payload),
    scoreRemovals(payload),
    scoreReports(payload),
    scorePostingBurst(payload),
    scoreModNotes(payload),
    scoreToolboxNotes(payload),
    scoreProfileVisibility(payload),
    scoreKarmaActivity(payload),
  ];

  const order: Record<SignalSeverity, number> = { concern: 0, watch: 1, clean: 2 };
  return signals.sort((a, b) => order[a.severity] - order[b.severity]);
}
