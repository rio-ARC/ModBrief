interface ConfidenceBadgeProps {
  level: 'high' | 'moderate' | 'limited';
}

const colors: Record<ConfidenceBadgeProps['level'], string> = {
  high: '#1D9E75',
  moderate: '#D97706',
  limited: '#6B7280',
};

export default function ConfidenceBadge({ level }: ConfidenceBadgeProps) {
  return (
    <span
      style={{
        backgroundColor: colors[level],
        color: '#ffffff',
        fontSize: '0.75rem',
        padding: '0.25rem 0.6rem',
        borderRadius: '9999px',
        display: 'inline-flex',
        alignItems: 'center',
        fontWeight: 500,
        textTransform: 'capitalize',
      }}
    >
      {level}
    </span>
  );
}
