import { useCallback } from 'react';

const HEADING_OPTIONS = [
  { level: 0, label: 'Paragraphe' },
  { level: 2, label: 'Titre H2' },
  { level: 3, label: 'Sous-titre H3' },
  { level: 4, label: 'H4' },
];

const TEXT_COLORS = [
  { color: '#1a2744', label: 'Navy' },
  { color: '#4a90d9', label: 'Sky' },
  { color: '#c45a3c', label: 'Terra' },
  { color: '#d4a843', label: 'Ochre' },
  { color: '#2D8659', label: 'Green' },
  { color: '#333333', label: 'Noir' },
];

export default function EditorToolbar({ editor }) {
  if (!editor) return null;

  const setLink = useCallback(() => {
    const prev = editor.getAttributes('link').href;
    const url = window.prompt('URL du lien :', prev || 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url, target: '_blank' }).run();
    }
  }, [editor]);

  const addImage = useCallback(() => {
    const url = window.prompt('URL de l\u2019image :');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

  const setHeading = useCallback((level) => {
    if (level === 0) {
      editor.chain().focus().setParagraph().run();
    } else {
      editor.chain().focus().toggleHeading({ level }).run();
    }
  }, [editor]);

  const currentHeading = () => {
    for (const h of [2, 3, 4]) {
      if (editor.isActive('heading', { level: h })) return h;
    }
    return 0;
  };

  return (
    <div className="editor-toolbar">
      {/* Heading select */}
      <select
        className="editor-toolbar-select"
        value={currentHeading()}
        onChange={e => setHeading(Number(e.target.value))}
      >
        {HEADING_OPTIONS.map(h => (
          <option key={h.level} value={h.level}>{h.label}</option>
        ))}
      </select>

      <span className="editor-toolbar-sep" />

      {/* Bold / Italic / Underline / Strike */}
      <button
        type="button"
        className={`editor-toolbar-btn${editor.isActive('bold') ? ' active' : ''}`}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Gras (Cmd+B)"
      >
        <strong>G</strong>
      </button>
      <button
        type="button"
        className={`editor-toolbar-btn${editor.isActive('italic') ? ' active' : ''}`}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italique (Cmd+I)"
      >
        <em>I</em>
      </button>
      <button
        type="button"
        className={`editor-toolbar-btn${editor.isActive('underline') ? ' active' : ''}`}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        title="Souligner (Cmd+U)"
      >
        <u>S</u>
      </button>
      <button
        type="button"
        className={`editor-toolbar-btn${editor.isActive('strike') ? ' active' : ''}`}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        title="Barrer"
      >
        <s>B</s>
      </button>

      <span className="editor-toolbar-sep" />

      {/* Text color */}
      <div className="editor-toolbar-colors">
        {TEXT_COLORS.map(c => (
          <button
            key={c.color}
            type="button"
            className={`editor-toolbar-color-btn${editor.isActive('textStyle', { color: c.color }) ? ' active' : ''}`}
            style={{ background: c.color }}
            onClick={() => editor.chain().focus().setColor(c.color).run()}
            title={c.label}
          />
        ))}
        <button
          type="button"
          className="editor-toolbar-btn"
          onClick={() => editor.chain().focus().unsetColor().run()}
          title="Couleur par défaut"
          style={{ fontSize: 11 }}
        >
          ×
        </button>
      </div>

      <span className="editor-toolbar-sep" />

      {/* Highlight */}
      <button
        type="button"
        className={`editor-toolbar-btn${editor.isActive('highlight') ? ' active' : ''}`}
        onClick={() => editor.chain().focus().toggleHighlight({ color: '#fef3c7' }).run()}
        title="Surligner"
      >
        <span style={{ background: '#fef3c7', padding: '0 3px', borderRadius: 2 }}>H</span>
      </button>

      {/* Text align */}
      <button
        type="button"
        className={`editor-toolbar-btn${editor.isActive({ textAlign: 'left' }) ? ' active' : ''}`}
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        title="Aligner à gauche"
      >
        ⇤
      </button>
      <button
        type="button"
        className={`editor-toolbar-btn${editor.isActive({ textAlign: 'center' }) ? ' active' : ''}`}
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        title="Centrer"
      >
        ≡
      </button>
      <button
        type="button"
        className={`editor-toolbar-btn${editor.isActive({ textAlign: 'right' }) ? ' active' : ''}`}
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        title="Aligner à droite"
      >
        ⇥
      </button>

      <span className="editor-toolbar-sep" />

      {/* Lists */}
      <button
        type="button"
        className={`editor-toolbar-btn${editor.isActive('bulletList') ? ' active' : ''}`}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="Liste à puces"
      >
        •
      </button>
      <button
        type="button"
        className={`editor-toolbar-btn${editor.isActive('orderedList') ? ' active' : ''}`}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        title="Liste numérotée"
      >
        1.
      </button>

      {/* Blockquote */}
      <button
        type="button"
        className={`editor-toolbar-btn${editor.isActive('blockquote') ? ' active' : ''}`}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        title="Citation"
      >
        ❝
      </button>

      <span className="editor-toolbar-sep" />

      {/* Link */}
      <button
        type="button"
        className={`editor-toolbar-btn${editor.isActive('link') ? ' active' : ''}`}
        onClick={setLink}
        title="Insérer un lien"
      >
        🔗
      </button>

      {/* Image */}
      <button
        type="button"
        className="editor-toolbar-btn"
        onClick={addImage}
        title="Insérer une image"
      >
        🖼
      </button>

      {/* Horizontal rule */}
      <button
        type="button"
        className="editor-toolbar-btn"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Ligne horizontale"
      >
        —
      </button>

      <span className="editor-toolbar-sep" />

      {/* Undo / Redo */}
      <button
        type="button"
        className="editor-toolbar-btn"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Annuler (Cmd+Z)"
      >
        ↶
      </button>
      <button
        type="button"
        className="editor-toolbar-btn"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Rétablir (Cmd+Shift+Z)"
      >
        ↷
      </button>
    </div>
  );
}
