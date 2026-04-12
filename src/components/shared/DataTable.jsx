import { useState, useMemo } from 'react';

/**
 * Tableau g\u00e9n\u00e9rique avec pagination.
 * @param {Array} columns - [{ key, label, render?, width?, align? }]
 * @param {Array} data - Lignes de donn\u00e9es
 * @param {number} pageSize - Items par page (d\u00e9faut 20)
 * @param {Function} onRowClick - Optionnel
 * @param {React.ReactNode} footer - Contenu additionnel sous le tableau
 */
export default function DataTable({ columns, data, pageSize = 20, onRowClick, footer, emptyMessage }) {
  const [page, setPage] = useState(0);

  const totalPages = Math.ceil((data?.length || 0) / pageSize);
  const pageData = useMemo(() => {
    return (data || []).slice(page * pageSize, (page + 1) * pageSize);
  }, [data, page, pageSize]);

  // Reset page quand les donn\u00e9es changent
  useMemo(() => {
    if (page >= totalPages && totalPages > 0) setPage(totalPages - 1);
    if (totalPages === 0) setPage(0);
  }, [totalPages]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data || data.length === 0) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="empty-icon">{'\u{1F4CB}'}</div>
          <p>{emptyMessage || 'Aucune donn\u00e9e \u00e0 afficher'}</p>
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
                <th key={col.key} style={{ width: col.width, textAlign: col.align || 'left' }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.map((row, i) => (
              <tr
                key={row.id || i}
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
        <span>{data.length} r\u00e9sultat{data.length > 1 ? 's' : ''}</span>

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
