/**
 * ContextLens — Narrative Engine
 *
 * Input:  ContextPayload + ScoredSignal[]
 * Output: NarrativeSummary
 *
 * Rules:
 * - Deterministic template logic ONLY — no AI inference
 * - 2–3 sentences maximum
 * - Human moderator tone — not system-alert language
 * - Never use: flagged, detected, algorithm, score, system, AI
 * - Third person about the user
 *
 * Priority cascade: concern signals first, then watch, then clean.
 * All 20 templates approved in Phase 0.
 */

import type { ContextPayload, NarrativeSummary, ScoredSignal } from '../shared/types.js';

// ---------------------------------------------------------------------------
// Template functions — all 20 approved templates
// ---------------------------------------------------------------------------

const TEMPLATE_ALL_CLEAR = (p: ContextPayload): NarrativeSummary => ({
  text: `${p.username} has a clean history in this subreddit — no removals, no reports, and no mod notes. Their account is ${p.accountAgeDays} days old with ${p.totalKarma.toLocaleString()} karma. No immediate action needed.`,
  primarySignal: 'clean',
});

const TEMPLATE_ESTABLISHED_CLEAN = (p: ContextPayload): NarrativeSummary => ({
  text: `${p.username} has been on Reddit for over a year and has no moderation history here. Their activity level is typical, with ${p.recentCommentCount} comment${p.recentCommentCount !== 1 ? 's' : ''} and ${p.recentPostCount} post${p.recentPostCount !== 1 ? 's' : ''} in the last month.`,
  primarySignal: 'clean',
});

const TEMPLATE_LIGHT_ACTIVITY_CLEAN = (p: ContextPayload): NarrativeSummary => {
  let text = `${p.username} has minimal recent activity in this subreddit but no moderation concerns. Account is ${p.accountAgeDays} days old. Nothing stands out.`;
  if (p.totalKarma < 10 && p.recentCommentCount === 0) {
    text += " Account has minimal karma and no recent comments, which may indicate a dormant or newly active account.";
  }
  return {
    text,
    primarySignal: 'clean',
  };
};

const TEMPLATE_NEW_ACCOUNT_WATCH = (p: ContextPayload): NarrativeSummary => ({
  text: `${p.username} created their account ${p.accountAgeDays} day${p.accountAgeDays !== 1 ? 's' : ''} ago, which is relatively new. No removals or mod notes yet. Might be worth keeping an eye on as they're still establishing a presence.`,
  primarySignal: 'account_age',
});

const TEMPLATE_FEW_REMOVALS_WATCH = (p: ContextPayload): NarrativeSummary => ({
  text: `${p.username} has had ${p.subredditRemovals.length} post or comment removed in this subreddit recently. Could be a one-off — their overall history is otherwise unremarkable.`,
  primarySignal: 'removals',
});

const TEMPLATE_MINOR_REPORTS_WATCH = (p: ContextPayload): NarrativeSummary => ({
  text: `${p.username} has received ${p.subredditReports} report${p.subredditReports !== 1 ? 's' : ''} in this subreddit. No previous mod actions taken. Worth a quick look at what's being reported.`,
  primarySignal: 'reports',
});

const TEMPLATE_SINGLE_MOD_NOTE = (p: ContextPayload): NarrativeSummary => ({
  text: `${p.username} has one mod note on record. Their recent activity includes ${p.recentCommentCount} comment${p.recentCommentCount !== 1 ? 's' : ''} and ${p.recentPostCount} post${p.recentPostCount !== 1 ? 's' : ''}. Review the note for context before taking action.`,
  primarySignal: 'mod_notes',
});

const TEMPLATE_REMOVAL_BURST = (p: ContextPayload): NarrativeSummary => ({
  text: `${p.username} has ${p.subredditRemovals.length} removed post${p.subredditRemovals.length !== 1 ? 's' : ''} or comment${p.subredditRemovals.length !== 1 ? 's' : ''} in this subreddit recently and shows an unusually high posting rate. This pattern sometimes indicates an attempt to saturate the queue. Worth reviewing the removal reasons before taking action.`,
  primarySignal: 'removals',
});

