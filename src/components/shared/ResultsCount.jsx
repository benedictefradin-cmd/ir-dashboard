// Affiche "N élément(s) trouvé(s)" sous une barre de filtres,
// avec un bouton optionnel "Effacer les filtres" si filtré.
export default function ResultsCount({
  count,
  total,
  itemLabel = 'élément',
  itemLabelPlural,
  onReset,
}) {
  if (typeof count !== 'number') return null;

  const plural = itemLabelPlural || `${itemLabel}s`;
  const label = count === 0 ? `Aucun ${itemLabel}` : count === 1 ? `1 ${itemLabel}` : `${count} ${plural}`;
  const isFiltered = typeof total === 'number' && count !== total;

  return (
    <div
      style={{
        margin: '8px 0 14px',
        fontSize: 13,
        color: 'var(--text-light, #6b7280)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
      }}
    >
      <span>
        {label}
        {isFiltered && total != null ? ` sur ${total}` : ''}
      </span>
      {isFiltered && onReset && (
        <button
          type="button"
          onClick={onReset}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--sky, #0066c0)',
            cursor: 'pointer',
            padding: 0,
            fontSize: 13,
            textDecoration: 'underline',
          }}
        >
          Effacer les filtres
        </button>
      )}
    </div>
  );
}
