export default function Modal({ title, onClose, children, footer, size }) {
  const sizeClass = size === 'lg' ? ' modal-lg' : size === 'xl' ? ' modal-xl' : '';

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal${sizeClass}`}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        {children}
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