const TEMPLATE_MANY_REMOVALS = (p: ContextPayload): NarrativeSummary => ({
  text: `${p.username} has ${p.subredditRemovals.length} removals in this subreddit. This is above average and may indicate a pattern of rule-breaking behavior. Review the specific removal reasons.`,
  primarySignal: 'removals',
});

const TEMPLATE_HIGH_REPORTS = (p: ContextPayload): NarrativeSummary => ({
  text: `${p.username} has been reported ${p.subredditReports} times in this subreddit. Multiple community members have raised concerns about this user's contributions.`,
  primarySignal: 'reports',
});

const TEMPLATE_BRAND_NEW_CONCERNS = (p: ContextPayload): NarrativeSummary => ({
  text: `${p.username}'s account is only ${p.accountAgeDays} day${p.accountAgeDays !== 1 ? 's' : ''} old and already has ${p.subredditRemovals.length} removal${p.subredditRemovals.length !== 1 ? 's' : ''}. New accounts with early moderation issues often require closer attention.`,
  primarySignal: 'account_age',
});

const TEMPLATE_POSTING_BURST_ONLY = (p: ContextPayload): NarrativeSummary => ({
  text: `${p.username} has posted at an unusually high rate — more than 10 actions in a single 24-hour window. This kind of burst activity is sometimes associated with spam or coordinated behavior.`,
  primarySignal: 'posting_burst',
});

const TEMPLATE_MULTIPLE_MOD_NOTES = (p: ContextPayload): NarrativeSummary => ({
  text: `${p.username} has ${p.modNotes.length} mod notes on record from previous moderator reviews. This user has been on the team's radar before. Check the notes for context.`,
  primarySignal: 'mod_notes',
});

const TEMPLATE_TOOLBOX_WARNINGS = (p: ContextPayload): NarrativeSummary => ({
  text: `${p.username} has Toolbox usernotes indicating previous warnings or actions. Combined with their recent activity, this user may need escalated attention.`,
  primarySignal: 'toolbox_notes',
});

const TEMPLATE_REMOVAL_AND_REPORTS = (p: ContextPayload): NarrativeSummary => ({
  text: `${p.username} has both ${p.subredditRemovals.length} removal${p.subredditRemovals.length !== 1 ? 's' : ''} and ${p.subredditReports} report${p.subredditReports !== 1 ? 's' : ''} in this subreddit. The combination of moderator and community concerns suggests a pattern worth investigating.`,
  primarySignal: 'removals',
});

const TEMPLATE_PRIVATE_CLEAN = (p: ContextPayload): NarrativeSummary => ({
  text: `${p.username} has a private profile, so cross-subreddit history isn't available. Within this subreddit, their record is clean — no removals, reports, or mod notes.`,
  primarySignal: 'private_profile',
});

const TEMPLATE_PRIVATE_CONCERNS = (p: ContextPayload): NarrativeSummary => ({
  text: `${p.username} has a private profile, limiting visibility into their broader Reddit activity. However, within this subreddit they have ${p.subredditRemovals.length} removal${p.subredditRemovals.length !== 1 ? 's' : ''}. The private profile combined with local issues is worth noting.`,
  primarySignal: 'private_profile',
});

const TEMPLATE_PARTIAL_DATA = (p: ContextPayload): NarrativeSummary => ({
  text: `Some data for ${p.username} couldn't be retrieved in time. What is available shows ${p.subredditRemovals.length} removal${p.subredditRemovals.length !== 1 ? 's' : ''} and ${p.subredditReports} report${p.subredditReports !== 1 ? 's' : ''}. Consider re-checking if you need a complete picture.`,
  primarySignal: 'data_partial',
});

const TEMPLATE_NO_DATA = (p: ContextPayload): NarrativeSummary => ({
  text: `${p.username} has no moderation history, no reports, and no mod notes in this subreddit. They may be new to this community or simply haven't drawn any attention yet.`,
  primarySignal: 'no_data',
});

// Fallback
const TEMPLATE_FALLBACK = (p: ContextPayload): NarrativeSummary => ({
  text: `${p.username} has ${p.subredditRemovals.length} removal${p.subredditRemovals.length !== 1 ? 's' : ''}, ${p.subredditReports} report${p.subredditReports !== 1 ? 's' : ''}, and ${p.modNotes.length} mod note${p.modNotes.length !== 1 ? 's' : ''} in this subreddit.`,
  primarySignal: 'mixed',
});

