import { useRef, useEffect } from 'react';

export default function CodeEditor({ value, onChange }) {
  const textareaRef = useRef(null);
  const lineNumbersRef = useRef(null);

  const lines = (value || '').split('\n');
  const lineCount = lines.length;

  useEffect(() => {
    // Sync scroll between line numbers and textarea
    const ta = textareaRef.current;
    const ln = lineNumbersRef.current;
    if (!ta || !ln) return;
    const handleScroll = () => {
      ln.scrollTop = ta.scrollTop;
    };
    ta.addEventListener('scroll', handleScroll);
    return () => ta.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="code-editor">
      <div className="code-editor-lines" ref={lineNumbersRef}>
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i + 1} className="code-editor-line-number">{i + 1}</div>
        ))}
      </div>
      <textarea
        ref={textareaRef}
        className="code-editor-textarea"
        value={value}
        onChange={e => onChange(e.target.value)}
        spellCheck={false}
      />
    </div>
  );
}
