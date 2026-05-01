export default function ToastContainer({ toasts, onRemove }) {
  if (!toasts.length) return null;

  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`toast toast-${t.type || 'success'}`}
          role={t.type === 'error' ? 'alert' : 'status'}
          aria-live={t.type === 'error' ? 'assertive' : 'polite'}
        >
          <div className="toast-body" onClick={() => !t.actions && onRemove(t.id)}>
            <span className="toast-icon" aria-hidden="true">
              {t.type === 'error' ? '⚠' : t.type === 'warning' ? '!' : t.type === 'info' ? 'i' : '✓'}
            </span>
            <span className="toast-message">{t.message}</span>
          </div>
          <div className="toast-actions">
            {t.action && (
              <button
                type="button"
                className="toast-action"
                onClick={(e) => {
                  e.stopPropagation();
                  try { t.action.onClick?.(); } finally { onRemove(t.id); }
                }}
              >
                {t.action.label}
              </button>
            )}
            <button
              type="button"
              className="toast-close"
              aria-label="Fermer la notification"
              onClick={(e) => { e.stopPropagation(); onRemove(t.id); }}
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
