export default function ToastContainer({ toasts, onRemove }) {
  if (!toasts.length) return null;

  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`toast toast-${t.type || 'success'}`}
          onClick={() => onRemove(t.id)}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
