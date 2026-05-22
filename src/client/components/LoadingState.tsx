export default function LoadingState() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        width: '100%',
        padding: '16px',
        boxSizing: 'border-box',
      }}
    >
      <style>
        {`
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 0.4;
            }
          }
          .skeleton-pulse-bar {
            height: 16px;
            background-color: #30363d;
            border-radius: 4px;
            width: 100%;
            animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          }
        `}
      </style>
      <div className="skeleton-pulse-bar" style={{ width: '80%' }} />
      <div className="skeleton-pulse-bar" style={{ width: '100%' }} />
      <div className="skeleton-pulse-bar" style={{ width: '60%' }} />
    </div>
  );
}
