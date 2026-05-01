import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import Modal from './Modal';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [opts, setOpts] = useState(null);
  const resolveRef = useRef(null);

  const confirm = useCallback((options = {}) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setOpts({
        title: options.title || 'Confirmer',
        message: options.message || 'Êtes-vous sûr ?',
        confirmLabel: options.confirmLabel || 'Confirmer',
        cancelLabel: options.cancelLabel || 'Annuler',
        danger: options.danger ?? false,
        details: options.details || null,
      });
    });
  }, []);

  const close = (result) => {
    if (resolveRef.current) {
      resolveRef.current(result);
      resolveRef.current = null;
    }
    setOpts(null);
  };

  // Échap = annuler ; Entrée = confirmer
  useEffect(() => {
    if (!opts) return;
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(false); }
      if (e.key === 'Enter')  { e.preventDefault(); close(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [opts]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {opts && (
        <Modal
          title={opts.title}
          onClose={() => close(false)}
          footer={
            <>
              <button className="btn btn-outline" onClick={() => close(false)} autoFocus={!opts.danger}>
                {opts.cancelLabel}
              </button>
              <button
                className={opts.danger ? 'btn btn-danger' : 'btn btn-primary'}
                onClick={() => close(true)}
                autoFocus={opts.danger}
              >
                {opts.confirmLabel}
              </button>
            </>
          }
        >
          <div style={{ padding: '4px 0 8px', lineHeight: 1.55 }}>
            <p style={{ margin: 0, fontSize: 15 }}>{opts.message}</p>
            {opts.details && (
              <div style={{
                marginTop: 12,
                padding: '10px 12px',
                background: 'var(--bg-light, #f6f6f7)',
                borderRadius: 6,
                fontSize: 13,
                color: 'var(--text-light, #666)',
                wordBreak: 'break-word',
              }}>
                {opts.details}
              </div>
            )}
            {opts.danger && (
              <p style={{
                marginTop: 12,
                marginBottom: 0,
                fontSize: 13,
                color: 'var(--danger, #c0392b)',
                fontWeight: 500,
              }}>
                Cette action est irréversible.
              </p>
            )}
          </div>
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    // Fallback si oublié dans l'arbre — on ne casse pas, on tombe sur window.confirm
    return ({ message }) => Promise.resolve(window.confirm(message || 'Confirmer ?'));
  }
  return ctx;
}
