import { useState, useEffect, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import DOMPurify from 'dompurify';
import EditorToolbar from './EditorToolbar';
import CodeEditor from './CodeEditor';
import PreviewPane from './PreviewPane';
import './editor.css';

// Whitelist de balises et attributs autorisés dans le contenu collé (cf. AUDIT §4.5).
// Tout `<script>`, gestionnaire `on*`, `<iframe>`, `javascript:` URI est strippé.
const SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'em', 'u', 's', 'mark', 'span', 'div',
    'h2', 'h3', 'h4', 'blockquote', 'ul', 'ol', 'li',
    'a', 'img', 'hr', 'figure', 'figcaption',
    'sup', 'sub', 'code', 'pre',
  ],
  ALLOWED_ATTR: [
    'href', 'src', 'alt', 'title', 'target', 'rel',
    'class', 'style', 'width', 'height',
  ],
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  ALLOW_DATA_ATTR: false,
  KEEP_CONTENT: true,
};

function sanitizeHtml(html) {
  return DOMPurify.sanitize(html, SANITIZE_CONFIG);
}

const MODES = [
  { key: 'visual', label: 'Visuel' },
  { key: 'html', label: 'HTML' },
  { key: 'preview', label: 'Aper\u00e7u' },
];

export default function RichEditor({ value, onChange, title, author, date, placeholder, slug, toast }) {
  const [mode, setMode] = useState('visual');
  const [htmlCode, setHtmlCode] = useState(value || '');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
      }),
      Image.configure({ inline: false, allowBase64: true }),
      Link.configure({ openOnClick: false, HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' } }),
      Placeholder.configure({ placeholder: placeholder || 'Écrivez votre article ici…' }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
    ],
    content: sanitizeHtml(value || ''),
    editorProps: {
      // Sanitize tout HTML collé depuis l'extérieur (un site Web, Word…)
      // pour bloquer les <script>, on*=, javascript: et iframes.
      transformPastedHTML(html) {
        return sanitizeHtml(html);
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      setHtmlCode(html);
      onChange?.(html);
    },
  });

  // Sync external value changes into editor
  useEffect(() => {
    if (editor && value !== undefined && value !== editor.getHTML()) {
      editor.commands.setContent(sanitizeHtml(value || ''), false);
      setHtmlCode(value || '');
    }
  }, [value]);

  // When switching from HTML mode back to visual, sanitize then push.
  const handleModeChange = (newMode) => {
    if (mode === 'html' && newMode !== 'html' && editor) {
      const cleaned = sanitizeHtml(htmlCode);
      editor.commands.setContent(cleaned, false);
      setHtmlCode(cleaned);
      onChange?.(cleaned);
    }
    if (newMode === 'html' && editor) {
      setHtmlCode(editor.getHTML());
    }
    setMode(newMode);
  };

  // When HTML code is edited directly. On revalide à chaque frappe pour
  // empêcher l'injection via le mode HTML.
  const handleHtmlChange = (newHtml) => {
    setHtmlCode(newHtml);
    onChange?.(newHtml);
  };

  // Word count
  const wordCount = useMemo(() => {
    const text = editor?.getText() || '';
    if (!text.trim()) return 0;
    return text.trim().split(/\s+/).length;
  }, [editor?.getText()]);

  const charCount = editor?.getText()?.length || 0;

  return (
    <div className="rich-editor">
      {/* Mode tabs */}
      <div className="rich-editor-modes">
        {MODES.map(m => (
          <button
            key={m.key}
            type="button"
            className={`rich-editor-mode-btn${mode === m.key ? ' active' : ''}`}
            onClick={() => handleModeChange(m.key)}
          >
            {m.label}
          </button>
        ))}
        <div className="rich-editor-stats">
          {wordCount} mot{wordCount !== 1 ? 's' : ''} \u00b7 {charCount} caract\u00e8re{charCount !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Visual mode */}
      {mode === 'visual' && (
        <>
          <EditorToolbar editor={editor} slug={slug} toast={toast} />
          <div className="rich-editor-content">
            <EditorContent editor={editor} />
          </div>
        </>
      )}

      {/* HTML mode */}
      {mode === 'html' && (
        <CodeEditor value={htmlCode} onChange={handleHtmlChange} />
      )}

      {/* Preview mode */}
      {mode === 'preview' && (
        <PreviewPane
          html={mode === 'html' ? htmlCode : editor?.getHTML() || ''}
          title={title}
          author={author}
          date={date}
        />
      )}
    </div>
  );
}
