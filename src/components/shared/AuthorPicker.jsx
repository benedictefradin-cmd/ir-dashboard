import { useState, useMemo } from 'react';
import useDebounce from '../../hooks/useDebounce';
import { COLORS } from '../../utils/constants';
import RepoPhoto from './RepoPhoto';

const avatarColors = [COLORS.navy, COLORS.sky, COLORS.terra, COLORS.ochre, COLORS.green];

function normalize(str) {
  return (str || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export default function AuthorPicker({ authors = [], selected = [], onChange, multiple = true, onAddNew }) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 150);

  const filtered = useMemo(() => {
    if (!debouncedSearch) return authors;
    const q = normalize(debouncedSearch);
    return authors.filter(a =>
      normalize(a.firstName).includes(q) ||
      normalize(a.lastName).includes(q) ||
      normalize(`${a.firstName} ${a.lastName}`).includes(q) ||
      normalize(a.role).includes(q) ||
      normalize(a.name).includes(q)
    );
  }, [authors, debouncedSearch]);

  const toggleAuthor = (authorId) => {
    if (multiple) {
      const next = selected.includes(authorId)
        ? selected.filter(id => id !== authorId)
        : [...selected, authorId];
      onChange(next);
    } else {
      onChange(selected.includes(authorId) ? [] : [authorId]);
    }
  };

  const selectedAuthors = authors.filter(a => selected.includes(a.id));

  const getInitial = (a) => {
    if (a.firstName) return a.firstName.charAt(0).toUpperCase();
    if (a.name) return a.name.charAt(0).toUpperCase();
    return '?';
  };

  const getDisplayName = (a) => {
    if (a.firstName && a.lastName) return `${a.firstName} ${a.lastName}`;
    return a.name || '';
  };

  return (
    <div className="author-picker">
      {/* Search bar */}
      <div className="author-picker-search">
        <span className="author-picker-search-icon">&#128269;</span>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un profil…"
          className="author-picker-input"
        />
      </div>

      {/* Selected chips */}
      {multiple && selectedAuthors.length > 0 && (
        <div className="author-picker-chips">
          {selectedAuthors.map(a => (
            <span key={a.id} className="author-chip">
              {getDisplayName(a)}
              <button
                type="button"
                className="author-chip-remove"
                onClick={() => toggleAuthor(a.id)}
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Author grid */}
      <div className="author-picker-grid">
        {filtered.map((a, i) => {
          const isSelected = selected.includes(a.id);
          return (
            <div
              key={a.id}
              className={`author-picker-card${isSelected ? ' selected' : ''}`}
              onClick={() => toggleAuthor(a.id)}
            >
              <div className="author-picker-avatar" style={{
                backgroundColor: a.photo ? 'transparent' : avatarColors[i % avatarColors.length],
                color: '#fff',
                fontSize: 20,
                fontFamily: "'Cormorant Garamond', serif",
                fontWeight: 700,
              }}>
                <RepoPhoto
                  photo={a.photoPath || a.photo}
                  alt={getDisplayName(a)}
                  fallback={<>{getInitial(a)}</>}
                />
              </div>
              <div className="author-picker-info">
                <span className="author-picker-name">{getDisplayName(a)}</span>
                {a.role && <span className="author-picker-role">{a.role}</span>}
              </div>
              {isSelected && <span className="author-picker-check">&#10003;</span>}
            </div>
          );
        })}

        {/* Add new button */}
        {onAddNew && (
          <div className="author-picker-card author-picker-add" onClick={onAddNew}>
            <div className="author-picker-avatar" style={{ backgroundColor: '#F3F4F6', color: COLORS.textLight, fontSize: 24 }}>
              +
            </div>
            <div className="author-picker-info">
              <span className="author-picker-name" style={{ color: COLORS.textLight }}>Ajouter un profil</span>
            </div>
          </div>
        )}
      </div>

      {filtered.length === 0 && !onAddNew && (
        <p style={{ color: COLORS.textLight, fontSize: 13, textAlign: 'center', padding: 16 }}>
          Aucun profil trouvé
        </p>
      )}
    </div>
  );
}