// ---------------------------------------------------------------------------
// Cascade logic
// ---------------------------------------------------------------------------

/**
 * Generate a NarrativeSummary for the given payload and scored signals.
 * Deterministic — same inputs always produce the same output.
 */
export function generateNarrative(
  payload: ContextPayload,
  signals: ScoredSignal[]
): NarrativeSummary {
  const concerns = signals.filter((s) => s.severity === 'concern');
  const watches = signals.filter((s) => s.severity === 'watch');

  const hasConcern = (id: string) => concerns.some((s) => s.id === id);
  const hasWatch = (id: string) => watches.some((s) => s.id === id);

  // Partial data banner — applied on top of whatever narrative we pick
  if (payload.dataPartial && concerns.length === 0 && watches.length === 0) {
    return TEMPLATE_PARTIAL_DATA(payload);
  }

  // Private profile first
  if (payload.isPrivateProfile && concerns.length === 0) {
    return TEMPLATE_PRIVATE_CLEAN(payload);
  }
  if (payload.isPrivateProfile && concerns.length > 0) {
    return TEMPLATE_PRIVATE_CONCERNS(payload);
  }

  // All clear
  if (concerns.length === 0 && watches.length === 0) {
    if (payload.accountAgeDays > 365 && (payload.recentCommentCount + payload.recentPostCount) > 0) {
      return TEMPLATE_ESTABLISHED_CLEAN(payload);
    }
    if ((payload.recentCommentCount + payload.recentPostCount) < 3) {
      return TEMPLATE_LIGHT_ACTIVITY_CLEAN(payload);
    }
    return TEMPLATE_ALL_CLEAR(payload);
  }

  // === Concern-level cascades ===

  // Both removals + burst → most alarming combination
  if (hasConcern('removals') && hasConcern('posting_burst')) {
    return TEMPLATE_REMOVAL_BURST(payload);
  }

  // Both removals + reports
  if (hasConcern('removals') && (hasConcern('reports') || hasWatch('reports'))) {
    return TEMPLATE_REMOVAL_AND_REPORTS(payload);
  }

  // Brand new account with removals
  if (hasConcern('account_age') && hasConcern('removals')) {
    return TEMPLATE_BRAND_NEW_CONCERNS(payload);
  }

  // Many removals (standalone)
  if (hasConcern('removals')) {
    return TEMPLATE_MANY_REMOVALS(payload);
  }

  // High reports (standalone)
  if (hasConcern('reports')) {
    return TEMPLATE_HIGH_REPORTS(payload);
  }

  // Posting burst (standalone concern, no removals)
  if (hasConcern('posting_burst')) {
    return TEMPLATE_POSTING_BURST_ONLY(payload);
  }

  // Multiple mod notes
  if (hasConcern('mod_notes')) {
    return TEMPLATE_MULTIPLE_MOD_NOTES(payload);
  }

  // Toolbox warnings
  if (hasConcern('toolbox_notes')) {
    return TEMPLATE_TOOLBOX_WARNINGS(payload);
  }

  // === Watch-level cascades ===

  // New account (watch)
  if (hasWatch('account_age')) {
    return TEMPLATE_NEW_ACCOUNT_WATCH(payload);
  }

  // Few removals (watch)
  if (hasWatch('removals')) {
    return TEMPLATE_FEW_REMOVALS_WATCH(payload);
  }

  // Minor reports (watch)
  if (hasWatch('reports')) {
    return TEMPLATE_MINOR_REPORTS_WATCH(payload);
  }

  // Single mod note (watch)
  if (hasWatch('mod_notes')) {
    return TEMPLATE_SINGLE_MOD_NOTE(payload);
  }

  // Partial data with some signals
  if (payload.dataPartial) {
    return TEMPLATE_PARTIAL_DATA(payload);
  }

  // Truly no data (confidenceLevel limited, no signals)
  if (payload.confidenceLevel === 'limited') {
    return TEMPLATE_NO_DATA(payload);
  }

  return TEMPLATE_FALLBACK(payload);
}
