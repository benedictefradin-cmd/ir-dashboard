import { useState, useCallback, useRef, useEffect } from 'react';
import ServiceBadge from '../components/shared/ServiceBadge';
import SearchBar from '../components/shared/SearchBar';
import { hasGitHub, githubUploadImage, githubGetFile } from '../services/github';
import { SITE_URL } from '../utils/constants';
import { loadLocal } from '../utils/localStorage';
import useDebounce from '../hooks/useDebounce';

const MEDIA_FOLDERS = [
  { id: 'all', label: 'Tous' },
  { id: 'images/auteurs', label: 'Auteurs' },
  { id: 'images/publications', label: 'Publications' },
  { id: 'images/evenements', label: 'Événements' },
  { id: 'images/partenaires', label: 'Partenaires' },
  { id: 'images/site', label: 'Site' },
  { id: 'documents', label: 'Documents (PDF)' },
];

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'application/pdf'];
const MAX_SIZE_MB = 5;

export default function Medias({ toast }) {
  const [medias, setMedias] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeFolder, setActiveFolder] = useState('all');
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const fileInputRef = useRef(null);

  const debouncedSearch = useDebounce(search, 300);

  const loadMedias = useCallback(async () => {
    if (!hasGitHub()) {
      toast('GitHub non configuré', 'error');
      return;
    }
    setLoading(true);
    try {
      const ghToken = loadLocal('ir_github_token', '') || import.meta.env.VITE_GITHUB_TOKEN || '';
      const ghOwner = loadLocal('ir_github_owner', '') || import.meta.env.VITE_GITHUB_OWNER || 'benedictefradin-cmd';
      const ghRepo = loadLocal('ir_github_site_repo', '') || import.meta.env.VITE_GITHUB_SITE_REPO || 'institut-rousseau';
      const folders = ['images/auteurs', 'images/publications', 'images/evenements', 'images/partenaires', 'images/site', 'documents'];
      const results = [];

      for (const folder of folders) {
        try {
          const res = await fetch(
            `https://api.github.com/repos/${ghOwner}/${ghRepo}/contents/${folder}`,
            { headers: { 'Authorization': `Bearer ${ghToken}`, 'Accept': 'application/vnd.github.v3+json' } }
          );
          if (res.ok) {
            const files = await res.json();
            if (Array.isArray(files)) {
              for (const f of files) {
                if (f.type === 'file') {
                  results.push({
                    name: f.name,
                    path: f.path,
                    folder,
                    size: f.size,
                    sha: f.sha,
                    url: `${SITE_URL}/${f.path}`,
                    rawUrl: f.download_url,
                    isImage: /\.(jpg|jpeg|png|webp|svg|gif)$/i.test(f.name),
                    isPdf: /\.pdf$/i.test(f.name),
                  });
                }
              }
            }
          }
        } catch { /* dossier n'existe pas */ }
      }

      setMedias(results);
      toast(`${results.length} fichier(s) chargé(s)`);
    } catch (err) {
      toast(`Erreur : ${err.message}`, 'error');
    }
    setLoading(false);
  }, [toast]);

  // Auto-charger les médias au premier affichage
  useEffect(() => {
    if (hasGitHub() && medias.length === 0) {
      loadMedias();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUpload = async (e) => {
    const files = e.target.files;
    if (!files?.length) return;

    const targetFolder = activeFolder === 'all' ? 'images/site' : activeFolder;
    setUploading(true);

    let uploaded = 0;
    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast(`Type non supporté : ${file.name}`, 'error');
        continue;
      }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        toast(`Fichier trop volumineux (max ${MAX_SIZE_MB}MB) : ${file.name}`, 'error');
        continue;
      }

      try {
        const base64 = await fileToBase64(file);
        const path = `${targetFolder}/${file.name.toLowerCase().replace(/\s+/g, '-')}`;
        const result = await githubUploadImage(path, base64, `Upload ${file.name} depuis le back-office`);

        setMedias(prev => [...prev, {
          name: file.name,
          path,
          folder: targetFolder,
          size: file.size,
          sha: result.sha,
          url: result.url,
          rawUrl: result.url,
          isImage: /\.(jpg|jpeg|png|webp|svg|gif)$/i.test(file.name),
          isPdf: /\.pdf$/i.test(file.name),
        }]);
        uploaded++;
      } catch (err) {
        toast(`Erreur upload ${file.name} : ${err.message}`, 'error');
      }
    }

    if (uploaded > 0) toast(`${uploaded} fichier(s) uploadé(s)`);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const copyUrl = (url) => {
    navigator.clipboard.writeText(url);
    toast('URL copiée');
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  const filtered = medias.filter(m => {
    if (activeFolder !== 'all' && m.folder !== activeFolder) return false;
    if (debouncedSearch && !m.name.toLowerCase().includes(debouncedSearch.toLowerCase())) return false;
    return true;
  });

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Bibliothèque médias</h1>
          <p className="page-header-sub">{medias.length} fichier(s) — images, logos, PDF</p>
        </div>
        <div className="flex-center gap-8">
          <ServiceBadge service="github" />
          <button className="btn btn-primary" onClick={loadMedias} disabled={loading}>
            {loading ? 'Chargement…' : 'Charger les médias'}
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* Toolbar */}
        <div className="flex-between mb-16" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div className="flex-center gap-8">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleUpload}
              multiple
              accept={ALLOWED_TYPES.join(',')}
              style={{ display: 'none' }}
            />
            <button
              className="btn btn-green"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || !hasGitHub()}
            >
              {uploading ? 'Upload…' : '+ Uploader'}
            </button>
            <button
              className={`btn btn-outline btn-sm${viewMode === 'grid' ? ' active' : ''}`}
              onClick={() => setViewMode('grid')}
            >
              Grille
            </button>
            <button
              className={`btn btn-outline btn-sm${viewMode === 'list' ? ' active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              Liste
            </button>
          </div>
          <SearchBar value={search} onChange={setSearch} placeholder="Rechercher un fichier…" />
        </div>

        {/* Dossiers */}
        <div className="tab-group" style={{ flexWrap: 'wrap', marginBottom: 16 }}>
          {MEDIA_FOLDERS.map((f) => (
            <button
              key={f.id}
              className={`tab-item${activeFolder === f.id ? ' active' : ''}`}
              onClick={() => setActiveFolder(f.id)}
            >
              {f.label}
              <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.6 }}>
                ({medias.filter(m => f.id === 'all' || m.folder === f.id).length})
              </span>
            </button>
          ))}
        </div>

        {/* Contenu */}
        {medias.length === 0 && !loading && (
          <div className="card" style={{ padding: 40, textAlign: 'center' }}>
            <p style={{ color: 'var(--text-light)', fontSize: 15 }}>
              {hasGitHub() ? 'Aucun fichier trouvé sur le site' : 'Configurez GitHub dans les Paramètres pour accéder aux médias'}
            </p>
          </div>
        )}

        {viewMode === 'grid' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
            {filtered.map((m) => (
              <div
                key={m.path}
                className="card"
                style={{
                  padding: 0, overflow: 'hidden', cursor: 'pointer',
                  border: selectedMedia?.path === m.path ? '2px solid var(--sky)' : undefined,
                }}
                onClick={() => setSelectedMedia(selectedMedia?.path === m.path ? null : m)}
              >
                <div style={{ height: 140, background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {m.isImage ? (
                    <img src={m.rawUrl} alt={m.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'cover' }} loading="lazy" />
                  ) : (
                    <span style={{ fontSize: 32 }}>{m.isPdf ? '\u{1F4C4}' : '\u{1F4CE}'}</span>
                  )}
                </div>
                <div style={{ padding: '8px 12px' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-light)' }}>{formatSize(m.size)}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--cream)' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>Nom</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>Dossier</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Taille</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.path} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {m.isImage && <img src={m.rawUrl} alt="" style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: 4 }} loading="lazy" />}
                        {!m.isImage && <span>{m.isPdf ? '\u{1F4C4}' : '\u{1F4CE}'}</span>}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 250 }}>{m.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-light)' }}>{m.folder}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{formatSize(m.size)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      <button className="btn btn-outline btn-sm" onClick={() => copyUrl(m.url)}>Copier URL</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Panneau détail */}
        {selectedMedia && (
          <div className="card" style={{ padding: 20, marginTop: 16 }}>
            <div className="flex-between mb-8">
              <h3 style={{ fontSize: 15 }}>{selectedMedia.name}</h3>
              <button className="btn btn-outline btn-sm" onClick={() => setSelectedMedia(null)}>Fermer</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: selectedMedia.isImage ? '200px 1fr' : '1fr', gap: 16 }}>
              {selectedMedia.isImage && (
                <img src={selectedMedia.rawUrl} alt={selectedMedia.name} style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border)' }} />
              )}
              <div style={{ fontSize: 13 }}>
                <div style={{ marginBottom: 8 }}><strong>Chemin :</strong> {selectedMedia.path}</div>
                <div style={{ marginBottom: 8 }}><strong>Taille :</strong> {formatSize(selectedMedia.size)}</div>
                <div style={{ marginBottom: 8 }}><strong>Dossier :</strong> {selectedMedia.folder}</div>
                <div style={{ marginBottom: 12 }}>
                  <strong>URL site :</strong>
                  <input value={selectedMedia.url} readOnly style={{ marginTop: 4, fontSize: 12 }} onClick={(e) => e.target.select()} />
                </div>
                <div className="flex-center gap-8">
                  <button className="btn btn-primary btn-sm" onClick={() => copyUrl(selectedMedia.url)}>Copier l'URL</button>
                  <button className="btn btn-outline btn-sm" onClick={() => copyUrl(selectedMedia.path)}>Copier le chemin</button>
                  <a href={selectedMedia.rawUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">Ouvrir</a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
