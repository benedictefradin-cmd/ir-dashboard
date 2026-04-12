export function SkeletonCard({ count = 4 }) {
  return (
    <div className="grid grid-4" style={{ marginBottom: 24 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton skeleton-card" />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5 }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="skeleton skeleton-title" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton skeleton-row" />
      ))}
    </div>
  );
}

export function SkeletonText({ lines = 3, width }) {
  return (
    <div>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton skeleton-text"
          style={{ width: width || (i === lines - 1 ? '60%' : '100%') }}
        />
      ))}
    </div>
  );
}
