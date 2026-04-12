export default function StatsCard({ label, value, sub, accentColor, variation, onClick, style }) {
  return (
    <div
      className="stat-card slide-up"
      style={{ borderLeftColor: accentColor || 'var(--sky)', cursor: onClick ? 'pointer' : 'default', ...style }}
      onClick={onClick}
    >
      <p className="stat-label">{label}</p>
      <p className="stat-value" style={{ color: accentColor || 'var(--navy)' }}>{value}</p>
      <div className="stat-sub">
        {variation && (
          <span className={`stat-variation ${variation.direction}`}>
            {variation.direction === 'up' ? '↑' : variation.direction === 'down' ? '↓' : ''} {variation.pct} %
          </span>
        )}
        {sub && <span>{sub}</span>}
      </div>
    </div>
  );
}
