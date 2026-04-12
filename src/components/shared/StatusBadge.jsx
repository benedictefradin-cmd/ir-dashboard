export default function StatusBadge({ label, type }) {
  return <span className={`badge badge-${type || 'gray'}`}>{label}</span>;
}
