import { useState, useMemo, useRef, useEffect } from 'react';
import { COLORS } from '../../utils/constants';

/**
 * Combobox cherchable : input texte qui filtre une liste d'options et permet
 * de sélectionner une valeur. Adapté aux longues listes (200+ éléments) où
 * un <select> classique devient inutilisable.
 *
 * Props :
 *   - options    : Array<{ value, label, hint? }>
 *   - value      : valeur sélectionnée (string ou '')
 *   - onChange   : (value) => void
 *   - placeholder
 *   - emptyLabel : label affiché pour la valeur vide (ex: '— Aucun —')
 */
export default function SearchableSelect({ options = [], value, onChange, placeholder = 'Rechercher…', emptyLabel = '— Aucun —' }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const selected = useMemo(() => options.find(o => o.value === value), [options, value]);

  const filtered = useMemo(() => {
    if (!search.trim()) return options.slice(0, 50);
    const q = search.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    return options.filter(o => {
      const hay = (o.label + ' ' + (o.hint || '')).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      return q.split(/\s+/).every(t => hay.includes(t));
    }).slice(0, 100);
  }, [options, search]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const pick = (val) => {
    onChange(val);
    setOpen(false);
    setSearch('');
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', padding: '8px 12px', textAlign: 'left',
          background: '#fff', border: `1px solid ${COLORS.border}`, borderRadius: 6,
          cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontSize: 14, color: selected ? COLORS.text : COLORS.textLight,
        }}>
        <span>{selected ? selected.label : emptyLabel}</span>
        <span style={{ fontSize: 10, color: COLORS.textLight }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 1000,
          background: '#fff', border: `1px solid ${COLORS.border}`, borderRadius: 6,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: 320, overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}>
          <input
            type="text"
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={placeholder}
            style={{
              padding: '8px 12px', border: 'none', borderBottom: `1px solid ${COLORS.border}`,
              outline: 'none', fontSize: 14,
            }}
          />
          <div style={{ overflowY: 'auto', flex: 1 }}>
            <div
              onClick={() => pick('')}
              style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13,
                color: COLORS.textLight, borderBottom: `1px solid ${COLORS.border}` }}
            >
              {emptyLabel}
            </div>
            {filtered.length === 0 ? (
              <div style={{ padding: '12px', fontSize: 13, color: COLORS.textLight, textAlign: 'center' }}>
                Aucun résultat
              </div>
            ) : (
              filtered.map(o => (
                <div
                  key={o.value}
                  onClick={() => pick(o.value)}
                  style={{
                    padding: '8px 12px', cursor: 'pointer', fontSize: 14,
                    background: o.value === value ? COLORS.skyLight : 'transparent',
                    display: 'flex', justifyContent: 'space-between', gap: 8,
                  }}
                  onMouseEnter={e => { if (o.value !== value) e.currentTarget.style.background = '#f5f5f5'; }}
                  onMouseLeave={e => { if (o.value !== value) e.currentTarget.style.background = 'transparent'; }}
                >
                  <span>{o.label}</span>
                  {o.hint && <span style={{ color: COLORS.textLight, fontSize: 12 }}>{o.hint}</span>}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
