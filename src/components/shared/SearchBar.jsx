export default function SearchBar({ value, onChange, placeholder }) {
  return (
    <div className="search-input">
      <span className="search-icon">{'\u{1F50D}'}</span>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || 'Rechercher\u2026'}
        style={{ maxWidth: 300 }}
      />
    </div>
  );
}
