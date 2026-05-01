import { useState, useRef } from 'react';
import Modal from '../shared/Modal';
import { githubUploadImage } from '../../services/github';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
const MAX_DIM = 2000;
const MAX_FILE_SIZE_MB = 5;

/**
 * Modal d'insertion d'image dans le RichEditor.
 *
 * Trois modes :
 *  - URL : l'utilisateur colle une URL publique d'image
 *  - Upload : drag & drop / parcourir → uploadé dans assets/img/publications/<slug>/
 *  - Repo : (TODO) parcourir les images existantes du repo site
 *
 * Dans tous les cas l'`alt` est obligatoire — accessibilité + SEO + AUDIT §3.7.
 * Les uploads sont redimensionnés côté client à MAX_DIM px max (côté long) avant
 * push GitHub, pour ne pas faire péter les commits.
 */
export default function ImageInsertModal({ slug, onInsert, onClose, toast }) {
  const [tab, setTab] = useState('upload');
  const [url, setUrl] = useState('');
  const [alt, setAlt] = useState('');
  const [width, setWidth] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef(null);

  const handleFile = async (f) => {
    if (!f) return;
    if (!ALLOWED_TYPES.includes(f.type)) {
      toast?.(`Type non supporté : ${f.type}`, 'error');
      return;
    }
    if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast?.(`Image trop volumineuse (max ${MAX_FILE_SIZE_MB} Mo)`, 'error');
      return;
    }
    setFile(f);
    // preview avant upload
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(f);
  };

  const onDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const submit = async () => {
    if (!alt.trim()) {
      toast?.("Le texte alternatif (alt) est obligatoire — accessibilité + SEO", 'error');
      return;
    }

    if (tab === 'url') {
      if (!url.trim()) return toast?.('URL requise', 'error');
      onInsert({ src: url.trim(), alt: alt.trim(), width: width || undefined });
      onClose();
      return;
    }

    // tab === 'upload'
    if (!file) return toast?.('Sélectionnez une image', 'error');
    setBusy(true);
    try {
      const resized = await resizeIfNeeded(file, MAX_DIM);
      const base64 = await fileToBase64(resized);
      const folder = slug ? `assets/img/publications/${slug}` : 'assets/img/publications';
      const safeName = file.name.toLowerCase().replace(/[^a-z0-9.-]+/g, '-');
      const path = `${folder}/${safeName}`;
      await githubUploadImage(path, base64, `Image ${file.name} pour ${slug || 'article'}`);
      // L'image est dans le repo site — on insère un chemin relatif au site (le HTML
      // final servira le fichier depuis institut-rousseau.fr/{path}).
      onInsert({ src: `/${path}`, alt: alt.trim(), width: width || undefined });
      toast?.('Image uploadée et insérée');
      onClose();
    } catch (err) {
      toast?.(`Erreur upload : ${err.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Insérer une image" onClose={onClose} size="lg">
      <div style={{ padding: '0 0 16px' }}>
        <div className="tab-group" style={{ marginBottom: 16 }}>
          <button type="button" className={`tab-item${tab === 'upload' ? ' active' : ''}`} onClick={() => setTab('upload')}>
            Uploader
          </button>
          <button type="button" className={`tab-item${tab === 'url' ? ' active' : ''}`} onClick={() => setTab('url')}>
            URL
          </button>
        </div>

        {tab === 'upload' && (
          <div
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            style={{
              border: '2px dashed var(--border)',
              borderRadius: 8,
              padding: preview ? 12 : 32,
              textAlign: 'center',
              marginBottom: 16,
              cursor: 'pointer',
              background: 'var(--cream)',
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept={ALLOWED_TYPES.join(',')}
              style={{ display: 'none' }}
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            {preview ? (
              <img src={preview} alt="aperçu" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 4 }} />
            ) : (
              <>
                <div style={{ fontSize: 32, opacity: 0.5 }}>📷</div>
                <p style={{ margin: '8px 0', color: 'var(--text-light)' }}>
                  Glisser-déposer une image, ou cliquer pour parcourir
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-light)' }}>
                  JPG / PNG / WebP / SVG / GIF — max {MAX_FILE_SIZE_MB} Mo · redim. auto à {MAX_DIM}px
                </p>
              </>
            )}
            {file && (
              <p style={{ marginTop: 8, fontSize: 13 }}>{file.name} ({(file.size / 1024).toFixed(0)} Ko)</p>
            )}
          </div>
        )}

        {tab === 'url' && (
          <div style={{ marginBottom: 16 }}>
            <label>URL publique</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://exemple.com/image.jpg"
            />
          </div>
        )}

        <div style={{ marginBottom: 12 }}>
          <label>
            Texte alternatif <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <input
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            placeholder="Ex: Photo du Pont des Arts au coucher du soleil"
            required
          />
          <p style={{ fontSize: 12, color: 'var(--text-light)', margin: '4px 0 0' }}>
            Description lue par les lecteurs d'écran et indexée par les moteurs de recherche.
          </p>
        </div>

        <div>
          <label>Largeur en pixels (optionnel)</label>
          <input
            type="number"
            min="50"
            max="2000"
            value={width}
            onChange={(e) => setWidth(e.target.value)}
            placeholder="ex: 800"
          />
        </div>
      </div>

      <div className="modal-footer">
        <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>
          Annuler
        </button>
        <button type="button" className="btn btn-primary" onClick={submit} disabled={busy}>
          {busy ? 'Upload…' : 'Insérer'}
        </button>
      </div>
    </Modal>
  );
}

// ─── Helpers ──────────────────────────────────────────

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result || '';
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Redimensionne une image si elle dépasse maxDim sur le côté le plus long.
 * Retourne un nouveau Blob (ou l'original si pas de redim nécessaire).
 * Skip pour SVG (pas raster).
 */
async function resizeIfNeeded(file, maxDim) {
  if (file.type === 'image/svg+xml') return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const { width, height } = bitmap;
  if (width <= maxDim && height <= maxDim) {
    bitmap.close?.();
    return file;
  }
  const ratio = Math.min(maxDim / width, maxDim / height);
  const newW = Math.round(width * ratio);
  const newH = Math.round(height * ratio);
  const canvas = document.createElement('canvas');
  canvas.width = newW;
  canvas.height = newH;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, newW, newH);
  bitmap.close?.();
  const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const quality = mime === 'image/jpeg' ? 0.9 : undefined;
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) resolve(file);
      else resolve(new File([blob], file.name, { type: mime }));
    }, mime, quality);
  });
}
