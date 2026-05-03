// ─── CommandPalette — Chantier E2 ─────────────────────────────────────
// Recherche globale Cmd+K (ou Ctrl+K). Indexe profils, publications,
// événements, mentions presse + raccourcis vers les pages.
//
// Sélection clavier (↑ ↓ Enter) ; Esc ou clic outside ferme.

import { useEffect, useMemo, useRef, useState } from 'react';
import { NAV_GROUPS } from '../../utils/constants';

function norm(s) {
  return (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export default function CommandPalette({ open, onClose, onTabChange, auteurs = [], articles = [], events = [], presse = [] }) {
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Build index une fois — ré-évalué quand les listes changent.
  const items = useMemo(() => {
    const all = [];
    NAV_GROUPS.forEach(g => g.items.forEach(it => all.push({
      kind: 'page', label: it.label, icon: it.icon, action: () => onTabChange(it.key),
      hint: 'Page',
    })));
    auteurs.forEach(a => {
      const name = `${a.firstName || ''} ${a.lastName || ''}`.trim() || a.name || a.id;
      all.push({
        kind: 'profil', label: name, icon: '\u{1F464}', hint: a.role || 'Profil',
        meta: name + ' ' + (a.role || '') + ' ' + (a.bioCourte || a.bio || ''),
        action: () => onTabChange('profils'),
      });
    });
    articles.forEach(a => {
      all.push({
        kind: 'publi', label: a.title, icon: '\u{1F4C4}', hint: a.author || 'Publication',
        meta: a.title + ' ' + (a.author || '') + ' ' + (a.tags || []).join(' '),
        action: () => onTabChange('articles'),
      });
    });
    events.forEach(e => {
      all.push({
        kind: 'evt', label: e.title || e.titre || '(sans titre)', icon: '\u{1F4C5}',
        hint: `${e.date || ''} ${e.lieu || ''}`.trim() || 'Événement',
        meta: (e.title || e.titre || '') + ' ' + (e.lieu || '') + ' ' + (e.partenaire || ''),
        action: () => onTabChange('evenements'),
      });
    });
    presse.forEach(p => {
      all.push({
        kind: 'presse', label: p.title || '(sans titre)', icon: '\u{1F4F0}',
        hint: `${p.media || ''} · ${p.date || ''}`.trim() || 'Presse',
        meta: (p.title || '') + ' ' + (p.media || '') + ' ' + (p.auteur || ''),
        action: () => onTabChange('presse'),
      });
    });
    return all;
  }, [auteurs, articles, events, presse, onTabChange]);

  const filtered = useMemo(() => {
    const q = norm(query.trim());
    if (!q) return items.slice(0, 50);
    const tokens = q.split(/\s+/);
    return items.filter(it => {
      const hay = norm(it.label + ' ' + (it.meta || ''));
      return tokens.every(t => hay.includes(t));
    }).slice(0, 50);
  }, [items, query]);

  // Reset state à chaque ouverture
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);
      // Focus input après le rendu
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => { setActiveIdx(0); }, [query]);

  // Maintient l'item actif visible
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector('[data-active="true"]');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [activeIdx, open]);

  if (!open) return null;

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const it = filtered[activeIdx];
      if (it) { it.action(); onClose(); }
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
        zIndex: 9999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '10vh',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(640px, 92vw)', background: '#fff', borderRadius: 12,
          boxShadow: '0 20px 50px rgba(0,0,0,0.25)', overflow: 'hidden',
          display: 'flex', flexDirection: 'column', maxHeight: '70vh',
        }}
      >
        <div style={{ padding: 12, borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18, color: '#9CA3AF' }}>⌕</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Rechercher un profil, une publication, un événement…"
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15, padding: '6px 4px', background: 'transparent' }}
          />
          <kbd style={kbdStyle}>Esc</kbd>
        </div>
        <div ref={listRef} style={{ overflowY: 'auto', flex: 1 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#9CA3AF', fontSize: 14 }}>
              Aucun résultat.
            </div>
          ) : (
            filtered.map((it, i) => (
              <div
                key={`${it.kind}-${i}`}
                data-active={i === activeIdx}
                onClick={() => { it.action(); onClose(); }}
                onMouseEnter={() => setActiveIdx(i)}
                style={{
                  padding: '10px 14px', cursor: 'pointer',
                  background: i === activeIdx ? '#EBF4FF' : 'transparent',
                  display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #F3F4F6',
                }}
              >
                <span style={{ fontSize: 18, width: 22, textAlign: 'center' }}>{it.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.label}</div>
                  {it.hint && (
                    <div style={{ fontSize: 12, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.hint}</div>
                  )}
                </div>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: '#F3F4F6', color: '#6B7280' }}>
                  {kindLabel(it.kind)}
                </span>
              </div>
            ))
          )}
        </div>
        <div style={{ padding: '8px 14px', borderTop: '1px solid #E5E7EB', fontSize: 11, color: '#9CA3AF', display: 'flex', gap: 12, justifyContent: 'space-between' }}>
          <span><kbd style={kbdStyle}>↑↓</kbd> naviguer · <kbd style={kbdStyle}>↵</kbd> ouvrir</span>
          <span>{filtered.length} résultat{filtered.length > 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  );
}

function kindLabel(k) {
  return { page: 'Page', profil: 'Profil', publi: 'Publication', evt: 'Événement', presse: 'Presse' }[k] || '';
}

const kbdStyle = {
  fontFamily: 'monospace', fontSize: 11, padding: '2px 6px',
  border: '1px solid #E5E7EB', borderRadius: 4, background: '#F9FAFB', color: '#6B7280',
};
