import { useState } from 'react';

interface QuickActionsProps {
  username: string;
  subredditName: string;
  contentId: string;
  summaryText: string;
}

export default function QuickActions({
  username,
  subredditName,
  contentId,
  summaryText,
}: QuickActionsProps) {
  const [activeAction, setActiveAction] = useState<null | 'add_note' | 'remove' | 'ban'>(null);
  const [noteText, setNoteText] = useState(summaryText);
  const [banReason, setBanReason] = useState('Banned by moderator');
  const [isLoading, setIsLoading] = useState(false);

  const handleDismiss = () => {
    window.parent.postMessage({ type: 'CLOSE' }, '*');
  };

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      if (activeAction === 'add_note') {
        await fetch('/api/actions/add-note', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subredditName,
            username,
            note: noteText,
          }),
        });
      } else if (activeAction === 'remove') {
        await fetch('/api/actions/remove-content', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subredditName,
            contentId,
          }),
        });
      } else if (activeAction === 'ban') {
        await fetch('/api/actions/ban-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subredditName,
            username,
            reason: banReason,
          }),
        });
      }
      setActiveAction(null);
    } catch (err) {
      console.error('Action failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (activeAction === 'add_note') {
    return (
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#161b22',
          borderTop: '1px solid #30363d',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          zIndex: 100,
        }}
      >
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          style={{
            width: '100%',
            height: '60px',
            backgroundColor: '#0d1117',
            border: '1px solid #30363d',
            borderRadius: '4px',
            color: '#e6edf3',
            padding: '8px',
            fontSize: '0.9rem',
            resize: 'none',
          }}
        />
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            onClick={() => setActiveAction(null)}
            style={{
              padding: '6px 12px',
              backgroundColor: '#21262d',
              border: '1px solid #30363d',
              borderRadius: '4px',
              color: '#c9d1d9',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            style={{
              padding: '6px 12px',
              backgroundColor: '#1f6feb',
              border: 'none',
              borderRadius: '4px',
              color: '#ffffff',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            {isLoading ? 'Confirming...' : 'Confirm'}
          </button>
        </div>
      </div>
    );
  }

  if (activeAction === 'remove') {
    return (
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#161b22',
          borderTop: '1px solid #30363d',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 100,
        }}
      >
        <span style={{ color: '#e6edf3', fontWeight: 500 }}>Confirm remove?</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveAction(null)}
            style={{
              padding: '6px 12px',
              backgroundColor: '#21262d',
              border: '1px solid #30363d',
              borderRadius: '4px',
              color: '#c9d1d9',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            style={{
              padding: '6px 12px',
              backgroundColor: '#da3633',
              border: 'none',
              borderRadius: '4px',
              color: '#ffffff',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            {isLoading ? 'Confirming...' : 'Confirm'}
          </button>
        </div>
      </div>
    );
  }

  if (activeAction === 'ban') {
    return (
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#161b22',
          borderTop: '1px solid #30363d',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          zIndex: 100,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#e6edf3', fontWeight: 500 }}>Confirm ban?</span>
        </div>
        <input
          type="text"
          value={banReason}
          onChange={(e) => setBanReason(e.target.value)}
          placeholder="Ban reason"
          style={{
            width: '100%',
            backgroundColor: '#0d1117',
            border: '1px solid #30363d',
            borderRadius: '4px',
            color: '#e6edf3',
            padding: '6px 8px',
            fontSize: '0.9rem',
          }}
        />
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            onClick={() => setActiveAction(null)}
            style={{
              padding: '6px 12px',
              backgroundColor: '#21262d',
              border: '1px solid #30363d',
              borderRadius: '4px',
              color: '#c9d1d9',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            style={{
              padding: '6px 12px',
              backgroundColor: '#da3633',
              border: 'none',
              borderRadius: '4px',
              color: '#ffffff',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            {isLoading ? 'Confirming...' : 'Confirm'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#161b22',
        borderTop: '1px solid #30363d',
        padding: '12px 16px',
        display: 'flex',
        gap: '8px',
        justifyContent: 'space-between',
        zIndex: 100,
      }}
    >
      <button
        onClick={() => {
          setNoteText(summaryText);
          setActiveAction('add_note');
        }}
        style={{
          flex: 1,
          padding: '10px 8px',
          backgroundColor: '#21262d',
          border: '1px solid #30363d',
          borderRadius: '6px',
          color: '#c9d1d9',
          fontWeight: 500,
          cursor: 'pointer',
          fontSize: '0.85rem',
        }}
      >
        Add Mod Note
      </button>
      <button
        onClick={() => setActiveAction('remove')}
        style={{
          flex: 1,
          padding: '10px 8px',
          backgroundColor: '#21262d',
          border: '1px solid #30363d',
          borderRadius: '6px',
          color: '#f85149',
          fontWeight: 500,
          cursor: 'pointer',
          fontSize: '0.85rem',
        }}
      >
        Remove Content
      </button>
      <button
        onClick={() => setActiveAction('ban')}
        style={{
          flex: 1,
          padding: '10px 8px',
          backgroundColor: '#21262d',
          border: '1px solid #30363d',
          borderRadius: '6px',
          color: '#f85149',
          fontWeight: 500,
          cursor: 'pointer',
          fontSize: '0.85rem',
        }}
      >
        Ban User
      </button>
      <button
        onClick={handleDismiss}
        style={{
          flex: 1,
          padding: '10px 8px',
          backgroundColor: '#21262d',
          border: '1px solid #30363d',
          borderRadius: '6px',
          color: '#58a6ff',
          fontWeight: 500,
          cursor: 'pointer',
          fontSize: '0.85rem',
        }}
      >
        Dismiss
      </button>
    </div>
  );
}
