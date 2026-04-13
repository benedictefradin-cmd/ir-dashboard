import { useState, useMemo } from 'react';

/**
 * Tableau générique avec pagination, tri par colonne et compteur filtré.
 * @param {Array} columns - [{ key, label, render?, width?, align?, sortable? }]
 * @param {Array} data - Lignes de données (filtrées)
 * @param {number} pageSize - Items par page (défaut 20)
 * @param {Function} onRowClick - Optionnel
 * @param {React.ReactNode} footer - Contenu additionnel sous le tableau
 * @param {number} totalCount - Nombre total avant filtrage (optionnel)
 * @param {Object} emptyAction - { label, onClick } pour le bouton de l'état vide
 */
export default function DataTable({ columns, data, pageSize = 20, onRowClick, footer, emptyMessage, rowClassName, totalCount, emptyAction }) {
  const [page, setPage] = useState(0);
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  // Tri
  const sorted = useMemo(() => {
    if (!sortCol || !data) return data || [];
    const col = columns.find(c => c.key === sortCol);
    if (!col || col.sortable === false) return data;
    return [...data].sort((a, b) => {
      let va = a[sortCol], vb = b[sortCol];
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortCol, sortDir, columns]);

  const totalPages = Math.ceil((sorted.length || 0) / pageSize);
  const pageData = useMemo(() => sorted.slice(page * pageSize, (page + 1) * pageSize), [sorted, page, pageSize]);

  // Reset page quand les données changent
  useMemo(() => {
    if (page >= totalPages && totalPages > 0) setPage(totalPages - 1);
    if (totalPages === 0) setPage(0);
  }, [totalPages]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSort = (key) => {
    const col = columns.find(c => c.key === key);
    if (col?.sortable === false || key === 'actions') return;
    if (sortCol === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(key);
      setSortDir('asc');
    }
  };

  if (!data || data.length === 0) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="empty-icon">{'\u{1F4CB}'}</div>
          <p>{emptyMessage || 'Aucune donnée à afficher'}</p>
          {emptyAction && (
            <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={emptyAction.onClick}>
              {emptyAction.label}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 0 }}>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map(col => (
                <th
                  key={col.key}
                  style={{
                    width: col.width,
                    textAlign: col.align || 'left',
                    cursor: col.sortable !== false && col.key !== 'actions' ? 'pointer' : 'default',
                    userSelect: 'none',
                    position: 'sticky',
                    top: 0,
                    background: 'var(--white)',
                    zIndex: 2,
                  }}
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}
                  {sortCol === col.key && (
                    <span style={{ marginLeft: 4, fontSize: 11, opacity: 0.6 }}>
                      {sortDir === 'asc' ? '▲' : '▼'}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.map((row, i) => (
              <tr
                key={row.id || i}
                className={rowClassName ? rowClassName(row) : ''}
                onClick={() => onRowClick?.(row)}
                style={{ cursor: onRowClick ? 'pointer' : 'default' }}
              >
                {columns.map(col => (
                  <td key={col.key} style={{ textAlign: col.align || 'left' }}>
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="table-footer">
        <span>
          {sorted.length} résultat{sorted.length > 1 ? 's' : ''}
          {totalCount != null && totalCount !== sorted.length && ` sur ${totalCount}`}
        </span>

        {totalPages > 1 && (
          <div className="pagination">
            <button onClick={() => setPage(0)} disabled={page === 0}>&laquo;</button>
            <button onClick={() => setPage(p => p - 1)} disabled={page === 0}>&lsaquo;</button>
            <span style={{ padding: '0 8px', fontSize: 13 }}>
              Page {page + 1} / {totalPages}
            </span>
            <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}>&rsaquo;</button>
            <button onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1}>&raquo;</button>
          </div>
        )}
      </div>

      {footer}
    </div>
  );
}
