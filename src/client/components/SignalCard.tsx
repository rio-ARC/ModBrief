interface SignalCardProps {
  label: string;
  value: string;
  severity: 'clean' | 'watch' | 'concern';
}

const dotColors = {
  clean: '#1D9E75',
  watch: '#D97706',
  concern: '#DC2626',
};

export default function SignalCard({ label, value, severity }: SignalCardProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#161b22',
        borderRadius: '8px',
        padding: '12px 16px',
        border: '1px solid #30363d',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={{ fontSize: '0.85rem', color: '#8b949e' }}>{label}</span>
        <span style={{ fontSize: '1rem', fontWeight: 600, color: '#e6edf3' }}>{value}</span>
      </div>
      <div
        style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          backgroundColor: dotColors[severity],
          flexShrink: 0,
        }}
      />
    </div>
  );
}
