import type { ModerationEvent } from '../../shared/types';

interface HistoryTabProps {
  events: ModerationEvent[];
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function HistoryTab({ events }: HistoryTabProps) {
  if (!events || events.length === 0) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#8b949e' }}>
        No moderation history in this subreddit.
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '16px',
        maxHeight: '100%',
        overflowY: 'auto',
        boxSizing: 'border-box',
      }}
    >
      {events.map((event, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            backgroundColor: '#161b22',
            padding: '10px 14px',
            borderRadius: '6px',
            border: '1px solid #30363d',
            gap: '16px',
          }}
        >
          {/* date (left) */}
          <span style={{ color: '#8b949e', fontSize: '0.85rem', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {formatDate(event.timestamp)}
          </span>
          {/* action description (right) */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', textAlign: 'right' }}>
            <span style={{ color: '#e6edf3', fontSize: '0.9rem', fontWeight: 500 }}>
              {event.action.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^[a-z]/, (m) => m.toUpperCase())} by u/{event.moderator}
            </span>
            {event.details && (
              <span style={{ color: '#8b949e', fontSize: '0.8rem', marginTop: '2px' }}>
                {event.details}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
