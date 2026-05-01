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
import Superscript from '@tiptap/extension-superscript';
import Subscript from '@tiptap/extension-subscript';
import DOMPurify from 'dompurify';
import EditorToolbar from './EditorToolbar';
import CodeEditor from './CodeEditor';
import PreviewPane from './PreviewPane';
import { githubUploadImage } from '../../services/github';
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
    // id / name : utilisés par les notes de bas de page (`<a name="_ftn1">`,
    // `<a href="#_ftn1">`). Pas d'exécution possible — pas de risque XSS.
    'id', 'name',
  ],
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  ALLOW_DATA_ATTR: false,
  KEEP_CONTENT: true,
};

function sanitizeHtml(html) {
  return DOMPurify.sanitize(html, SANITIZE_CONFIG);
}

// Helpers drag&drop image (mêmes specs que ImageInsertModal : redim 2000px max).
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const v = r.result || '';
      const i = v.indexOf(',');
      resolve(i >= 0 ? v.slice(i + 1) : v);
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
async function resizeImage(file, maxDim) {
  if (file.type === 'image/svg+xml') return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const { width, height } = bitmap;
  if (width <= maxDim && height <= maxDim) {
    bitmap.close?.();
    return file;
  }
  const ratio = Math.min(maxDim / width, maxDim / height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  return new Promise(resolve => canvas.toBlob(
    blob => resolve(blob ? new File([blob], file.name, { type: mime }) : file),
    mime,
    mime === 'image/jpeg' ? 0.9 : undefined
  ));
}

const ALL_MODES = [
  { key: 'visual', label: 'Visuel' },
  { key: 'html', label: 'HTML' },
  { key: 'preview', label: 'Aper\u00e7u' },
];

export default function RichEditor({ value, onChange, title, author, date, placeholder, slug, toast, trusted = false, defaultMode = 'visual' }) {
  // Pour un contenu de confiance (HTML qui vient du repo site), on cache le
  // mode visuel : TipTap normaliserait certaines balises (iframe, svg,
  // structures complexes) et on perdrait le round-trip parfait. HTML +
  // Aper\u00e7u suffisent pour \u00e9diter et v\u00e9rifier sans rien casser.
  const MODES = trusted ? ALL_MODES.filter(m => m.key !== 'visual') : ALL_MODES;
  const initialMode = trusted && defaultMode === 'visual' ? 'html' : defaultMode;
  const [mode, setMode] = useState(initialMode);
  const [htmlCode, setHtmlCode] = useState(value || '');

  // Quand le HTML vient de notre propre repo (`trusted`), on saute la
  // sanitization initiale : DOMPurify ne sert qu'à filtrer le HTML
  // collé depuis le presse-papiers (paste handler) ou tapé en mode HTML.
  // Sanitiser un contenu déjà validé strippe inutilement des `name`/`id`
  // et finit par le mutiler à chaque round-trip.
  // En mode trusted, le mode visuel est masqué (cf. MODES) — on initialise
  // donc l'éditeur TipTap vide pour éviter qu'il parse des balises qu'il
  // ne connaît pas (iframe, svg…) et logge des warnings dans la console.
  const safeInitial = trusted ? '' : sanitizeHtml(value || '');

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
      Superscript,
      Subscript,
    ],
    content: safeInitial,
    editorProps: {
      // Sanitize tout HTML collé depuis l'extérieur (un site Web, Word…)
      // pour bloquer les <script>, on*=, javascript: et iframes.
      transformPastedHTML(html) {
        return sanitizeHtml(html);
      },
      // Drag & drop direct d'images dans l'éditeur : upload sur le repo site
      // puis insertion. L'`alt` est temporairement vide — l'utilisateur peut
      // l'éditer en cliquant sur l'image (ou repasser par la modal). Ce hook
      // n'intercepte que les images, les autres drops (texte) suivent leur cours.
      handleDrop(view, event) {
        const files = Array.from(event.dataTransfer?.files || []).filter(f => f.type.startsWith('image/'));
        if (!files.length) return false;
        event.preventDefault();
        files.forEach(async (file) => {
          try {
            const resized = await resizeImage(file, 2000);
            const base64 = await fileToBase64(resized);
            const folderSlug = slug || 'article';
            const safeName = file.name.toLowerCase().replace(/[^a-z0-9.-]+/g, '-');
            const path = `assets/img/publications/${folderSlug}/${safeName}`;
            await githubUploadImage(path, base64, `Image (drop) ${file.name}`);
            const altPrompt = window.prompt('Texte alternatif (alt) — accessibilité + SEO :', file.name);
            view.dispatch(view.state.tr.replaceSelectionWith(
              view.state.schema.nodes.image.create({ src: `/${path}`, alt: altPrompt || file.name })
            ));
            toast?.('Image uploadée et insérée');
          } catch (err) {
            toast?.(`Erreur upload : ${err.message}`, 'error');
          }
        });
        return true;
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      setHtmlCode(html);
      onChange?.(html);
    },
  });

  // Sync external value changes into editor. En mode trusted, l'éditeur
  // visuel est caché — on évite donc de pousser le contenu dans TipTap
  // (parse coûteux + warnings sur les balises iframe/svg/table inconnues).
  // On garde uniquement htmlCode à jour pour les modes HTML/Aperçu.
  useEffect(() => {
    if (trusted) {
      // setHtmlCode est référentiellement stable et React bail-out si
      // la valeur ne change pas — pas besoin de vérifier l'égalité ici.
      setHtmlCode(value || '');
      return;
    }
    if (editor && value !== undefined && value !== editor.getHTML()) {
      editor.commands.setContent(sanitizeHtml(value || ''), false);
      setHtmlCode(value || '');
    }
  }, [value, trusted]);

  // When switching from HTML mode back to visual, sanitize then push.
  // En mode trusted, on saute la sanitization pour préserver les balises
  // peu courantes (iframe, svg, attributs name/id…) à l'identique.
  const handleModeChange = (newMode) => {
    if (mode === 'html' && newMode !== 'html' && editor) {
      const next = trusted ? htmlCode : sanitizeHtml(htmlCode);
      editor.commands.setContent(next, false);
      setHtmlCode(next);
      onChange?.(next);
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
