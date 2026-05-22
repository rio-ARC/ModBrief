interface EmptyStateProps {
  reason: 'private' | 'new_account' | 'no_data';
}

const messages: Record<EmptyStateProps['reason'], string> = {
  private: 'This user’s profile is private.',
  new_account: 'This account is very new and has no history.',
  no_data: 'No context data is available for this user.',
};

export default function EmptyState({ reason }: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        textAlign: 'center',
        color: '#8b949e',
      }}
    >
      <p style={{ fontSize: '1rem', fontWeight: 500 }}>{messages[reason]}</p>
    </div>
  );
}
