import { useState, useRef, useEffect } from 'react';

export default function MultiSelect({ options, selected, onChange, label }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (value) => {
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const hasSelection = selected.length > 0;

  const displayLabel = !hasSelection
    ? label
    : selected.length === 1
      ? options.find(o => o.value === selected[0])?.label || selected[0]
      : `${selected.length} sélectionnés`;

  return (
    <div className="multi-select" ref={ref}>
      <button
        type="button"
        className={`multi-select-trigger${hasSelection ? ' multi-select-active' : ''}`}
        onClick={() => setOpen(!open)}
      >
        <span className="multi-select-label">{displayLabel}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="multi-select-dropdown">
          {options.map(opt => (
            <label key={opt.value} className="multi-select-option">
              <input
                type="checkbox"
                checked={selected.includes(opt.value)}
                onChange={() => toggle(opt.value)}
              />
              <span>{opt.label}</span>
            </label>
          ))}
          <div className="multi-select-footer">
            <button
              type="button"
              className="multi-select-ok"
              onClick={() => setOpen(false)}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
