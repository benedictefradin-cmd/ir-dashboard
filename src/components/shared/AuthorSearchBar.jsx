import { useState, useMemo, useRef, useEffect } from 'react';
import { COLORS } from '../../utils/constants';

/**
 * AuthorSearchBar — picker compact (Brief 2026-05-08).
 * Une simple barre de recherche : tape un nom → autocomplete dropdown des
 * profils existants → click pour sélectionner. Multi-select via chips.
 *
 * Remplace l'ancienne grille de cartes (trop encombrante dans le formulaire
 * d'édition d'article).
 *
 * Props :
 *   - authors      : tableau de profils (avec id, firstName, lastName)
 *   - selected     : tableau d'IDs sélectionnés
 *   - onChange     : (ids) => void
 *   - onAddNew     : () => void  (optionnel : ouvre une modale création rapide)
 *   - placeholder  : string
 */
function normalize(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export default function AuthorSearchBar({
  authors = [],
  selected = [],
  onChange,
  onAddNew,
  placeholder = 'Tape un nom pour chercher un profil…',
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapperRef = useRef(null);

  // Profils sélectionnés (chips)
  const selectedAuthors = useMemo(
    () => selected.map(id => authors.find(a => a.id === id)).filter(Boolean),
    [authors, selected]
  );

  // Suggestions filtrées (top 8)
  const suggestions = useMemo(() => {
    const q = normalize(query);
    if (!q) return [];
    return authors
      .filter(a => a.actif !== false)
      .filter(a => !selected.includes(a.id))
      .filter(a => {
        const hay = normalize(`${a.firstName || ''} ${a.lastName || ''} ${a.roleLibelle || a.role || ''}`);
        return q.split(/\s+/).every(t => hay.includes(t));
      })
      .slice(0, 8);
  }, [authors, query, selected]);

  // Ferme le dropdown au clic extérieur
  useEffect(() => {
    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const addId = (id) => {
    if (selected.includes(id)) return;
    onChange([...selected, id]);
    setQuery('');
    setOpen(false);
  };
  const removeId = (id) => onChange(selected.filter(x => x !== id));

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHighlight(h => Math.min(h + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter' && open && suggestions[highlight]) { e.preventDefault(); addId(suggestions[highlight].id); }
    else if (e.key === 'Backspace' && !query && selectedAuthors.length) { removeId(selectedAuthors[selectedAuthors.length - 1].id); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          alignItems: 'center',
          padding: '6px 10px',
          border: '1px solid var(--border)',
          borderRadius: 8,
          background: '#fff',
          minHeight: 42,
        }}
      >
        {selectedAuthors.map(a => (
          <span
            key={a.id}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 8px 3px 10px',
              background: COLORS.navy,
              color: '#fff',
              borderRadius: 12,
              fontSize: 13,
            }}
          >
            {a.firstName} {a.lastName}
            <button
              type="button"
              onClick={() => removeId(a.id)}
              style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0 }}
              aria-label={`Retirer ${a.firstName} ${a.lastName}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); setHighlight(0); }}
          onFocus={() => query && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={selectedAuthors.length ? '+ ajouter…' : placeholder}
          style={{
            flex: 1,
            minWidth: 140,
            border: 'none',
            outline: 'none',
            padding: '4px',
            fontSize: 14,
            background: 'transparent',
          }}
        />
      </div>

      {open && (suggestions.length > 0 || (query && onAddNew)) && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 4,
            background: '#fff',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            zIndex: 50,
            maxHeight: 280,
            overflowY: 'auto',
          }}
        >
          {suggestions.map((a, i) => (
            <div
              key={a.id}
              onMouseDown={(e) => { e.preventDefault(); addId(a.id); }}
              onMouseEnter={() => setHighlight(i)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                background: i === highlight ? '#f3f4f6' : 'transparent',
                fontSize: 14,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <span><strong>{a.firstName} {a.lastName}</strong></span>
              {(a.roleLibelle || a.role) && (
                <span style={{ fontSize: 12, color: 'var(--text-light)' }}>
                  {(a.roleLibelle || a.role).slice(0, 50)}
                </span>
              )}
            </div>
          ))}
          {query && onAddNew && (
            <div
              onMouseDown={(e) => { e.preventDefault(); onAddNew(query); setQuery(''); setOpen(false); }}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                fontSize: 13,
                color: COLORS.navy,
                borderTop: suggestions.length ? '1px solid var(--border)' : 'none',
                background: '#f9fafb',
              }}
            >
              + Créer un nouveau profil « {query} »
            </div>
          )}
        </div>
      )}
    </div>
  );
}
