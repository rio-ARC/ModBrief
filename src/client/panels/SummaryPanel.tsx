import type { ContextPayload, NarrativeSummary } from '../../shared/types';
import ConfidenceBadge from '../components/ConfidenceBadge';

interface SummaryPanelProps {
  payload: ContextPayload;
  summary: NarrativeSummary;
}

function formatAge(days: number): string {
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  return months > 0 ? `${years}y ${months}mo` : `${years}y`;
}

export default function SummaryPanel({ payload, summary }: SummaryPanelProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px' }}>
      {/* Row: username (bold, large) + account age + ConfidenceBadge component */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#e6edf3', margin: 0 }}>
          u/{payload.username}
        </h2>
        <span style={{ color: '#8b949e', fontSize: '0.9rem' }}>
          • Age: {formatAge(payload.accountAgeDays)}
        </span>
        <ConfidenceBadge level={payload.confidenceLevel} />
      </div>

      {/* If payload.dataPartial === true: amber warning bar "Partial data — some signals unavailable" */}
      {payload.dataPartial && (
        <div
          style={{
            backgroundColor: 'rgba(217, 119, 6, 0.15)',
            border: '1px solid #D97706',
            color: '#FBBF24',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '0.85rem',
            fontWeight: 500,
          }}
        >
          ⚠ Partial data — some signals unavailable
        </div>
      )}

      {/* If payload.isPrivateProfile === true: gray bar "Private profile — subreddit data only" */}
      {payload.isPrivateProfile && (
        <div
          style={{
            backgroundColor: 'rgba(107, 114, 128, 0.15)',
            border: '1px solid #6B7280',
            color: '#9CA3AF',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '0.85rem',
            fontWeight: 500,
          }}
        >
          🔒 Private profile — subreddit data only
        </div>
      )}

      {/* Narrative text (payload.summary.text) in readable font, good line height */}
      <div style={{ marginTop: '8px' }}>
        <p
          style={{
            fontSize: '1.05rem',
            lineHeight: '1.6',
            color: '#e6edf3',
            whiteSpace: 'pre-wrap',
          }}
        >
          {summary.text}
        </p>
      </div>
    </div>
  );
}
