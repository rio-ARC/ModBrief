import type { ScoredSignal } from '../../shared/types';
import SignalCard from '../components/SignalCard';

interface SignalGridProps {
  signals: ScoredSignal[];
}

const severityWeight = {
  concern: 1,
  watch: 2,
  clean: 3,
};

export default function SignalGrid({ signals }: SignalGridProps) {
  const sortedSignals = [...signals].sort(
    (a, b) => severityWeight[a.severity] - severityWeight[b.severity]
  );

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '12px',
        padding: '16px',
      }}
    >
      {sortedSignals.map((signal) => (
        <SignalCard
          key={signal.id}
          label={signal.label}
          value={signal.value}
          severity={signal.severity}
        />
      ))}
    </div>
  );
}
